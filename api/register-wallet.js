const { registerWallet, getRegisteredWallets } = require('../lib/wallet-registry');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // Register a wallet for auto-sweep monitoring
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing walletAddress' });
    }

    registerWallet(walletAddress);
    
    return res.status(200).json({ 
      success: true, 
      registered: walletAddress,
      message: 'Wallet registered for automatic token sweeping',
      totalWallets: getRegisteredWallets().length
    });
  }

  if (req.method === 'GET') {
    // Get all registered wallets
    const wallets = getRegisteredWallets();
    return res.status(200).json({ 
      wallets,
      count: wallets.length
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
