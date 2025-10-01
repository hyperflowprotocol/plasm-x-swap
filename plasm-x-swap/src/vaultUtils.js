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
  
  // Use backend API with detailed error logging
  const base = apiBase; // Use the passed apiBase parameter
  const url = `${base}/api/sign-voucher`;
  
  console.log('🌐 Fetching voucher from:', url);
  console.log('📤 Request payload:', { referrer, token: tokenAddr, amount: amountWei.toString() });
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        referrer,
        token: tokenAddr,
        amount: amountWei.toString()
      }),
      mode: 'cors',
      credentials: 'omit'
    });

    console.log('📥 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get voucher' }));
      console.error('❌ API error response:', error);
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Voucher received successfully');
    return data;
  } catch (error) {
    console.error('❌ Fetch error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Check vault configuration
 * @param {string} apiBase - Backend API URL
 * @returns {Promise<{configured: boolean, vaultAddress?: string, signerAddress?: string}>}
 */
export async function getVaultInfo(apiBase) {
  // Use backend API with detailed error logging
  const base = apiBase; // Use the passed apiBase parameter
  const url = `${base}/api/vault-info`;
  
  console.log('🌐 Fetching vault info from:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      mode: 'cors',
      credentials: 'omit'
    });
    
    console.log('📥 Vault info response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Vault info received:', data);
    return data;
  } catch (error) {
    console.error('❌ Vault info fetch error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Claim referral fees using a signed voucher
 * @param {string} apiBase - Backend API URL  
 * @param {string} vaultAddress - ReferralVault contract address
 * @param {string} token - Token address ('native' for XPL or ERC20 address)
 * @param {string} amountWei - Amount in wei
 * @param {object} provider - Raw Ethereum provider from Privy
 * @param {string} userAddress - User's wallet address
 * @returns {Promise<object>} - Transaction hash
 */
export async function claimReferralFee(apiBase, vaultAddress, token, amountWei, provider, userAddress) {
  try {
    console.log(`🎯 Claiming ${ethers.formatEther(amountWei)} XPL fees for ${userAddress}`);

    // Get signed voucher from backend
    console.log('📡 Requesting voucher from backend...');
    const voucher = await getVoucher(apiBase, userAddress, token, amountWei);
    console.log('✅ Voucher received:', voucher);

    // Encode claim() function call manually
    const tokenAddr = token === 'native' ? ZERO_ADDRESS : token;
    
    // claim(address token, uint256 amount, uint256 nonce, uint256 deadline, bytes signature)
    const iface = new ethers.Interface(VAULT_ABI);
    const data = iface.encodeFunctionData('claim', [
      tokenAddr,
      amountWei,
      voucher.nonce,
      voucher.deadline,
      voucher.signature
    ]);
    
    console.log('📦 Encoded transaction data:', data.substring(0, 66) + '...');
    
    // Send transaction directly via provider (Privy-compatible)
    console.log('📤 Sending transaction via Privy provider...');
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: userAddress,
        to: vaultAddress,
        data: data,
        value: '0x0'
      }]
    });

    console.log('✅ Transaction sent! Hash:', txHash);
    return { hash: txHash };
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
