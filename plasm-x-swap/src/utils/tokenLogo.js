// Token logo fetching utilities

const LOGO_CACHE = new Map();

// Fallback logo for unknown tokens
const DEFAULT_TOKEN_LOGO = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiM0Yjc2ODgiLz4KPHN2ZyB4PSI2IiB5PSI2IiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01aDNWOGgydjRoM2wtMyAzeiIgZmlsbD0iI2ZmZmZmZiIvPgo8L3N2Zz4KPC9zdmc+';

// Known token logos for Plasma Network
const KNOWN_LOGOS = {
  'native': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMwMGE5OGYiLz4KPHN2ZyB4PSI0IiB5PSI0IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik0xMiA2TDYgMTBsNiA0IDYtNEwxMiA2eiIgZmlsbD0iI2ZmZmZmZiIvPgo8cGF0aCBkPSJNNiAxMGw2IDQgNi00djZsLTYgNC02LTRWMTB6IiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjciLz4KPC9zdmc+Cjwvc3ZnPg==',
  'XPL': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMwMGE5OGYiLz4KPHN2ZyB4PSI0IiB5PSI0IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik0xMiA2TDYgMTBsNiA0IDYtNEwxMiA2eiIgZmlsbD0iI2ZmZmZmZiIvPgo8cGF0aCBkPSJNNiAxMGw2IDQgNi00djZsLTYgNC02LTRWMTB6IiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjciLz4KPC9zdmc+Cjwvc3ZnPg==',
  'WXPL': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMwNzRjNjMiLz4KPHN2ZyB4PSI0IiB5PSI0IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik0xMiA2TDYgMTBsNiA0IDYtNEwxMiA2eiIgZmlsbD0iI2ZmZmZmZiIvPgo8cGF0aCBkPSJNNiAxMGw2IDQgNi00djZsLTYgNC02LTRWMTB6IiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjciLz4KPC9zdmc+Cjwvc3ZnPg==',
};

// Get logo from CoinGecko API (free tier)
async function getCoinGeckoLogo(contractAddress, symbol) {
  try {
    // For Plasma Network tokens, we need to check if CoinGecko has the logo
    // This is a simplified approach - in production you'd want to check the specific network
    const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${symbol}`);
    if (!response.ok) throw new Error('CoinGecko API error');
    
    const data = await response.json();
    if (data.coins && data.coins.length > 0) {
      const coin = data.coins.find(c => c.symbol.toLowerCase() === symbol.toLowerCase());
      if (coin && coin.large) {
        return coin.large; // High-res logo
      }
    }
  } catch (error) {
    console.log(`🔍 CoinGecko lookup failed for ${symbol}:`, error.message);
  }
  return null;
}

// Get logo from Trust Wallet assets (GitHub)
async function getTrustWalletLogo(contractAddress, chainId = '1') {
  try {
    if (!contractAddress || contractAddress === 'native') return null;
    
    // Trust Wallet asset URL format
    const assetUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${contractAddress}/logo.png`;
    
    // Check if image exists
    const response = await fetch(assetUrl, { method: 'HEAD' });
    if (response.ok) {
      return assetUrl;
    }
  } catch (error) {
    console.log(`🔍 Trust Wallet lookup failed for ${contractAddress}:`, error.message);
  }
  return null;
}

// Get logo from 1inch token list
async function get1inchLogo(contractAddress, chainId = '1') {
  try {
    if (!contractAddress || contractAddress === 'native') return null;
    
    const response = await fetch(`https://tokens.1inch.io/v1.2/${chainId}/${contractAddress}`);
    if (!response.ok) throw new Error('1inch API error');
    
    const data = await response.json();
    if (data.logoURI) {
      return data.logoURI;
    }
  } catch (error) {
    console.log(`🔍 1inch lookup failed for ${contractAddress}:`, error.message);
  }
  return null;
}

// Main function to get token logo
export async function getTokenLogo(token) {
  try {
    const { address, symbol, name } = token;
    const cacheKey = `${address || 'native'}_${symbol}`;
    
    // Check cache first
    if (LOGO_CACHE.has(cacheKey)) {
      return LOGO_CACHE.get(cacheKey);
    }
    
    console.log(`🖼️ Fetching logo for ${symbol} (${address || 'native'})`);
    
    // Check known logos first
    if (KNOWN_LOGOS[symbol] || KNOWN_LOGOS[address]) {
      const logo = KNOWN_LOGOS[symbol] || KNOWN_LOGOS[address];
      LOGO_CACHE.set(cacheKey, logo);
      return logo;
    }
    
    // Try multiple sources
    let logo = null;
    
    // 1. Try CoinGecko (good for popular tokens)
    if (!logo && symbol) {
      logo = await getCoinGeckoLogo(address, symbol);
    }
    
    // 2. Try Trust Wallet (good for ERC-20 tokens)
    if (!logo && address && address !== 'native') {
      logo = await getTrustWalletLogo(address);
    }
    
    // 3. Try 1inch (good for DEX tokens)
    if (!logo && address && address !== 'native') {
      logo = await get1inchLogo(address);
    }
    
    // 4. Fallback to default
    if (!logo) {
      logo = DEFAULT_TOKEN_LOGO;
    }
    
    // Cache the result
    LOGO_CACHE.set(cacheKey, logo);
    console.log(`✅ Logo resolved for ${symbol}:`, logo.substring(0, 50) + '...');
    
    return logo;
    
  } catch (error) {
    console.error(`❌ Error fetching token logo for ${token.symbol}:`, error);
    return DEFAULT_TOKEN_LOGO;
  }
}

// Clear cache (useful for development/testing)
export function clearLogoCache() {
  LOGO_CACHE.clear();
}

// Preload logos for better UX
export async function preloadTokenLogos(tokens) {
  const promises = tokens.map(token => getTokenLogo(token));
  await Promise.allSettled(promises);
}