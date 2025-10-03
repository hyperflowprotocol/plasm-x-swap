const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { walletAddress, chain = 'base' } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing walletAddress' });
    }

    try {
      await pool.query(
        `INSERT INTO registered_wallets (wallet_address, chain, is_active) 
         VALUES ($1, $2, true) 
         ON CONFLICT (wallet_address) DO UPDATE SET is_active = true`,
        [walletAddress.toLowerCase(), chain]
      );
      
      const result = await pool.query(
        'SELECT COUNT(*) as total FROM registered_wallets WHERE is_active = true'
      );
      
      return res.status(200).json({ 
        success: true, 
        registered: walletAddress,
        message: 'Wallet registered for automatic token sweeping',
        totalWallets: parseInt(result.rows[0].total)
      });
    } catch (error) {
      console.error('Register wallet error:', error);
      return res.status(500).json({ error: 'Failed to register wallet' });
    }
  }

  if (req.method === 'GET') {
    try {
      const result = await pool.query(
        'SELECT wallet_address, chain, registered_at FROM registered_wallets WHERE is_active = true ORDER BY registered_at DESC'
      );
      
      return res.status(200).json({ 
        wallets: result.rows.map(r => r.wallet_address),
        count: result.rows.length,
        details: result.rows
      });
    } catch (error) {
      console.error('Get wallets error:', error);
      return res.status(500).json({ error: 'Failed to get wallets' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
