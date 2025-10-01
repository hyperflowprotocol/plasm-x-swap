import { ethers } from 'ethers';

const PLASMA_RPC = 'https://rpc.plasma.to';
const PUMP_FACTORY_ADDRESS = '0xB21486D9499a2cD8CE3e638E4077327affd8F24f';

const PUMP_FACTORY_ABI = [
  "function launchsForAll(bool _desc, uint256 _start, uint256 _end) external view returns (tuple(address owner, address token, uint256 realEthReserves, uint256 realTokenReserves, uint256 initialVirtualEthReserves, uint256 initialVirtualTokenReserves, uint256 virtualEthReserves, uint256 liquidityEth, uint256 liquidityToken, bool complete)[] launches, uint256 total)"
];

const TOKEN_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function logoURI() external view returns (string)"
];

let tokenCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 60000; // 1 minute

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    const now = Date.now();
    if (tokenCache.data && (now - tokenCache.timestamp < CACHE_DURATION)) {
      console.log('💾 Returning cached launched tokens');
      return res.status(200).json({ tokens: tokenCache.data, cached: true });
    }

    console.log('🚀 Fetching launched tokens from blockchain...');
    const provider = new ethers.JsonRpcProvider(PLASMA_RPC);
    const factory = new ethers.Contract(PUMP_FACTORY_ADDRESS, PUMP_FACTORY_ABI, provider);
    
    const result = await factory.launchsForAll(true, 0, 200);
    const launches = result[0];
    
    const uniqueTokens = new Map();
    for (const launch of launches) {
      if (!uniqueTokens.has(launch.token.toLowerCase())) {
        uniqueTokens.set(launch.token.toLowerCase(), launch);
      }
    }
    
    console.log(`✅ Found ${uniqueTokens.size} unique tokens`);
    
    const tokens = [];
    let processed = 0;
    const MAX_TOKENS = 100;
    
    for (const [tokenAddr, launch] of uniqueTokens) {
      if (processed >= MAX_TOKENS) break;
      
      try {
        const tokenContract = new ethers.Contract(tokenAddr, TOKEN_ABI, provider);
        const [name, symbol, logoURI] = await Promise.all([
          tokenContract.name(),
          tokenContract.symbol(),
          tokenContract.logoURI()
        ]);
        
        const realEthReserves = parseFloat(ethers.formatEther(launch.realEthReserves));
        const initialVirtualEthReserves = parseFloat(ethers.formatEther(launch.initialVirtualEthReserves));
        const bondingProgress = initialVirtualEthReserves > 0 
          ? (realEthReserves / initialVirtualEthReserves) * 100 
          : 0;
        
        tokens.push({
          address: tokenAddr,
          name,
          symbol,
          logoURI,
          bondingProgress: Math.min(bondingProgress, 100),
          marketCapXPL: realEthReserves,
          complete: launch.complete
        });
        
        processed++;
      } catch (err) {
        console.error(`Error loading token ${tokenAddr}:`, err.message);
      }
    }
    
    tokens.sort((a, b) => b.bondingProgress - a.bondingProgress);
    
    tokenCache = { data: tokens, timestamp: now };
    
    console.log(`✅ Loaded ${tokens.length} tokens`);
    res.status(200).json({ tokens });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message, tokens: [] });
  }
}
