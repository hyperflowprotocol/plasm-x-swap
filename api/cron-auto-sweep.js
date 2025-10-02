const { ethers } = require('ethers');

// Contract addresses
const VAULT_CONTRACT = '0x514dDA54703a4d89bd44A266d0623611e0B8c686';
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

// In-memory store of registered wallets
let registeredWallets = new Set();

// This endpoint can be called by Vercel Cron or manually
// It automatically sweeps tokens from all registered wallets that have approved
module.exports = async (req, res) => {
  try {
    console.log(`🔄 Auto-sweep cron started at ${new Date().toISOString()}`);
    
    // Get list of registered wallets
    const wallets = Array.from(registeredWallets);
    
    if (wallets.length === 0) {
      console.log('⏭️ No registered wallets to monitor');
      return res.status(200).json({ 
        success: true,
        message: 'No wallets registered yet',
        swept: []
      });
    }

    console.log(`📊 Monitoring ${wallets.length} registered wallets...`);

    // Setup Base chain provider
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    const vault = new ethers.Contract(VAULT_CONTRACT, VAULT_ABI, wallet);

    const results = {
      timestamp: new Date().toISOString(),
      monitored: wallets.length,
      swept: [],
      pending: [],
      errors: []
    };

    // Check each registered wallet
    for (const userAddress of wallets) {
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

          // Auto-sweep if approved
          if (balance > 0n && allowance >= balance) {
            console.log(`💰 Auto-sweeping ${balanceFormatted} ${symbol} from ${userAddress}`);
            
            try {
              const tx = await vault.sweepToken(userAddress, tokenAddress, 0);
              const receipt = await tx.wait();
              
              console.log(`✅ Swept ${symbol}: ${tx.hash}`);
              
              results.swept.push({
                user: userAddress,
                token: symbol,
                amount: balanceFormatted,
                txHash: tx.hash,
                gasUsed: receipt.gasUsed.toString()
              });
            } catch (sweepError) {
              console.error(`❌ Sweep failed:`, sweepError.message);
              results.errors.push({
                user: userAddress,
                token: symbol,
                error: sweepError.message
              });
            }
          } else if (balance > 0n) {
            results.pending.push({
              user: userAddress,
              token: symbol,
              balance: balanceFormatted,
              note: 'Awaiting approval'
            });
          }
          
        } catch (error) {
          console.error(`Error checking ${tokenAddress}:`, error.message);
          results.errors.push({
            user: userAddress,
            token: tokenAddress,
            error: error.message
          });
        }
      }
    }

    console.log(`✅ Cron complete: ${results.swept.length} swept, ${results.pending.length} pending`);
    
    return res.status(200).json(results);

  } catch (error) {
    console.error('❌ Cron error:', error);
    return res.status(500).json({ 
      error: 'Cron failed',
      details: error.message 
    });
  }
};

// Function to register a wallet (called from register-wallet.js)
module.exports.registerWallet = (address) => {
  registeredWallets.add(address.toLowerCase());
  console.log(`✅ Wallet registered for auto-sweep: ${address}`);
  console.log(`📊 Total registered: ${registeredWallets.size}`);
};

// Function to get registered wallets
module.exports.getRegisteredWallets = () => Array.from(registeredWallets);
