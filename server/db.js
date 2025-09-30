const { Pool } = require('pg');

// PostgreSQL connection pool - lazy initialization for serverless
let pool = null;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

// Helper to execute queries
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await getPool().query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Query executed', { text: text.substring(0, 60), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('❌ Database query error:', error);
    throw error;
  }
}

// Bind user to referrer (only if not already bound)
async function bindReferrer(userAddress, referrerAddress) {
  const text = `
    INSERT INTO referrer_bindings (user_address, referrer_address)
    VALUES ($1, $2)
    ON CONFLICT (user_address) DO NOTHING
    RETURNING *
  `;
  const result = await query(text, [userAddress.toLowerCase(), referrerAddress.toLowerCase()]);
  return result.rows[0];
}

// Get referrer for a user
async function getReferrer(userAddress) {
  const text = 'SELECT referrer_address FROM referrer_bindings WHERE user_address = $1';
  const result = await query(text, [userAddress.toLowerCase()]);
  return result.rows[0]?.referrer_address || null;
}

// Log a swap with fee breakdown
async function logSwap(txHash, userAddress, referrerAddress, grossAmountWei, platformFeeWei, platformCutWei, referrerCutWei) {
  const text = `
    INSERT INTO swap_logs (tx_hash, user_address, referrer_address, gross_amount_wei, platform_fee_wei, platform_cut_wei, referrer_cut_wei)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (tx_hash) DO NOTHING
    RETURNING *
  `;
  const result = await query(text, [
    txHash,
    userAddress.toLowerCase(),
    referrerAddress ? referrerAddress.toLowerCase() : null,
    grossAmountWei,
    platformFeeWei,
    platformCutWei,
    referrerCutWei
  ]);
  
  // Update referral earnings if there's a referrer
  if (referrerAddress && referrerCutWei !== '0') {
    await updateReferralEarnings(referrerAddress, referrerCutWei);
  }
  
  return result.rows[0];
}

// Update referral earnings (add to total_earned)
async function updateReferralEarnings(referrerAddress, amountWei) {
  const text = `
    INSERT INTO referral_earnings (referrer_address, total_earned_wei)
    VALUES ($1, $2)
    ON CONFLICT (referrer_address) 
    DO UPDATE SET 
      total_earned_wei = (CAST(referral_earnings.total_earned_wei AS NUMERIC) + CAST($2 AS NUMERIC))::TEXT,
      last_updated = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const result = await query(text, [referrerAddress.toLowerCase(), amountWei]);
  return result.rows[0];
}

// Get referrer earnings summary
async function getReferrerSummary(referrerAddress) {
  const text = `
    SELECT 
      referrer_address,
      total_earned_wei,
      total_claimed_wei,
      (CAST(total_earned_wei AS NUMERIC) - CAST(total_claimed_wei AS NUMERIC))::TEXT as payable_wei,
      last_updated
    FROM referral_earnings
    WHERE referrer_address = $1
  `;
  const result = await query(text, [referrerAddress.toLowerCase()]);
  
  if (result.rows.length === 0) {
    // Return empty summary if no earnings yet
    return {
      referrer_address: referrerAddress.toLowerCase(),
      total_earned_wei: '0',
      total_claimed_wei: '0',
      payable_wei: '0',
      last_updated: null
    };
  }
  
  return result.rows[0];
}

// Update claimed amount after successful claim
async function updateClaimedAmount(referrerAddress, claimedAmountWei) {
  const text = `
    UPDATE referral_earnings
    SET 
      total_claimed_wei = (CAST(total_claimed_wei AS NUMERIC) + CAST($2 AS NUMERIC))::TEXT,
      last_updated = CURRENT_TIMESTAMP
    WHERE referrer_address = $1
    RETURNING *
  `;
  const result = await query(text, [referrerAddress.toLowerCase(), claimedAmountWei]);
  return result.rows[0];
}

// Create or update custom referral code
async function setReferralCode(walletAddress, referralCode) {
  // Validate code format (alphanumeric, 3-20 chars)
  if (!/^[a-zA-Z0-9]{3,20}$/.test(referralCode)) {
    throw new Error('Invalid code format. Use 3-20 alphanumeric characters.');
  }
  
  const text = `
    INSERT INTO referral_codes (wallet_address, referral_code)
    VALUES ($1, $2)
    ON CONFLICT (referral_code) DO NOTHING
    RETURNING *
  `;
  const result = await query(text, [walletAddress.toLowerCase(), referralCode.toUpperCase()]);
  
  if (result.rows.length === 0) {
    throw new Error('Code already taken');
  }
  
  return result.rows[0];
}

// Get referral code for a wallet
async function getReferralCode(walletAddress) {
  const text = 'SELECT * FROM referral_codes WHERE wallet_address = $1';
  const result = await query(text, [walletAddress.toLowerCase()]);
  return result.rows[0] || null;
}

// Get wallet address from referral code
async function getWalletFromCode(referralCode) {
  const text = 'SELECT * FROM referral_codes WHERE referral_code = $1';
  const result = await query(text, [referralCode.toUpperCase()]);
  return result.rows[0] || null;
}

// Get referral count for a wallet
async function getReferralCount(walletAddress) {
  const text = 'SELECT COUNT(*) as count FROM referrer_bindings WHERE referrer_address = $1';
  const result = await query(text, [walletAddress.toLowerCase()]);
  return parseInt(result.rows[0]?.count || '0');
}

// Bind user to referrer using referral code
async function bindReferrerByCode(userAddress, referralCode) {
  // Get wallet from code
  const codeData = await getWalletFromCode(referralCode);
  if (!codeData) {
    throw new Error('Invalid referral code');
  }
  
  // Don't allow self-referral
  if (codeData.wallet_address.toLowerCase() === userAddress.toLowerCase()) {
    throw new Error('Cannot refer yourself');
  }
  
  const text = `
    INSERT INTO referrer_bindings (user_address, referrer_address, referral_code)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_address) DO NOTHING
    RETURNING *
  `;
  const result = await query(text, [
    userAddress.toLowerCase(), 
    codeData.wallet_address, 
    referralCode.toUpperCase()
  ]);
  return result.rows[0];
}

module.exports = {
  query,
  bindReferrer,
  getReferrer,
  logSwap,
  getReferrerSummary,
  updateClaimedAmount,
  setReferralCode,
  getReferralCode,
  getWalletFromCode,
  bindReferrerByCode,
  getReferralCount
};
