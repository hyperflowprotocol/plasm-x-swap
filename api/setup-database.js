const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔧 Setting up database tables...');
    
    // Create registered_wallets table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registered_wallets (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(42) UNIQUE NOT NULL,
        chain VARCHAR(20) NOT NULL DEFAULT 'base',
        is_active BOOLEAN NOT NULL DEFAULT true,
        registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_sweep_at TIMESTAMP,
        total_sweeps INTEGER DEFAULT 0
      )
    `);
    
    console.log('✅ Table created');
    
    // Create index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_registered_wallets_active 
      ON registered_wallets(wallet_address, chain, is_active) 
      WHERE is_active = true
    `);
    
    console.log('✅ Index created');
    
    // Get current tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // Get row count
    const count = await pool.query('SELECT COUNT(*) as total FROM registered_wallets');
    
    return res.status(200).json({ 
      success: true,
      message: 'Database setup complete',
      tables: tables.rows.map(r => r.table_name),
      registeredWallets: parseInt(count.rows[0].total)
    });
    
  } catch (error) {
    console.error('❌ Setup error:', error);
    return res.status(500).json({ 
      error: 'Setup failed',
      details: error.message 
    });
  }
};
