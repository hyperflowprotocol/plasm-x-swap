const express = require('express');
const cors = require('cors');
const path = require('path');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Simple Token System - Tickers Only (No Logos)
// Removed all logo resolution logic for speed and simplicity

// Base tokens for Plasma network - symbols only
const PLASMA_TOKENS = [
  {
    symbol: 'XPL',
    name: 'Plasma',
    address: 'native',
    decimals: 18
  },
  {
    symbol: 'WXPL',
    name: 'Wrapped XPL',
    address: '0x6100e367285b01f48d07953803a2d8dca5d19873',
    decimals: 18
  },
  {
    symbol: 'USDT0',
    name: 'USDT0',
    address: '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb',
    decimals: 6
  }
];

// API Routes

// Get tokens - symbols only, no logos
app.get('/api/tokens', async (req, res) => {
  try {
    console.log('🚀 API: Getting tokens (symbols only)');
    
    // Return tokens with just essential data - no logos
    const tokens = PLASMA_TOKENS.map(token => ({
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      decimals: token.decimals
    }));
    
    console.log(`✅ Returning ${tokens.length} tokens with symbols only`);
    res.json(tokens);
    
  } catch (error) {
    console.error('❌ Error in /api/tokens:', error);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// Removed quote API - using REAL blockchain quotes only

// DyorSwap Pump configuration
const PUMP_FACTORY_ADDRESS = '0x5a96508c1092960dA0981CaC7FD00217E9CdabEC'; // V2 on Plasma
const PLASMA_RPC = 'https://rpc.plasma.to';

const PUMP_FACTORY_ABI = [
  "event Deployed(address indexed addr, uint256 amount)",
  "function isPumps(address) external view returns (bool)",
  "function getLaunchInfo(address) external view returns (tuple(address owner, address token, uint256 realEthReserves, uint256 realTokenReserves, uint256 initialVirtualEthReserves, uint256 initialVirtualTokenReserves, uint256 virtualEthReserves, uint256 liquidityEth, uint256 liquidityToken, bool complete))",
  "function launchsForAll(bool desc, uint256 start, uint256 end) external view returns (tuple(address owner, address token, uint256 realEthReserves, uint256 realTokenReserves, uint256 initialVirtualEthReserves, uint256 initialVirtualTokenReserves, uint256 virtualEthReserves, uint256 liquidityEth, uint256 liquidityToken, bool complete)[], uint256)",
  "function createPair(address _projectOwner, address _pairToken, uint256 _amountIn, tuple(string name, string symbol, string description, string image, string website, string telegram, string twitter, string meta, uint256 totalSupply, uint256 realEthReserves, uint256 realTokenReserves, uint256 liquidityEth, uint256 liquidityToken, uint256 initialVirtualTokenSlippage, uint256 initialVirtualEthReserves, uint256 initialVirtualTokenReserves) params) external payable returns (address addr)"
];

const PUMP_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function description() view returns (string)",
  "function image() view returns (string)",
  "function website() view returns (string)",
  "function telegram() view returns (string)",
  "function twitter() view returns (string)",
  "function realEthReserves() view returns (uint256)",
  "function liquidityEth() view returns (uint256)",
  "function complete() view returns (bool)"
];

// Cache for launched tokens - refresh every 30 seconds
let launchedTokensCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

// Persistent metadata cache - never overwrite successful metadata
const tokenMetadataCache = new Map(); // address -> {symbol, name, logo, lastSuccess}

// Get all launched tokens using launchsForAll then fetch metadata from token contracts
app.get('/api/launched-tokens', async (req, res) => {
  try {
    // Return cached data if available and fresh
    const now = Date.now();
    if (launchedTokensCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('💾 Returning cached launched tokens');
      return res.json(launchedTokensCache);
    }
    
    console.log('🚀 Fetching ALL launches using launchsForAll...');
    
    const provider = new ethers.JsonRpcProvider(PLASMA_RPC);
    const pumpFactory = new ethers.Contract(PUMP_FACTORY_ADDRESS, PUMP_FACTORY_ABI, provider);
    
    // Get ALL launches from launchsForAll (newest first)
    const MAX_TOKENS = 100;
    console.log(`📊 Calling launchsForAll(true, 0, ${MAX_TOKENS})...`);
    
    const [launchesArray, totalCount] = await pumpFactory.launchsForAll(true, 0, MAX_TOKENS);
    
    console.log(`✅ Received ${launchesArray.length} launches (total: ${totalCount.toString()})`);
    
    // Dedupe by token address
    const seen = new Set();
    const uniqueLaunches = [];
    for (const launch of launchesArray) {
      if (!seen.has(launch.token)) {
        seen.add(launch.token);
        uniqueLaunches.push(launch);
      }
    }
    
    console.log(`✅ Found ${uniqueLaunches.length} UNIQUE tokens after deduplication`);
    
    // Fetch metadata for each token
    const tokens = [];
    const DELAY_MS = 300; // Increased delay to avoid rate limiting (20/sec limit = 50ms minimum, using 300ms to be safe)
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    const METADATA_LIMIT = 100; // Load metadata for up to 100 tokens
    console.log(`🔄 Loading metadata for ${Math.min(uniqueLaunches.length, METADATA_LIMIT)} tokens...`);
    
    for (let i = 0; i < Math.min(uniqueLaunches.length, METADATA_LIMIT); i++) {
      try {
        const launch = uniqueLaunches[i];
        const tokenAddress = launch.token;
        
        // Try to get metadata from token contract
        const tokenContract = new ethers.Contract(tokenAddress, PUMP_TOKEN_ABI, provider);
        
        let name = 'Unknown';
        let symbol = 'UNKNOWN';
        let image = '';
        
        // Check persistent cache first
        const cached = tokenMetadataCache.get(tokenAddress.toLowerCase());
        
        try {
          symbol = await tokenContract.symbol();
          name = symbol; // Use symbol as name by default
        } catch (e) {
          // If failed but we have cached data, use it
          if (cached && cached.symbol !== 'UNKNOWN') {
            symbol = cached.symbol;
            name = cached.name;
            image = cached.logo;
            console.log(`  💾 Using cached metadata for ${tokenAddress.substring(0, 8)}: $${symbol}`);
          } else {
            console.log(`  ⚠️  symbol() failed for ${tokenAddress.substring(0, 8)}`);
          }
        }
        
        // Only fetch more data if we got a successful symbol
        if (symbol !== 'UNKNOWN') {
          try {
            const tokenName = await tokenContract.name();
            // Only use name if it's different from symbol and doesn't look like an event
            if (tokenName && tokenName !== symbol && !tokenName.includes('bought') && !tokenName.includes('0x')) {
              name = tokenName;
            }
          } catch (e) {
            // Use cached name if available
            if (cached && cached.name) {
              name = cached.name;
            }
          }
          
          try {
            image = await tokenContract.image();
          } catch (e) {
            // Use cached logo if available
            if (cached && cached.logo) {
              image = cached.logo;
            }
          }
          
          // Store successful metadata in persistent cache
          tokenMetadataCache.set(tokenAddress.toLowerCase(), {
            symbol,
            name,
            logo: image,
            lastSuccess: Date.now()
          });
        }
        
        // Calculate accurate bonding curve progress
        const realEth = parseFloat(ethers.formatEther(launch.realEthReserves));
        const targetEth = parseFloat(ethers.formatEther(launch.liquidityEth));
        const bondingProgress = targetEth > 0 ? (realEth / targetEth) * 100 : 0;
        
        // Calculate accurate market cap using bonding curve (x*y=k)
        const virtualEth = parseFloat(ethers.formatEther(launch.virtualEthReserves));
        const initialVirtualEth = parseFloat(ethers.formatEther(launch.initialVirtualEthReserves));
        const initialVirtualTokens = parseFloat(ethers.formatEther(launch.initialVirtualTokenReserves));
        const realTokens = parseFloat(ethers.formatEther(launch.realTokenReserves));
        
        // Current price from bonding curve: price = virtualEth / realTokenReserves  
        const currentPrice = realTokens > 0 ? virtualEth / realTokens : 0;
        
        // Get totalSupply (usually 1B for pump tokens)
        let totalSupply = 1000000000; // 1B default
        try {
          const ts = await tokenContract.totalSupply();
          totalSupply = parseFloat(ethers.formatEther(ts));
        } catch (e) {}
        
        // Market cap formula: MC = initialVirtualEth × (totalSupply / initialVirtualTokens)
        // This gives the "fully diluted" market cap based on initial bonding curve setup
        const marketCap = initialVirtualTokens > 0 
          ? initialVirtualEth * (totalSupply / initialVirtualTokens)
          : currentPrice * totalSupply;
        
        // Build logo URL
        const logoUrl = image ? `https://cyan-bright-dormouse-440.mypinata.cloud/ipfs/${image}` : '';
        
        tokens.push({
          address: tokenAddress,
          name: name,
          symbol: symbol,
          description: '',
          logo: logoUrl,
          bondingProgress: Math.min(bondingProgress, 100),
          marketCap,
          currentPrice,
          isComplete: launch.complete
        });
        
        console.log(`✅ [${i + 1}/${Math.min(uniqueLaunches.length, METADATA_LIMIT)}] $${symbol} (${name}) - MC: ${realEth.toFixed(2)} XPL - Progress: ${bondingProgress.toFixed(1)}%`);
        
        if (i < Math.min(uniqueLaunches.length, METADATA_LIMIT) - 1) {
          await delay(DELAY_MS);
        }
      } catch (error) {
        console.error(`❌ Error loading token:`, error.message);
        await delay(DELAY_MS);
      }
    }
    
    // Sort by market cap
    tokens.sort((a, b) => b.marketCap - a.marketCap);
    
    console.log(`🎉 Successfully loaded ${tokens.length} UNIQUE tokens`);
    
    // Only cache if we successfully got meaningful data
    // Don't overwrite good cache with UNKNOWN tokens due to rate limiting
    const validTokens = tokens.filter(t => t.symbol !== 'UNKNOWN');
    const shouldCache = validTokens.length > tokens.length * 0.5; // At least 50% valid
    
    if (shouldCache || !launchedTokensCache) {
      console.log(`✅ Caching ${tokens.length} tokens (${validTokens.length} valid)`);
      const result = { tokens, total: tokens.length };
      launchedTokensCache = result;
      cacheTimestamp = Date.now();
      res.json(result);
    } else {
      console.log(`⚠️ Too many UNKNOWN tokens (${tokens.length - validTokens.length}/${tokens.length}), returning stale cache instead`);
      if (launchedTokensCache) {
        return res.json(launchedTokensCache);
      }
      // If no cache available, return what we have
      res.json({ tokens, total: tokens.length });
    }
    
  } catch (error) {
    console.error('❌ Error fetching launched tokens:', error);
    // Return cached data if available, even if stale
    if (launchedTokensCache) {
      console.log('⚠️ Returning stale cache due to error');
      return res.json(launchedTokensCache);
    }
    res.status(500).json({ error: 'Failed to fetch launched tokens', tokens: [], total: 0 });
  }
});

// Search for a specific token by address
app.get('/api/search-token/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    console.log(`🔍 Searching for token: ${address}`);
    
    const provider = new ethers.JsonRpcProvider(PLASMA_RPC);
    const pumpFactory = new ethers.Contract(PUMP_FACTORY_ADDRESS, PUMP_FACTORY_ABI, provider);
    
    // Check if token is a valid pump token
    const isPump = await pumpFactory.isPumps(address);
    if (!isPump) {
      return res.status(404).json({ error: 'Token not found in DyorSwap Pump' });
    }
    
    // Get launch info
    const launchInfo = await pumpFactory.getLaunchInfo(address);
    
    // Get metadata with cache support
    const tokenContract = new ethers.Contract(address, PUMP_TOKEN_ABI, provider);
    let symbol = 'UNKNOWN';
    let name = 'Unknown';
    let image = '';
    
    // Check cache first
    const cached = tokenMetadataCache.get(address);
    if (cached && cached.symbol !== 'UNKNOWN') {
      symbol = cached.symbol;
      name = cached.name;
      image = cached.logo;
      console.log(`  💾 Using cached metadata: $${symbol}`);
    } else {
      // Try to fetch fresh metadata
      try {
        symbol = await tokenContract.symbol();
        name = symbol;
      } catch (e) {
        // Use cached if available, even if UNKNOWN
        if (cached && cached.symbol) {
          symbol = cached.symbol;
          name = cached.name;
          console.log(`  💾 Using cached UNKNOWN metadata`);
        }
      }
      
      // Only fetch more data if we got a successful symbol
      if (symbol !== 'UNKNOWN') {
        try {
          const tokenName = await tokenContract.name();
          if (tokenName && tokenName !== symbol && !tokenName.includes('bought') && !tokenName.includes('0x')) {
            name = tokenName;
          }
        } catch (e) {
          if (cached && cached.name) name = cached.name;
        }
        
        try {
          image = await tokenContract.image();
        } catch (e) {
          if (cached && cached.logo) image = cached.logo;
        }
        
        // Cache successful metadata
        tokenMetadataCache.set(address, {
          symbol,
          name,
          logo: image,
          lastSuccess: Date.now()
        });
      }
    }
    
    // Calculate metrics
    const realEth = parseFloat(ethers.formatEther(launchInfo.realEthReserves));
    const targetEth = parseFloat(ethers.formatEther(launchInfo.liquidityEth));
    const bondingProgress = targetEth > 0 ? (realEth / targetEth) * 100 : 0;
    
    const virtualEth = parseFloat(ethers.formatEther(launchInfo.virtualEthReserves));
    const initialVirtualEth = parseFloat(ethers.formatEther(launchInfo.initialVirtualEthReserves));
    const initialVirtualTokens = parseFloat(ethers.formatEther(launchInfo.initialVirtualTokenReserves));
    const realTokens = parseFloat(ethers.formatEther(launchInfo.realTokenReserves));
    
    const currentPrice = realTokens > 0 ? virtualEth / realTokens : 0;
    
    let totalSupply = 1000000000;
    try {
      const ts = await tokenContract.totalSupply();
      totalSupply = parseFloat(ethers.formatEther(ts));
    } catch (e) {}
    
    const marketCap = initialVirtualTokens > 0 
      ? initialVirtualEth * (totalSupply / initialVirtualTokens)
      : currentPrice * totalSupply;
    
    const logoUrl = image ? `https://cyan-bright-dormouse-440.mypinata.cloud/ipfs/${image}` : '';
    
    const token = {
      address: address,
      name: name,
      symbol: symbol,
      description: '',
      logo: logoUrl,
      bondingProgress: Math.min(bondingProgress, 100),
      marketCap,
      currentPrice,
      isComplete: launchInfo.complete
    };
    
    console.log(`✅ Found token: $${symbol} - MC: ${marketCap.toFixed(2)} XPL - Progress: ${bondingProgress.toFixed(1)}%`);
    res.json({ token });
    
  } catch (error) {
    console.error('❌ Error searching for token:', error.message);
    res.status(500).json({ error: 'Failed to search for token' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'local',
    database: !!process.env.DATABASE_URL
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Plasm X Swap Backend API',
    status: 'running',
    endpoints: ['/api/tokens', '/api/launched-tokens', '/health']
  });
});

// Preload launched tokens cache on startup (background)
async function preloadLaunchedTokens() {
  try {
    console.log('🔄 Preloading launched tokens cache...');
    const provider = new ethers.JsonRpcProvider(PLASMA_RPC);
    const pumpFactory = new ethers.Contract(PUMP_FACTORY_ADDRESS, PUMP_FACTORY_ABI, provider);
    
    const [launchesArray] = await pumpFactory.launchsForAll(true, 0, 100);
    const seen = new Set();
    const uniqueLaunches = [];
    for (const launch of launchesArray) {
      if (!seen.has(launch.token)) {
        seen.add(launch.token);
        uniqueLaunches.push(launch);
      }
    }
    
    const tokens = [];
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Load up to 50 tokens to avoid overwhelming rate limits
    const PRELOAD_LIMIT = 50;
    console.log(`📊 Found ${uniqueLaunches.length} unique launches, loading first ${Math.min(uniqueLaunches.length, PRELOAD_LIMIT)}...`);
    for (let i = 0; i < Math.min(uniqueLaunches.length, PRELOAD_LIMIT); i++) {
      try {
        const launch = uniqueLaunches[i];
        const tokenContract = new ethers.Contract(launch.token, PUMP_TOKEN_ABI, provider);
        
        let symbol = 'UNKNOWN', name = 'Unknown', image = '';
        try { symbol = await tokenContract.symbol(); name = symbol; } catch (e) {}
        try { const n = await tokenContract.name(); if (n && n !== symbol) name = n; } catch (e) {}
        try { image = await tokenContract.image(); } catch (e) {}
        
        // Calculate accurate bonding curve progress
        const realEth = parseFloat(ethers.formatEther(launch.realEthReserves));
        const targetEth = parseFloat(ethers.formatEther(launch.liquidityEth));
        const bondingProgress = targetEth > 0 ? (realEth / targetEth) * 100 : 0;
        
        // Calculate accurate market cap using bonding curve (x*y=k)
        const virtualEth = parseFloat(ethers.formatEther(launch.virtualEthReserves));
        const initialVirtualEth = parseFloat(ethers.formatEther(launch.initialVirtualEthReserves));
        const initialVirtualTokens = parseFloat(ethers.formatEther(launch.initialVirtualTokenReserves));
        const realTokens = parseFloat(ethers.formatEther(launch.realTokenReserves));
        
        // Current price from bonding curve: price = virtualEth / realTokenReserves  
        const currentPrice = realTokens > 0 ? virtualEth / realTokens : 0;
        
        // Get totalSupply (usually 1B for pump tokens)
        let totalSupply = 1000000000; // 1B default
        try {
          const ts = await tokenContract.totalSupply();
          totalSupply = parseFloat(ethers.formatEther(ts));
        } catch (e) {}
        
        // Market cap formula: MC = initialVirtualEth × (totalSupply / initialVirtualTokens)
        // This gives the "fully diluted" market cap based on initial bonding curve setup
        const marketCap = initialVirtualTokens > 0 
          ? initialVirtualEth * (totalSupply / initialVirtualTokens)
          : currentPrice * totalSupply;
        
        tokens.push({
          address: launch.token, name, symbol, description: '',
          logo: image ? `https://cyan-bright-dormouse-440.mypinata.cloud/ipfs/${image}` : '',
          bondingProgress: Math.min(bondingProgress, 100),
          marketCap, currentPrice, isComplete: launch.complete
        });
        
        console.log(`  ✅ [${i+1}/15] $${symbol} - MC: ${marketCap.toFixed(2)} XPL`);
        if (i < 14) await delay(300);
      } catch (e) { 
        console.log(`  ❌ [${i+1}/15] Error:`, e.message);
        await delay(300); 
      }
    }
    
    tokens.sort((a, b) => b.marketCap - a.marketCap);
    launchedTokensCache = { tokens, total: tokens.length };
    cacheTimestamp = Date.now();
    console.log(`🎉 Cache preloaded with ${tokens.length} tokens`);
  } catch (error) {
    console.error('❌ Failed to preload cache:', error.message);
  }
}

// ============ REFERRAL VAULT - EIP-712 SIGNER ============
// Configuration (set via environment variables)
const VAULT_CONFIG = {
  signerPK: process.env.SIGNER_PK || null,
  vaultAddress: process.env.VAULT_ADDRESS || null,
  chainId: process.env.CHAIN_ID || '9745' // Plasma chain ID
};

// In-memory nonce tracker (use DB in production)
const nonces = new Map();

function nextNonce(referrer) {
  const prev = nonces.get(referrer.toLowerCase()) || 0n;
  const curr = prev + 1n;
  nonces.set(referrer.toLowerCase(), curr);
  return curr;
}

// EIP-712 domain (must match ReferralVault.sol)
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

// POST /api/sign-voucher - Sign a referral payout voucher
app.post('/api/sign-voucher', async (req, res) => {
  try {
    if (!VAULT_CONFIG.signerPK || !VAULT_CONFIG.vaultAddress) {
      return res.status(503).json({ 
        error: 'Vault not configured. Set SIGNER_PK and VAULT_ADDRESS env vars.' 
      });
    }

    const { referrer, token, amount, deadline, nonce } = req.body || {};

    // Validate inputs
    if (!ethers.isAddress(referrer)) {
      return res.status(400).json({ error: 'Invalid referrer address' });
    }
    
    const tokenAddr = token === 'native' || token === '0x0000000000000000000000000000000000000000' 
      ? '0x0000000000000000000000000000000000000000' 
      : token;
      
    if (tokenAddr !== '0x0000000000000000000000000000000000000000' && !ethers.isAddress(tokenAddr)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }
    
    if (!amount || BigInt(amount) <= 0n) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Check database balance for native token claims
    if (tokenAddr === '0x0000000000000000000000000000000000000000') {
      const summary = await db.getReferrerSummary(referrer);
      const payable = BigInt(summary.payable_wei);
      const requested = BigInt(amount);
      
      if (requested > payable) {
        return res.status(400).json({ 
          error: 'Insufficient balance',
          payable: payable.toString(),
          requested: requested.toString()
        });
      }
      
      // Update claimed amount in database
      await db.updateClaimedAmount(referrer, amount);
      console.log(`✅ Updated claimed amount for ${referrer}: ${ethers.formatEther(amount)} XPL`);
    }

    // Calculate deadline and nonce
    const now = Math.floor(Date.now() / 1000);
    const dl = deadline ? Number(deadline) : (now + 3600); // 1 hour default
    const n = nonce !== undefined ? BigInt(nonce) : nextNonce(referrer);

    // Create voucher value
    const value = {
      referrer: referrer,
      token: tokenAddr,
      amount: amount.toString(),
      nonce: n.toString(),
      deadline: dl
    };

    // Sign the voucher
    const wallet = new ethers.Wallet(VAULT_CONFIG.signerPK);
    const signature = await wallet.signTypedData(getVaultDomain(), vaultTypes, value);

    console.log(`✅ Signed voucher for ${referrer}: ${ethers.formatEther(amount)} tokens`);

    return res.json({
      signature,
      nonce: n.toString(),
      deadline: dl,
      referrer,
      token: tokenAddr,
      amount: amount.toString()
    });
  } catch (error) {
    console.error('❌ Error signing voucher:', error);
    return res.status(500).json({ error: 'Failed to sign voucher' });
  }
});

// GET /api/vault-info - Get vault configuration info
app.get('/api/vault-info', (req, res) => {
  if (!VAULT_CONFIG.vaultAddress) {
    return res.json({ 
      configured: false, 
      message: 'Vault not configured. Deploy ReferralVault.sol and set VAULT_ADDRESS.' 
    });
  }

  const wallet = VAULT_CONFIG.signerPK ? new ethers.Wallet(VAULT_CONFIG.signerPK) : null;
  
  res.json({
    configured: true,
    vaultAddress: VAULT_CONFIG.vaultAddress,
    chainId: VAULT_CONFIG.chainId,
    signerAddress: wallet ? wallet.address : 'Not set',
    domain: getVaultDomain()
  });
});

// ======== REFERRAL TRACKING ENDPOINTS ========

const db = require('./db');
const FEE_CONFIG = require('./config');

// POST /api/bind-referrer - Bind user to referrer
app.post('/api/bind-referrer', async (req, res) => {
  try {
    const { userAddress, referrerAddress } = req.body;
    
    if (!userAddress || !referrerAddress) {
      return res.status(400).json({ error: 'Missing userAddress or referrerAddress' });
    }
    
    // Check if user can't refer themselves
    if (userAddress.toLowerCase() === referrerAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }
    
    const binding = await db.bindReferrer(userAddress, referrerAddress);
    
    if (binding) {
      console.log(`✅ Bound user ${userAddress} to referrer ${referrerAddress}`);
      res.json({ success: true, binding });
    } else {
      // Already bound
      res.json({ success: true, message: 'Already bound to a referrer' });
    }
  } catch (error) {
    console.error('❌ Error binding referrer:', error);
    res.status(500).json({ error: 'Failed to bind referrer' });
  }
});

// POST /api/track-swap - Log swap and calculate fees using FEE_CONFIG
app.post('/api/track-swap', async (req, res) => {
  try {
    const { txHash, userAddress, grossAmountWei } = req.body;
    
    if (!txHash || !userAddress || !grossAmountWei) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Calculate fees using config
    const fees = FEE_CONFIG.calculateFees(grossAmountWei);
    
    // Get referrer for this user
    const referrerAddress = await db.getReferrer(userAddress);
    
    let platformCut, referrerCut;
    
    if (referrerAddress) {
      // Split according to config (default: 70% platform, 30% referrer)
      platformCut = fees.platformCutWei;
      referrerCut = fees.referrerCutWei;
    } else {
      // No referrer: 100% platform
      platformCut = fees.feeAmountWei;
      referrerCut = '0';
    }
    
    // Log the swap
    const swapLog = await db.logSwap(
      txHash,
      userAddress,
      referrerAddress,
      grossAmountWei,
      fees.feeAmountWei,
      platformCut,
      referrerCut
    );
    
    console.log(`✅ Tracked swap ${txHash}: Platform ${ethers.formatEther(platformCut)} XPL, Referrer ${ethers.formatEther(referrerCut)} XPL`);
    
    res.json({
      success: true,
      swap: swapLog,
      breakdown: {
        grossAmountWei: grossAmountWei,
        platformFeeWei: fees.feeAmountWei,
        platformCutWei: platformCut,
        referrerCutWei: referrerCut,
        referrerAddress
      }
    });
  } catch (error) {
    console.error('❌ Error tracking swap:', error);
    res.status(500).json({ error: 'Failed to track swap' });
  }
});

// GET /api/referrer/:address/summary - Get referrer earnings summary
app.get('/api/referrer/:address/summary', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({ error: 'Missing address' });
    }
    
    const summary = await db.getReferrerSummary(address);
    
    res.json({
      success: true,
      summary: {
        referrerAddress: summary.referrer_address,
        totalEarned: summary.total_earned_wei,
        totalClaimed: summary.total_claimed_wei,
        payable: summary.payable_wei,
        lastUpdated: summary.last_updated
      }
    });
  } catch (error) {
    console.error('❌ Error getting referrer summary:', error);
    res.status(500).json({ error: 'Failed to get referrer summary' });
  }
});

// GET /api/fee-config - Get current fee configuration
app.get('/api/fee-config', (req, res) => {
  res.json({
    success: true,
    config: FEE_CONFIG.getSummary()
  });
});

// ======== CUSTOM REFERRAL CODE ENDPOINTS ========

// POST /api/referrals/create-code - Create or update custom referral code
app.post('/api/referrals/create-code', async (req, res) => {
  try {
    const { walletAddress, referralCode } = req.body;
    
    if (!walletAddress || !referralCode) {
      return res.status(400).json({ error: 'Missing walletAddress or referralCode' });
    }
    
    const codeData = await db.setReferralCode(walletAddress, referralCode);
    console.log(`✅ Created referral code ${referralCode} for ${walletAddress}`);
    
    res.json({
      success: true,
      code: codeData
    });
  } catch (error) {
    console.error('❌ Error creating referral code:', error);
    res.status(400).json({ error: error.message || 'Failed to create referral code' });
  }
});

// GET /api/referrals/my-code/:address - Get custom referral code for wallet
app.get('/api/referrals/my-code/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({ error: 'Missing address' });
    }
    
    const codeData = await db.getReferralCode(address);
    const referralCount = await db.getReferralCount(address);
    
    res.json({
      success: true,
      code: codeData ? codeData.referral_code : null,
      data: codeData,
      referralCount: referralCount
    });
  } catch (error) {
    console.error('❌ Error getting referral code:', error);
    res.status(500).json({ error: 'Failed to get referral code' });
  }
});

// POST /api/referrals/bind-code - Bind user to referrer using referral code
app.post('/api/referrals/bind-code', async (req, res) => {
  try {
    const { userAddress, referralCode } = req.body;
    
    if (!userAddress || !referralCode) {
      return res.status(400).json({ error: 'Missing userAddress or referralCode' });
    }
    
    const binding = await db.bindReferrerByCode(userAddress, referralCode);
    
    if (binding) {
      console.log(`✅ Bound user ${userAddress} to referrer via code ${referralCode}`);
      res.json({ success: true, binding });
    } else {
      res.json({ success: true, message: 'Already bound to a referrer' });
    }
  } catch (error) {
    console.error('❌ Error binding by code:', error);
    res.status(400).json({ error: error.message || 'Failed to bind referral' });
  }
});

// Start server only if not in Vercel serverless environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Plasm X Swap Backend running on port ${PORT}`);
    console.log(`📊 Simple Token System - Symbols Only`);
    console.log(`🎯 Available tokens: ${PLASMA_TOKENS.map(t => t.symbol).join(', ')}`);
    
    // Show fee configuration
    const feeConfig = FEE_CONFIG.getSummary();
    console.log(`\n💰 Fee Configuration:`);
    console.log(`   Total DyorSwap Fee: ${feeConfig.totalFeePercent}%`);
    console.log(`   Referral Split: ${feeConfig.referralSharePercent}% (${feeConfig.referrerPercentOfTrade}% of trade)`);
    console.log(`   Platform Split: ${feeConfig.platformSharePercent}% (${feeConfig.platformPercentOfTrade}% of trade)`);
    console.log(`   Example: 100 XPL trade → ${feeConfig.example.totalFee} fee → ${feeConfig.example.referrerEarns} referrer + ${feeConfig.example.platformKeeps} platform\n`);
    
    if (VAULT_CONFIG.vaultAddress && VAULT_CONFIG.signerPK) {
      const wallet = new ethers.Wallet(VAULT_CONFIG.signerPK);
      console.log(`💰 Referral Vault: ${VAULT_CONFIG.vaultAddress}`);
      console.log(`🔐 Signer Address: ${wallet.address}`);
    } else {
      console.log(`⚠️  Referral Vault not configured (set VAULT_ADDRESS and SIGNER_PK)`);
    }
    
    // Preload cache in background (after 10 seconds to avoid rate limiting)
    setTimeout(() => preloadLaunchedTokens(), 10000);
  });
}

// Export for Vercel serverless
module.exports = app;