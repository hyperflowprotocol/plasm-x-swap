const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Get ALL wallets with full details
    const all = await pool.query(
      'SELECT * FROM registered_wallets ORDER BY registered_at DESC'
    );
    
    // Get only active wallets
    const active = await pool.query(
      `SELECT * FROM registered_wallets WHERE is_active = true AND chain = 'base'`
    );
    
    return res.status(200).json({ 
      success: true,
      allWallets: all.rows,
      activeWallets: active.rows,
      totalCount: all.rows.length,
      activeCount: active.rows.length
    });
    
  } catch (error) {
    console.error('Check error:', error);
    return res.status(500).json({ 
      error: 'Check failed',
      details: error.message 
    });
  }
};
