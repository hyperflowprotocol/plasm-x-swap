// Serverless API entry point for Vercel
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple tokens - no external calls
const PLASMA_TOKENS = [
  {
    symbol: 'XPL',
    name: 'Plasma',
    address: 'native',
    decimals: 18
  },
  {
    symbol: 'WXPL',
    name: 'Wrapped XPL',
    address: '0x6100e367285b01f48d07953803a2d8dca5d19873',
    decimals: 18
  },
  {
    symbol: 'USDT0',
    name: 'USDT0',
    address: '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb',
    decimals: 6
  }
];

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Plasm X Swap Backend API',
    status: 'running',
    version: '1.0.0',
    endpoints: [
      '/api/tokens',
      '/api/referral-stats/:address',
      '/api/create-referral-code',
      '/api/bind-by-code',
      '/api/track-swap',
      '/health'
    ]
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: 'vercel-serverless',
    database: !!process.env.DATABASE_URL,
    vault: !!process.env.VAULT_ADDRESS
  });
});

// Database migration endpoint - run once to update schema
app.get('/api/migrate', async (req, res) => {
  try {
    const db = require('../db');
    
    // Add missing columns to swap_logs table
    await db.query(`
      ALTER TABLE swap_logs 
        ADD COLUMN IF NOT EXISTS platform_fee_wei VARCHAR(78) DEFAULT '0',
        ADD COLUMN IF NOT EXISTS platform_cut_wei VARCHAR(78) DEFAULT '0',
        ADD COLUMN IF NOT EXISTS referrer_cut_wei VARCHAR(78) DEFAULT '0'
    `);
    
    // Drop old conflicting columns
    await db.query(`
      ALTER TABLE swap_logs 
        DROP COLUMN IF EXISTS fee_amount_wei,
        DROP COLUMN IF EXISTS swapped_at
    `);
    
    // Create voucher nonces table for claim functionality
    await db.query(`
      CREATE TABLE IF NOT EXISTS voucher_nonces (
        referrer_address VARCHAR(42) PRIMARY KEY,
        current_nonce BIGINT NOT NULL DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Verify columns exist
    const result = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'swap_logs' 
      ORDER BY ordinal_position
    `);
    
    const columns = result.rows.map(r => r.column_name);
    
    res.json({ 
      success: true, 
      message: 'Database migration completed! Schema updated + voucher_nonces table created.',
      swap_logs_columns: columns,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get tokens
app.get('/api/tokens', (req, res) => {
  res.json(PLASMA_TOKENS);
});

// Referral endpoints - lazy load db only when needed
app.post('/api/create-referral-code', async (req, res) => {
  try {
    const db = require('../db');
    const { walletAddress, referralCode } = req.body;
    
    if (!walletAddress || !referralCode) {
      return res.status(400).json({ error: 'Missing walletAddress or referralCode' });
    }
    
    const result = await db.createReferralCode(walletAddress, referralCode);
    res.json({ success: true, referralCode: result });
  } catch (error) {
    console.error('Error creating referral code:', error);
    res.status(500).json({ error: error.message || 'Failed to create referral code' });
  }
});

app.post('/api/bind-by-code', async (req, res) => {
  try {
    const db = require('../db');
    const { userAddress, referralCode } = req.body;
    
    if (!userAddress || !referralCode) {
      return res.status(400).json({ error: 'Missing userAddress or referralCode' });
    }
    
    const referralRecord = await db.getReferralCodeInfo(referralCode);
    if (!referralRecord) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }
    
    if (userAddress.toLowerCase() === referralRecord.wallet_address.toLowerCase()) {
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }
    
    const binding = await db.bindReferrer(userAddress, referralRecord.wallet_address);
    
    if (binding) {
      console.log(`✅ Bound user ${userAddress} to referrer via code ${referralCode}`);
      res.json({ success: true, binding, referrer: referralRecord.wallet_address });
    } else {
      res.json({ success: true, message: 'Already bound to a referrer' });
    }
  } catch (error) {
    console.error('Error binding by code:', error);
    res.status(400).json({ error: error.message || 'Failed to bind referral' });
  }
});

app.get('/api/referral-stats/:address', async (req, res) => {
  try {
    const db = require('../db');
    const { address } = req.params;
    
    const [code, referralCount, earnings] = await Promise.all([
      db.getReferralCode(address),
      db.getReferralCount(address),
      db.getReferralEarnings(address)
    ]);
    
    res.json({
      walletAddress: address,
      referralCode: code?.referral_code || null,
      totalReferrals: referralCount,
      totalEarnings: earnings || '0'
    });
  } catch (error) {
    console.error('Error getting referral stats:', error);
    res.status(500).json({ error: 'Failed to get referral stats' });
  }
});

// Track swap and calculate referrer earnings
app.post('/api/track-swap', async (req, res) => {
  try {
    const db = require('../db');
    const { txHash, userAddress, grossAmountWei } = req.body;
    
    if (!txHash || !userAddress || !grossAmountWei) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Calculate 2% platform fee
    const platformFeeWei = (BigInt(grossAmountWei) * BigInt(2) / BigInt(100)).toString();
    
    // Check if user has a referrer (returns address string or null)
    const referrerAddress = await db.getReferrer(userAddress);
    
    let referrerCutWei = '0';
    let platformCutWei = platformFeeWei;
    
    if (referrerAddress) {
      // 30% of platform fee goes to referrer
      referrerCutWei = (BigInt(platformFeeWei) * BigInt(30) / BigInt(100)).toString();
      // 70% stays with platform
      platformCutWei = (BigInt(platformFeeWei) - BigInt(referrerCutWei)).toString();
      
      console.log(`💰 Swap tracked: User ${userAddress} via referrer ${referrerAddress}`);
      console.log(`💵 Platform fee: ${platformFeeWei} wei (Referrer: ${referrerCutWei}, Platform: ${platformCutWei})`);
    } else {
      console.log(`💰 Swap tracked: User ${userAddress} (no referrer)`);
      console.log(`💵 Platform fee: ${platformFeeWei} wei (100% to platform)`);
    }
    
    // Log swap to database (this also calls updateReferralEarnings internally)
    const swapLog = await db.logSwap(
      txHash,
      userAddress,
      referrerAddress,
      grossAmountWei,
      platformFeeWei,
      platformCutWei,
      referrerCutWei
    );
    
    res.json({
      success: true,
      swap: swapLog,
      referrerEarnings: referrerCutWei
    });
  } catch (error) {
    console.error('Error tracking swap:', error);
    res.status(500).json({ error: error.message || 'Failed to track swap' });
  }
});

// ============ VOUCHER SIGNING ENDPOINTS ============

// Vault configuration
const VAULT_CONFIG = {
  signerPK: process.env.SIGNER_PK || process.env.DEPLOYER_PRIVATE_KEY || null,
  vaultAddress: process.env.VAULT_ADDRESS || '0xB6973bA89e9d898aD28F922399067c1E9D46f77B',
  chainId: process.env.CHAIN_ID || '9745'
};

// EIP-712 domain (must match ReferralVault.sol)
const getVaultDomain = () => ({
  name: 'ReferralVault',
  version: '1',
  chainId: Number(VAULT_CONFIG.chainId),
  verifyingContract: VAULT_CONFIG.vaultAddress
});

const vaultTypes = {
  Payout: [
    { name: 'referrer', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
};

// POST /api/sign-voucher - Sign a referral payout voucher
app.post('/api/sign-voucher', async (req, res) => {
  try {
    const db = require('../db');
    
    if (!VAULT_CONFIG.signerPK || !VAULT_CONFIG.vaultAddress) {
      return res.status(503).json({ 
        error: 'Vault not configured. Set SIGNER_PK/DEPLOYER_PRIVATE_KEY and VAULT_ADDRESS env vars.' 
      });
    }

    const { referrer, token, amount, deadline } = req.body || {};

    // Validate referrer address
    if (!referrer || !ethers.isAddress(referrer)) {
      return res.status(400).json({ error: 'Invalid referrer address' });
    }
    
    // Normalize token address
    const tokenAddr = token === 'native' || token === '0x0000000000000000000000000000000000000000' 
      ? '0x0000000000000000000000000000000000000000' 
      : token;
      
    if (tokenAddr !== '0x0000000000000000000000000000000000000000' && !ethers.isAddress(tokenAddr)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }
    
    // Validate amount (must be integer wei string)
    if (!amount || !/^[0-9]+$/.test(amount) || BigInt(amount) <= 0n) {
      return res.status(400).json({ error: 'Invalid amount. Must be positive integer wei string.' });
    }

    // Check database balance for native token claims
    if (tokenAddr === '0x0000000000000000000000000000000000000000') {
      const summary = await db.getReferrerSummary(referrer);
      const payable = BigInt(summary.payable_wei);
      const requested = BigInt(amount);
      
      if (requested > payable) {
        return res.status(400).json({ 
          error: 'Insufficient balance',
          payable: payable.toString(),
          requested: requested.toString()
        });
      }
      
      // Update claimed amount in database
      await db.updateClaimedAmount(referrer, amount);
      console.log(`✅ Updated claimed amount for ${referrer}: ${ethers.formatEther(amount)} XPL`);
    }

    // Get next nonce from database (atomic)
    const nonce = await db.getNextNonce(referrer);
    
    // Calculate deadline
    const now = Math.floor(Date.now() / 1000);
    const dl = deadline ? Number(deadline) : (now + 3600); // 1 hour default

    // Create voucher value
    const value = {
      referrer: referrer,
      token: tokenAddr,
      amount: amount.toString(),
      nonce: nonce.toString(),
      deadline: dl
    };

    // Sign the voucher
    const wallet = new ethers.Wallet(VAULT_CONFIG.signerPK);
    const signature = await wallet.signTypedData(getVaultDomain(), vaultTypes, value);

    console.log(`✅ Signed voucher for ${referrer}: ${ethers.formatEther(amount)} tokens (nonce: ${nonce})`);

    return res.json({
      signature,
      nonce: nonce.toString(),
      deadline: dl,
      referrer,
      token: tokenAddr,
      amount: amount.toString()
    });
  } catch (error) {
    console.error('❌ Error signing voucher:', error);
    return res.status(500).json({ error: 'Failed to sign voucher: ' + error.message });
  }
});

// GET /api/vault-info - Get vault configuration info
app.get('/api/vault-info', (req, res) => {
  if (!VAULT_CONFIG.vaultAddress) {
    return res.json({ 
      configured: false, 
      message: 'Vault not configured. Set VAULT_ADDRESS env var.' 
    });
  }

  const wallet = VAULT_CONFIG.signerPK ? new ethers.Wallet(VAULT_CONFIG.signerPK) : null;
  
  res.json({
    configured: true,
    vaultAddress: VAULT_CONFIG.vaultAddress,
    chainId: VAULT_CONFIG.chainId,
    signerAddress: wallet ? wallet.address : 'Not set',
    domain: getVaultDomain()
  });
});

// Export for Vercel
module.exports = app;
