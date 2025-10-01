import { ethers } from 'ethers';

// ReferralVault ABI - only claim function needed
export const VAULT_ABI = [
  "function claim(address token, uint256 amount, uint256 nonce, uint256 deadline, bytes signature) external",
  "function signer() view returns (address)",
  "function used(bytes32) view returns (bool)"
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Get a signed voucher from the backend
 * @param {string} apiBase - Backend API URL
 * @param {string} referrer - Referrer wallet address
 * @param {string} token - Token address ('native' or ERC20 address)
 * @param {string} amountWei - Amount in wei (as string)
 * @returns {Promise<{signature: string, nonce: string, deadline: number}>}
 */
export async function getVoucher(apiBase, referrer, token, amountWei) {
  const tokenAddr = token === 'native' ? ZERO_ADDRESS : token;
  
  // Use same-origin /api endpoint to avoid CORS issues on Safari/iOS
  const url = '/api/sign-voucher';
  
  console.log('🌐 Fetching voucher from:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      referrer,
      token: tokenAddr,
      amount: amountWei.toString()
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get voucher' }));
    throw new Error(error.error || 'Failed to get voucher');
  }

  return await response.json();
}

/**
 * Check vault configuration
 * @param {string} apiBase - Backend API URL
 * @returns {Promise<{configured: boolean, vaultAddress?: string, signerAddress?: string}>}
 */
export async function getVaultInfo(apiBase) {
  // Use same-origin /api endpoint to avoid CORS issues on Safari/iOS
  const url = '/api/vault-info';
  
  console.log('🌐 Fetching vault info from:', url);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to get vault info');
  }
  return await response.json();
}

/**
 * Claim referral fees using a signed voucher
 * @param {string} apiBase - Backend API URL  
 * @param {string} vaultAddress - ReferralVault contract address
 * @param {string} token - Token address ('native' for XPL or ERC20 address)
 * @param {string} amountWei - Amount in wei
 * @param {object} signer - Ethers signer (from wallet)
 * @returns {Promise<object>} - Transaction receipt
 */
export async function claimReferralFee(apiBase, vaultAddress, token, amountWei, signer) {
  try {
    console.log('🔍 Getting referrer address from signer...');
    const referrer = await signer.getAddress();
    console.log(`🎯 Claiming ${ethers.formatEther(amountWei)} fees for ${referrer}`);

    // Get signed voucher from backend
    console.log('📡 Requesting voucher from backend...');
    const voucher = await getVoucher(apiBase, referrer, token, amountWei);
    console.log('✅ Voucher received:', voucher);

    // Call vault.claim() with voucher
    const vault = new ethers.Contract(vaultAddress, VAULT_ABI, signer);
    
    const tokenAddr = token === 'native' ? ZERO_ADDRESS : token;
    
    const tx = await vault.claim(
      tokenAddr,
      amountWei,
      voucher.nonce,
      voucher.deadline,
      voucher.signature
    );

    console.log('📤 Claim transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Claim successful!', receipt);

    return receipt;
  } catch (error) {
    console.error('❌ Claim failed:', error);
    throw error;
  }
}

/**
 * Format claim error for user display
 * @param {Error} error - Error from claim transaction
 * @returns {string} - User-friendly error message
 */
export function formatClaimError(error) {
  const message = error.message || error.toString();
  
  if (message.includes('expired')) {
    return 'Voucher expired. Please request a new one.';
  }
  if (message.includes('already used')) {
    return 'This voucher has already been claimed.';
  }
  if (message.includes('bad sig')) {
    return 'Invalid voucher signature. Please contact support.';
  }
  if (message.includes('insufficient funds')) {
    return 'Vault has insufficient balance. Please contact support.';
  }
  if (message.includes('user rejected')) {
    return 'Transaction rejected by user.';
  }
  
  return `Claim failed: ${message.substring(0, 100)}`;
}
