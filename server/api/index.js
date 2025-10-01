// Serverless API entry point for Vercel
const express = require('express');
const cors = require('cors');

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
      message: 'Database migration completed successfully!',
      columns: columns,
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

// Export for Vercel
module.exports = app;
