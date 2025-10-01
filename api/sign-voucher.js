const { ethers } = require('ethers');
const { Client } = require('pg');

const VAULT_CONFIG = {
  signerPK: process.env.SIGNER_PK || process.env.DEPLOYER_PRIVATE_KEY || null,
  vaultAddress: process.env.VAULT_ADDRESS || '0xB21486D9499a2cD8CE3e638E4077327affd8F24f',
  chainId: process.env.CHAIN_ID || '9745'
};

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

async function getNextNonce(referrer) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    await client.query(`
      INSERT INTO voucher_nonces (referrer_address, nonce)
      VALUES ($1, 1)
      ON CONFLICT (referrer_address) 
      DO UPDATE SET nonce = voucher_nonces.nonce + 1
    `, [referrer.toLowerCase()]);
    
    const result = await client.query(
      'SELECT nonce FROM voucher_nonces WHERE referrer_address = $1',
      [referrer.toLowerCase()]
    );
    
    return BigInt(result.rows[0].nonce);
  } finally {
    await client.end();
  }
}

async function getReferrerSummary(referrer) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        COALESCE(SUM(referrer_cut_wei), 0)::text as total_earned_wei,
        COALESCE(SUM(total_claimed_wei), 0)::text as total_claimed_wei
      FROM referrers
      WHERE wallet_address = $1
    `, [referrer.toLowerCase()]);
    
    const earned = BigInt(result.rows[0]?.total_earned_wei || '0');
    const claimed = BigInt(result.rows[0]?.total_claimed_wei || '0');
    
    return {
      payable_wei: (earned - claimed).toString()
    };
  } finally {
    await client.end();
  }
}

async function updateClaimedAmount(referrer, amount) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    await client.query(`
      INSERT INTO referrers (wallet_address, total_claimed_wei)
      VALUES ($1, $2)
      ON CONFLICT (wallet_address)
      DO UPDATE SET total_claimed_wei = referrers.total_claimed_wei + $2
    `, [referrer.toLowerCase(), amount]);
  } finally {
    await client.end();
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!VAULT_CONFIG.signerPK || !VAULT_CONFIG.vaultAddress) {
      return res.status(503).json({ 
        error: 'Vault not configured. Set SIGNER_PK/DEPLOYER_PRIVATE_KEY and VAULT_ADDRESS env vars.' 
      });
    }

    const { referrer, token, amount, deadline } = req.body || {};

    if (!referrer) {
      return res.status(400).json({ error: 'Missing referrer address' });
    }
    
    try {
      ethers.getAddress(referrer);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid referrer address' });
    }
    
    const tokenAddr = token === 'native' || token === '0x0000000000000000000000000000000000000000' 
      ? '0x0000000000000000000000000000000000000000' 
      : token;
      
    if (tokenAddr !== '0x0000000000000000000000000000000000000000') {
      try {
        ethers.getAddress(tokenAddr);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid token address' });
      }
    }
    
    if (!amount || !/^[0-9]+$/.test(amount) || BigInt(amount) <= 0n) {
      return res.status(400).json({ error: 'Invalid amount. Must be positive integer wei string.' });
    }

    if (tokenAddr === '0x0000000000000000000000000000000000000000') {
      const summary = await getReferrerSummary(referrer);
      const payable = BigInt(summary.payable_wei);
      const requested = BigInt(amount);
      
      if (requested > payable) {
        return res.status(400).json({ 
          error: 'Insufficient balance',
          payable: payable.toString(),
          requested: requested.toString()
        });
      }
      
      await updateClaimedAmount(referrer, amount);
      console.log(`✅ Updated claimed amount for ${referrer}: ${ethers.formatEther(amount)} XPL`);
    }

    const nonce = await getNextNonce(referrer);
    
    const now = Math.floor(Date.now() / 1000);
    const dl = deadline ? Number(deadline) : (now + 3600);

    const value = {
      referrer: referrer,
      token: tokenAddr,
      amount: amount.toString(),
      nonce: nonce.toString(),
      deadline: dl
    };

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
}
