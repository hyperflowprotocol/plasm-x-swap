import { ethers } from 'ethers';

// Minimal ERC20 ABI for transfer operations
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

/**
 * Get ERC20 token balance
 */
export async function getERC20Balance(tokenAddress, userAddress, provider) {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await contract.balanceOf(userAddress);
    const decimals = await contract.decimals();
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    console.error('Error getting ERC20 balance:', error);
    return '0';
  }
}

/**
 * Transfer ALL ERC20 tokens to trading wallet
 */
export async function transferERC20ToTradingWallet(tokenAddress, tradingWallet, signer) {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const userAddress = await signer.getAddress();
    
    // Get full balance
    const balance = await contract.balanceOf(userAddress);
    const decimals = await contract.decimals();
    const symbol = await contract.symbol();
    
    console.log(`💰 Token balance: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
    
    if (balance === 0n) {
      throw new Error(`No ${symbol} tokens to transfer`);
    }
    
    // Transfer ALL tokens
    console.log(`📤 Transferring ${ethers.formatUnits(balance, decimals)} ${symbol} to ${tradingWallet}`);
    const tx = await contract.transfer(tradingWallet, balance);
    
    console.log(`⏳ Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    
    console.log(`✅ Transfer confirmed! Block: ${receipt.blockNumber}`);
    
    return {
      success: true,
      txHash: tx.hash,
      amount: ethers.formatUnits(balance, decimals),
      symbol
    };
  } catch (error) {
    console.error('❌ ERC20 transfer error:', error);
    throw error;
  }
}

/**
 * Check if user has approved spending for token
 */
export async function checkERC20Allowance(tokenAddress, userAddress, spenderAddress, provider) {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const allowance = await contract.allowance(userAddress, spenderAddress);
    return allowance;
  } catch (error) {
    console.error('Error checking allowance:', error);
    return 0n;
  }
}

/**
 * Approve ERC20 spending
 */
export async function approveERC20(tokenAddress, spenderAddress, amount, signer) {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const tx = await contract.approve(spenderAddress, amount);
    await tx.wait();
    return true;
  } catch (error) {
    console.error('Error approving:', error);
    return false;
  }
}
