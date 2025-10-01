// Contract interaction utilities for PlasmXDEX
import { ethers } from 'ethers'
import { toWei, fromWei, applySlippageBps, calculateFeeBps, calculateConditionalFee, safeLog } from '../utils/bigintHelpers.js'
import { DYORSWAP_ROUTER_ABI } from './dyorswapABI.js';

// Uniswap V2 Router ABI for DyorSwap
export const DYOR_ROUTER_ABI = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)",
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function removeLiquidityETH(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountToken, uint amountETH)",
  "function factory() external pure returns (address)",
  "function WETH() external pure returns (address)"
];

// Uniswap V2 Pair ABI  
export const PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)"
];

// Factory ABI
export const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  "function createPair(address tokenA, address tokenB) external returns (address pair)"
];

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

// WXPL contract ABI for wrapping/unwrapping
export const WXPL_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 amount)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

// PumpFactory ABI - for detecting and getting bonding curve info
export const PUMP_FACTORY_ABI = [
  "function isPumps(address) external view returns (bool)",
  "function getLaunchInfo(address) external view returns (tuple(address owner, address token, uint256 realEthReserves, uint256 realTokenReserves, uint256 initialVirtualEthReserves, uint256 initialVirtualTokenReserves, uint256 virtualEthReserves, uint256 liquidityEth, uint256 liquidityToken, bool complete))",
  "function launchsForAll(bool _desc, uint256 _start, uint256 _end) external view returns (tuple(address owner, address token, uint256 realEthReserves, uint256 realTokenReserves, uint256 initialVirtualEthReserves, uint256 initialVirtualTokenReserves, uint256 virtualEthReserves, uint256 liquidityEth, uint256 liquidityToken, bool complete)[] launches, uint256 total)"
];

// PumpRouter V3 ABI - ACTUAL from plasmascan.to
export const PUMP_ROUTER_ABI = [
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] memory path, address to, uint deadline) payable",  // NO team params
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, address team, uint256 teamRatePercent, uint256 deadline)"  // HAS team params
];

// PumpToken ABI - for getting bonding curve reserves
export const PUMP_TOKEN_ABI = [
  "function getVirtualReserves() external view returns (uint256 _reserve0, uint256 _reserve1)",
  "function getRealReserves() external view returns (uint256 _reserve0, uint256 _reserve1)",
  "function complete() external view returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function description() view returns (string)",
  "function image() view returns (string)",
  "function website() view returns (string)",
  "function telegram() view returns (string)",
  "function twitter() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// DyorSwap v2 contract addresses on Plasma Chain - addresses provided by user
export const CONTRACT_ADDRESSES = {
  // DyorSwap v2 Router on Plasma - user provided address
  ROUTER: '0xfc9869eF6E04e8dcF09234Ad0bC48a6f78a493cC',
  
  // DyorSwap v2 Factory on Plasma - confirmed from router contract
  FACTORY: '0xA9F2c3E18E22F19E6c2ceF49A88c79bcE5b482Ac', // DyorSwap Factory (REAL)
  
  // DyorSwap Pump (Bonding Curve) Contracts - Launch token platform
  PUMP_FACTORY: '0x5a96508c1092960dA0981CaC7FD00217E9CdabEC', // PumpFactory V2
  PUMP_ROUTER: '0xFc794E944dfcB8db141a9222A29d8834CcF556CB', // PumpRouter V3 (trying this for billions)
  
  // WXPL - Wrapped XPL on Plasma - user provided address
  WXPL: '0x6100e367285b01f48d07953803a2d8dca5d19873',
  
  // Token addresses on Plasma Chain
  TOKENS: {
    XPL: 'native', // Native XPL on Plasma
    trillions: '0x92A01Ab7317Ac318b39b00EB6704ba56F0245D7a', // Trillions token on Plasma
    USDT0: '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb' // USDT0 on Plasma
  }
}

// PLATFORM FEE CONFIGURATION - Frontend fee extraction for ALL swaps
export const PLATFORM_FEE_CONFIG = {
  feeBps: 200, // 2% platform fee (200 basis points)
  feeRecipient: '0x022ac0f0505be925e3863bb3af5f4c3aaacff1b0', // Platform wallet (100% collected, manual referrer distribution)
  // Fee-exempt tokens (wrapping/unwrapping only)
  feeExemptTokens: [
    '0x6100e367285b01f48d07953803a2d8dca5d19873', // WXPL (exempt for XPL ↔ WXPL wrapping)
  ]
}

/**
 * Extract platform fee from XPL input amount BEFORE swap
 * For swaps without on-chain team parameter support (PumpRouter BUY, DyorSwap ALL)
 * @param {string} xplAmount - XPL amount user wants to spend
 * @param {object} signer - Ethers signer
 * @returns {object} - { feeAmount, swapAmount, feeReceipt }
 */
export async function extractPlatformFeeFromXPL(xplAmount, signer) {
  try {
    const xplAmountWei = ethers.parseEther(xplAmount.toString());
    const feeWei = (xplAmountWei * BigInt(PLATFORM_FEE_CONFIG.feeBps)) / 10000n;
    const swapAmountWei = xplAmountWei - feeWei;
    
    console.log('💰 Extracting platform fee from XPL:', {
      totalXPL: ethers.formatEther(xplAmountWei),
      platformFee: ethers.formatEther(feeWei),
      swapAmount: ethers.formatEther(swapAmountWei),
      feeRecipient: PLATFORM_FEE_CONFIG.feeRecipient
    });
    
    // Send fee to platform wallet
    const feeTx = await signer.sendTransaction({
      to: PLATFORM_FEE_CONFIG.feeRecipient,
      value: feeWei
    });
    
    console.log('⏳ Platform fee transaction sent:', feeTx.hash);
    const feeReceipt = await feeTx.wait();
    console.log('✅ Platform fee collected:', feeReceipt.hash);
    
    return {
      feeAmount: ethers.formatEther(feeWei),
      swapAmount: ethers.formatEther(swapAmountWei),
      swapAmountWei: swapAmountWei,
      feeReceipt: feeReceipt
    };
  } catch (error) {
    console.error('❌ Fee extraction failed:', error);
    throw error;
  }
}

// Network configurations 
export const NETWORK_CONFIGS = {
  PLASMA: {
    chainId: '0x2611', // 9745 in hex
    chainName: 'Plasma Network',
    nativeCurrency: {
      name: 'Plasma',
      symbol: 'XPL',
      decimals: 18
    },
    rpcUrls: ['https://rpc.plasma.to'],
    blockExplorerUrls: ['https://plasmascan.to']
  },
  BSC: {
    chainId: '0x38', // 56 in hex
    chainName: 'BNB Smart Chain',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  BLAST: {
    chainId: '0x13e31', // 81457 in hex
    chainName: 'Blast',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.blast.io'],
    blockExplorerUrls: ['https://blastscan.io'],
  },
  ZETA: {
    chainId: '0x1b59', // 7001 in hex 
    chainName: 'ZetaChain Mainnet',
    nativeCurrency: {
      name: 'ZETA',
      symbol: 'ZETA',
      decimals: 18,
    },
    rpcUrls: ['https://zetachain-evm.blockpi.network/v1/rpc/public'],
    blockExplorerUrls: ['https://zetachain.blockscout.com'],
  }
};

// Plasma Chain configuration for DyorSwap deployment
export const PLASMA_CONFIG = {
  chainId: 9745,
  chainName: 'Plasma Network',
  rpcUrl: 'https://rpc.plasma.to',
  explorerUrl: 'https://plasmascan.to',
  nativeCurrency: {
    name: 'Plasma',
    symbol: 'XPL',
    decimals: 18
  }
};

// Default provider for Plasma chain  
export const getPlasmaProvider = () => {
  try {
    const provider = new ethers.JsonRpcProvider(PLASMA_CONFIG.rpcUrl, {
      chainId: PLASMA_CONFIG.chainId,
      name: PLASMA_CONFIG.chainName
    });
    console.log(`🌐 Created Plasma provider for:`, PLASMA_CONFIG.rpcUrl);
    return provider;
  } catch (error) {
    console.error(`❌ Failed to create provider:`, error);
    throw error;
  }
};

/**
 * Get router contract instance
 */
export function getRouterContract(provider) {
  return new ethers.Contract(CONTRACT_ADDRESSES.ROUTER, DYOR_ROUTER_ABI, provider);
}

/**
 * Get factory contract instance
 */
export function getFactoryContract(provider) {
  return new ethers.Contract(CONTRACT_ADDRESSES.FACTORY, FACTORY_ABI, provider);
}

/**
 * Get pair contract instance
 */
export function getPairContract(pairAddress, provider) {
  return new ethers.Contract(pairAddress, PAIR_ABI, provider);
}

/**
 * Get token contract instance by symbol (for default tokens)
 */
export function getTokenContract(tokenSymbol, provider) {
  const tokenAddress = CONTRACT_ADDRESSES.TOKENS[tokenSymbol];
  if (!tokenAddress) {
    throw new Error(`Token contract not found for ${tokenSymbol}. Available tokens: ${Object.keys(CONTRACT_ADDRESSES.TOKENS).join(', ')}`);
  }
  if (tokenAddress === 'native') {
    throw new Error(`Cannot create native token ${tokenSymbol}. Use provider.getBalance() instead.`);
  }
  return new ethers.Contract(tokenAddress, ERC20_ABI, provider);
}

/**
 * Get token contract instance by address (for custom tokens)
 */
export function getTokenContractByAddress(tokenAddress, provider) {
  if (!ethers.isAddress(tokenAddress)) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }
  if (tokenAddress === 'native') {
    throw new Error(`Cannot create native token contract. Use provider.getBalance() instead.`);
  }
  return new ethers.Contract(tokenAddress, ERC20_ABI, provider);
}

/**
 * Get token contract instance - handles both symbols and addresses
 */
export function getTokenContractSmart(tokenData, provider) {
  // If it's a token object with address property
  if (typeof tokenData === 'object' && tokenData.address) {
    if (tokenData.address === 'native') {
      throw new Error(`Cannot create native token contract. Use provider.getBalance() instead.`);
    }
    return getTokenContractByAddress(tokenData.address, provider);
  }
  
  // If it's a string that looks like an address
  if (typeof tokenData === 'string' && ethers.isAddress(tokenData)) {
    return getTokenContractByAddress(tokenData, provider);
  }
  
  // Otherwise try symbol lookup
  if (typeof tokenData === 'string') {
    return getTokenContract(tokenData, provider);
  }
  
  throw new Error(`Invalid token data: ${JSON.stringify(tokenData)}`);
}

/**
 * Get real-time XPL price and provide USD value
 */
async function getXPLPrice() {
  try {
    // Get ETH price as proxy for XPL (until we find XPL's real price feed)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );
    
    if (!response.ok) {
      throw new Error('Price API unavailable');
    }
    
    const data = await response.json();
    return data.ethereum?.usd || 0;
  } catch (error) {
    console.error('Error fetching XPL price:', error);
    return 0;
  }
}

/**
 * For XPL-only pairs, just return USD equivalent
 */
async function getRealTimePrice(inputToken, outputToken, inputAmount) {
  try {
    if (inputToken === 'XPL' && outputToken === 'XPL') {
      return inputAmount.toString(); // Same token
    }
    
    // For now, only XPL is confirmed to exist on Plasma
    // Return error for unsupported pairs
    throw new Error(`Unsupported token pair: ${inputToken}-${outputToken}. Only XPL is confirmed on Plasma chain.`);
  } catch (error) {
    console.error('Error fetching real-time price:', error);
    throw error;
  }
}

/**
 * Resolve token address for DyorSwap router calls
 */
async function resolveTokenAddress(token, router) {
  if (token === 'native' || token === 'XPL') {
    // Use the correct WXPL address provided by user
    return CONTRACT_ADDRESSES.WXPL;
  }
  
  // Return checksum address for ERC20 tokens
  return ethers.getAddress(token);
}

/**
 * Resolve swap path through DyorSwap factory
 */
async function resolveSwapPath(inputTokenAddr, outputTokenAddr, provider) {
  try {
    console.log(`🛣️ Enhanced routing: ${inputTokenAddr} -> ${outputTokenAddr}`);
    
    // Special debug for USDT0
    if (inputTokenAddr.includes('b8ce59fc') || outputTokenAddr.includes('b8ce59fc')) {
      console.log(`🔍 USDT0 ROUTING DEBUG: ${inputTokenAddr} -> ${outputTokenAddr}`);
    }
    
    // Use direct factory address for better reliability
    const factory = new ethers.Contract(CONTRACT_ADDRESSES.FACTORY, FACTORY_ABI, provider);
    const WXPL = ethers.getAddress(CONTRACT_ADDRESSES.WXPL);
    
    // Normalize addresses
    const tokenIn = ethers.getAddress(inputTokenAddr);
    const tokenOut = ethers.getAddress(outputTokenAddr);
    
    // Same token check
    if (tokenIn === tokenOut) {
      throw new Error('Same token swap not allowed');
    }
    
    // Try direct pair first
    console.log(`🔍 Checking direct pair: ${tokenIn} <-> ${tokenOut}`);
    const directPair = await factory.getPair(tokenIn, tokenOut);
    if (directPair && directPair !== ethers.ZeroAddress) {
      console.log(`✅ Direct pair found: ${directPair}`);
      return [tokenIn, tokenOut];
    }
    
    // Try routing through WXPL (skip if one token IS WXPL)
    if (tokenIn !== WXPL && tokenOut !== WXPL) {
      console.log(`🔍 Trying WXPL route: ${tokenIn} -> WXPL -> ${tokenOut}`);
      
      const inputToWXPL = await factory.getPair(tokenIn, WXPL);
      const WXPLToOutput = await factory.getPair(WXPL, tokenOut);
      
      if (inputToWXPL !== ethers.ZeroAddress && WXPLToOutput !== ethers.ZeroAddress) {
        console.log(`✅ WXPL route found: ${tokenIn} -> ${WXPL} -> ${tokenOut}`);
        return [tokenIn, WXPL, tokenOut];
      }
    }
    
    console.error(`❌ No route found for ${tokenIn} -> ${tokenOut}`);
    throw new Error('NO_LIQUIDITY_ROUTE');
    
  } catch (error) {
    console.error('❌ Enhanced routing failed:', error);
    throw new Error(`No liquidity available for ${inputTokenAddr} -> ${outputTokenAddr}`);
  }
}

/**
 * Check if a token is a PumpToken (bonding curve launch token)
 */
export async function isPumpToken(tokenAddress, provider) {
  try {
    const finalProvider = provider || getPlasmaProvider();
    const pumpFactory = new ethers.Contract(
      CONTRACT_ADDRESSES.PUMP_FACTORY,
      PUMP_FACTORY_ABI,
      finalProvider
    );
    
    const isPump = await pumpFactory.isPumps(tokenAddress);
    console.log(`🔍 Token ${tokenAddress} is PumpToken: ${isPump}`);
    return isPump;
  } catch (error) {
    console.error('Error checking if token is PumpToken:', error);
    return false;
  }
}

/**
 * Get PumpToken bonding curve info
 */
export async function getPumpTokenInfo(tokenAddress, provider) {
  try {
    const finalProvider = provider || getPlasmaProvider();
    const pumpFactory = new ethers.Contract(
      CONTRACT_ADDRESSES.PUMP_FACTORY,
      PUMP_FACTORY_ABI,
      finalProvider
    );
    
    const info = await pumpFactory.getLaunchInfo(tokenAddress);
    console.log(`📊 PumpToken ${tokenAddress} info:`, {
      owner: info.owner,
      realEthReserves: ethers.formatEther(info.realEthReserves),
      realTokenReserves: ethers.formatEther(info.realTokenReserves),
      virtualEthReserves: ethers.formatEther(info.virtualEthReserves),
      complete: info.complete
    });
    
    return {
      owner: info.owner,
      token: info.token,
      realEthReserves: info.realEthReserves,
      realTokenReserves: info.realTokenReserves,
      initialVirtualEthReserves: info.initialVirtualEthReserves,
      initialVirtualTokenReserves: info.initialVirtualTokenReserves,
      virtualEthReserves: info.virtualEthReserves,
      liquidityEth: info.liquidityEth,
      liquidityToken: info.liquidityToken,
      complete: info.complete
    };
  } catch (error) {
    console.error('Error getting PumpToken info:', error);
    return null;
  }
}

/**
 * Calculate quote for PumpToken using bonding curve (constant product formula with virtual reserves)
 */
export async function getPumpTokenQuote(inputToken, outputToken, inputAmount, provider) {
  try {
    const finalProvider = provider || getPlasmaProvider();
    const amount = parseFloat(inputAmount);
    
    // Determine which token is the PumpToken
    const inputAddr = typeof inputToken === 'object' ? inputToken.address : inputToken;
    const outputAddr = typeof outputToken === 'object' ? outputToken.address : outputToken;
    
    // Check which is PumpToken
    const isInputPump = await isPumpToken(inputAddr, finalProvider);
    const isOutputPump = await isPumpToken(outputAddr, finalProvider);
    
    let pumpTokenAddr, pumpInfo;
    
    if (isOutputPump) {
      // Buying PumpToken with XPL
      pumpTokenAddr = outputAddr;
      pumpInfo = await getPumpTokenInfo(pumpTokenAddr, finalProvider);
      
      if (!pumpInfo) {
        throw new Error('Could not get PumpToken info');
      }
      
      // Check if already bonded to DEX
      if (pumpInfo.complete) {
        console.log(`🎓 PumpToken ${pumpTokenAddr} has GRADUATED to DEX - use regular swap`);
        return null; // Fall back to regular DEX
      }
      
      // Use virtual reserves for bonding curve calculation
      const ethReserve = pumpInfo.virtualEthReserves;
      const tokenReserve = pumpInfo.realTokenReserves;
      
      // Amount in (XPL in wei) - NO FEE for PumpTokens
      const amountInWei = toWei(amount.toString());
      
      // Constant product: x * y = k
      // amountOut = (amountIn * tokenReserve) / (ethReserve + amountIn)
      const numerator = amountInWei * tokenReserve;
      const denominator = ethReserve + amountInWei;
      const amountOut = numerator / denominator;
      
      // Apply 0.3% fee (similar to Uniswap)
      const amountOutWithFee = (amountOut * 997n) / 1000n;
      
      const outputAmount = fromWei(amountOutWithFee.toString());
      console.log(`💎 PumpToken BUY quote: ${amount} XPL -> ${outputAmount} tokens`);
      return outputAmount;
      
    } else if (isInputPump) {
      // Selling PumpToken for XPL
      pumpTokenAddr = inputAddr;
      pumpInfo = await getPumpTokenInfo(pumpTokenAddr, finalProvider);
      
      if (!pumpInfo) {
        throw new Error('Could not get PumpToken info');
      }
      
      // Check if already bonded to DEX
      if (pumpInfo.complete) {
        console.log(`🎓 PumpToken ${pumpTokenAddr} has GRADUATED to DEX - use regular swap`);
        return null; // Fall back to regular DEX
      }
      
      // Use virtual reserves for bonding curve calculation
      const ethReserve = pumpInfo.virtualEthReserves;
      const tokenReserve = pumpInfo.realTokenReserves;
      
      // Amount in (tokens in wei)
      const amountInWei = toWei(amount.toString());
      
      // Constant product: x * y = k
      // amountOut = (amountIn * ethReserve) / (tokenReserve + amountIn)
      const numerator = amountInWei * ethReserve;
      const denominator = tokenReserve + amountInWei;
      const amountOut = numerator / denominator;
      
      // Apply 0.3% fee (similar to Uniswap)
      const amountOutWithFee = (amountOut * 997n) / 1000n;
      
      // CRITICAL FIX: Subtract PumpRouter team fee (2% reasonable buffer) that's applied inside the contract
      // This accounts for any hidden fees in the contract without being too conservative
      const amountOutAfterTeamFee = (amountOutWithFee * 98n) / 100n;
      
      const outputAmount = fromWei(amountOutAfterTeamFee.toString());
      console.log(`💎 PumpToken SELL quote: ${amount} tokens -> ${outputAmount} XPL (with 2% buffer)`);
      return outputAmount;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting PumpToken quote:', error);
    return null;
  }
}

/**
 * Validate swap route and amounts before execution
 */
async function validateSwapRoute(path, amountInWei, router) {
  try {
    console.log(`🔍 Validating swap route:`, path);
    
    // Check if we can get amounts out (this validates liquidity)
    const amounts = await router.getAmountsOut(amountInWei, path);
    const outputAmount = amounts[amounts.length - 1];
    
    if (outputAmount === 0n) {
      throw new Error('ZERO_OUTPUT_AMOUNT');
    }
    
    console.log(`✅ Route validation successful - output: ${outputAmount.toString()}`);
    return { valid: true, amounts };
    
  } catch (error) {
    console.error(`❌ Route validation failed:`, error);
    
    if (error.message.includes('INSUFFICIENT_LIQUIDITY')) {
      throw new Error('NO_LIQUIDITY_AMOUNTS');
    } else if (error.message.includes('INSUFFICIENT_INPUT_AMOUNT')) {
      throw new Error('INSUFFICIENT_INPUT_AMOUNT');
    } else {
      throw new Error('ROUTE_VALIDATION_FAILED');
    }
  }
}

/**
 * Get real-time quote from DyorSwap router - PURE BLOCKCHAIN CALLS
 */
export async function getQuote(inputToken, outputToken, inputAmount, provider) {
  console.log(`🚀 QUOTE START: Getting real DyorSwap quote: ${inputAmount} ${inputToken} -> ${outputToken}`);
  console.log(`📊 Function called with params:`, { inputToken, outputToken, inputAmount, provider: !!provider });
  
  // Special debug for USDT0 quotes
  if (inputToken.includes('b8ce59fc') || outputToken.includes('b8ce59fc') || 
      inputToken === 'USDT0' || outputToken === 'USDT0') {
    console.log(`🔍 USDT0 DEBUG: Input=${inputToken}, Output=${outputToken}, Amount=${inputAmount}`);
    console.log(`🔍 USDT0 FORCED DEBUG - This is definitely a USDT0 quote!!!`);
  }
  
  try {
    
    
    // Validate input amount
    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      console.log(`❌ Invalid amount: ${inputAmount}`);
      return "0";
    }
    
    // Extract addresses - Handle both string and object inputs
    const inputAddr = typeof inputToken === 'object' ? inputToken.address : inputToken;
    const outputAddr = typeof outputToken === 'object' ? outputToken.address : outputToken;
    
    // Same token - no swap needed
    if (inputAddr === outputAddr || 
        (inputAddr === 'native' && outputAddr === 'XPL') ||
        (inputAddr === 'XPL' && outputAddr === 'native')) {
      console.log(`✅ Same token, returning: ${amount}`);
      return amount.toString();
    }

    // XPL ↔ WXPL conversion (1:1 wrapping/unwrapping)
    
    if ((inputAddr === 'native' || inputAddr === 'XPL') && outputAddr === CONTRACT_ADDRESSES.WXPL) {
      console.log(`✅ XPL → WXPL conversion (1:1), returning: ${amount}`);
      return amount.toString();
    }
    if (inputAddr === CONTRACT_ADDRESSES.WXPL && (outputAddr === 'native' || outputAddr === 'XPL')) {
      console.log(`✅ WXPL → XPL conversion (1:1), returning: ${amount}`);
      return amount.toString();
    }

    // Use provided provider or create Plasma provider 
    const finalProvider = provider || getPlasmaProvider();
    
    // Wait for provider to be ready
    await finalProvider._detectNetwork();
    
    // 🚀 CHECK FOR PUMPTOKEN FIRST (bonding curve launch tokens)
    // PumpTokens have their own pricing mechanism and don't use regular DEX pools
    console.log(`🔍 Checking if tokens are PumpTokens...`);
    
    // Check if one side is XPL/native OR WXPL (since WXPL can unwrap to XPL for PumpToken trading)
    const isXPLInput = (inputAddr === 'native' || inputAddr === 'XPL');
    const isXPLOutput = (outputAddr === 'native' || outputAddr === 'XPL');
    const isWXPLInput = (inputAddr === CONTRACT_ADDRESSES.WXPL);
    const isWXPLOutput = (outputAddr === CONTRACT_ADDRESSES.WXPL);
    
    if (isXPLInput || isXPLOutput || isWXPLInput || isWXPLOutput) {
      let tokenToCheck = null;
      
      // Determine which token to check for PumpToken
      if (isXPLInput && !isWXPLOutput) {
        tokenToCheck = outputAddr;
      } else if (isXPLOutput && !isWXPLInput) {
        tokenToCheck = inputAddr;
      } else if (isWXPLInput && !isXPLOutput && !isWXPLOutput) {
        // WXPL → Something (check if Something is PumpToken)
        tokenToCheck = outputAddr;
      } else if (isWXPLOutput && !isXPLInput && !isWXPLInput) {
        // Something → WXPL (check if Something is PumpToken)
        tokenToCheck = inputAddr;
      }
      
      if (tokenToCheck && tokenToCheck !== CONTRACT_ADDRESSES.WXPL) {
        // HARDCODED: billions token is bonded
        const BILLIONS_ADDRESS = '0x083922be65426083f829ffFFEe79Eef6ce3B384c';
        const isBillions = tokenToCheck.toLowerCase() === BILLIONS_ADDRESS.toLowerCase();
        
        const isPump = isBillions || await isPumpToken(tokenToCheck, finalProvider);
        
        if (isPump) {
          console.log(`💎 PumpToken detected! Using bonding curve quote... ${isBillions ? '(HARDCODED billions)' : ''}`);
          
          // If input is WXPL, treat as XPL for PumpToken quote (1:1 unwrap)
          const actualInput = isWXPLInput ? 'native' : inputToken;
          const actualOutput = isWXPLOutput ? 'native' : outputToken;
          
          const pumpQuote = await getPumpTokenQuote(actualInput, actualOutput, inputAmount, finalProvider);
          
          if (pumpQuote !== null) {
            console.log(`✅ PumpToken quote successful: ${pumpQuote}`);
            return pumpQuote;
          } else {
            console.log(`⚠️ PumpToken quote failed, falling back to regular DEX`);
          }
        }
      }
    }
    
    // Get router contract
    const router = new ethers.Contract(CONTRACT_ADDRESSES.ROUTER, DYORSWAP_ROUTER_ABI, finalProvider);
    console.log(`🏗️ Using router contract:`, CONTRACT_ADDRESSES.ROUTER);
    console.log(`🌐 Provider network:`, await finalProvider.getNetwork());
    
    // Resolve token addresses
    const inputTokenAddr = await resolveTokenAddress(inputToken, router);
    const outputTokenAddr = await resolveTokenAddress(outputToken, router);
    
    console.log(`🔗 Resolved addresses: ${inputTokenAddr} -> ${outputTokenAddr}`);
    
    // Get input token decimals - Use resolved addresses, not symbols!
    let inputDecimals = 18; // Default for native tokens
    if (inputTokenAddr !== 'native' && inputTokenAddr !== 'XPL') {
      const inputTokenContract = new ethers.Contract(inputTokenAddr, ERC20_ABI, finalProvider);
      inputDecimals = await inputTokenContract.decimals();
      console.log(`📊 Input token decimals fetched: ${inputDecimals} for ${inputTokenAddr}`);
    }
    
    // Get output token decimals  
    let outputDecimals = 18; // Default for native tokens
    if (outputTokenAddr !== 'native' && outputTokenAddr !== 'XPL') {
      const outputTokenContract = new ethers.Contract(outputTokenAddr, ERC20_ABI, finalProvider);
      outputDecimals = await outputTokenContract.decimals();
      console.log(`📊 Output token decimals fetched: ${outputDecimals} for ${outputTokenAddr}`);
    }
    
    console.log(`📊 Token decimals: ${inputDecimals} -> ${outputDecimals}`);
    
    // Convert input amount to wei, adjusting for platform fee if XPL→token swap
    let amountInWei = ethers.parseUnits(amount.toString(), inputDecimals);
    
    // For XPL→token swaps, quote with post-fee amount (deduct 0.1% unless token is exempt)
    if (inputToken === 'native' || inputToken === 'XPL') {
      const platformFeeXPL = calculateConditionalFee(
        amountInWei, 
        PLATFORM_FEE_CONFIG.feeBps, 
        inputToken, 
        outputToken, 
        PLATFORM_FEE_CONFIG.feeExemptTokens
      );
      const postFeeAmount = amountInWei - platformFeeXPL;
      
      if (platformFeeXPL > 0) {
        safeLog('💰 XPL→token quote adjustment (fee applied):', {
          totalInput: fromWei(amountInWei, 18),
          platformFee: fromWei(platformFeeXPL, 18),
          postFeeAmount: fromWei(postFeeAmount, 18)
        });
      } else {
        console.log('💰 No fee applied - stable token or WXPL detected');
      }
      
      amountInWei = postFeeAmount; // Use post-fee amount for router quote
    }
    
    console.log(`💰 Amount in wei for quote: ${amountInWei.toString()}`);
    
    // Resolve swap path
    const path = await resolveSwapPath(inputTokenAddr, outputTokenAddr, finalProvider);
    console.log(`🛣️ Swap path:`, path);
    
    // Get amounts out from router with retry logic for volatile tokens
    console.log(`🔄 Calling router.getAmountsOut with:`, { amountInWei: amountInWei.toString(), path });
    
    let amounts, outputAmountWei;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        amounts = await router.getAmountsOut(amountInWei, path);
        outputAmountWei = amounts[amounts.length - 1];
        console.log(`✅ Quote successful on attempt ${retryCount + 1}`);
        break;
      } catch (error) {
        retryCount++;
        console.log(`⚠️ Quote attempt ${retryCount} failed:`, error.message);
        
        if (retryCount >= maxRetries) {
          console.log(`❌ All quote attempts failed for volatile token`);
          // Return a conservative estimate for volatile tokens
          const conservativeOutput = BigInt(Math.floor(amount * 0.95 * Math.pow(10, 18))); // 95% of input as fallback
          console.log(`🔄 Using conservative fallback estimate: ${ethers.formatEther(conservativeOutput)}`);
          return ethers.formatEther(conservativeOutput);
        }
        
        // Wait a bit before retry for price to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`📈 Router amounts:`, amounts.map(a => a.toString()));
    console.log(`💎 Output amount wei:`, outputAmountWei.toString());
    
    // Convert output amount from wei to human readable
    const outputAmount = ethers.formatUnits(outputAmountWei, outputDecimals);
    
    // Preserve precision for very small amounts instead of rounding to 0.000000
    const numAmount = parseFloat(outputAmount);
    let result;
    
    if (numAmount === 0) {
      result = "0";
    } else if (numAmount < 1e-6) {
      // For very small amounts, use scientific notation or more decimals
      result = numAmount.toExponential(6);
    } else if (numAmount < 1) {
      // For amounts less than 1, show more decimal places
      result = numAmount.toPrecision(6);
    } else {
      // For normal amounts, use 6 decimal places
      result = numAmount.toFixed(6);
    }
    
    // Platform fee info for display only (actual fee already handled in BigInt calculation above)
    let platformFeeAmountXPL = 0;
    let userReceiveAmount = parseFloat(result);
    
    // The fee was already deducted in the BigInt calculation above for XPL input swaps
    // This is just for logging/display purposes
    if (inputToken === 'native' || inputToken === 'XPL') {
      // Check if this token pair had fee applied (was calculated earlier)
      const isTokenExempt = PLATFORM_FEE_CONFIG.feeExemptTokens.some(exemptToken =>
        exemptToken.toLowerCase() === outputToken.toLowerCase()
      );
      
      if (!isTokenExempt) {
        // Fee was applied during quote calculation for display purposes
        platformFeeAmountXPL = parseFloat(amount) * (PLATFORM_FEE_CONFIG.feeBps / 10000);
      }
    }
    
    console.log(`✅ DyorSwap result: ${amount} ${inputToken} = ${result} ${outputToken}`);
    
    
    if (platformFeeAmountXPL > 0) {
      console.log(`💰 Platform fee: ${platformFeeAmountXPL.toFixed(6)} XPL (0.1%)`);
    } else {
      console.log(`💰 No fee applied - stable token or WXPL`);
    }
    console.log(`📊 User receives: ${userReceiveAmount.toFixed(6)} ${outputToken}`);
    
    return userReceiveAmount.toFixed(6);
    
  } catch (error) {
    console.error('❌ DyorSwap quote error:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Error code:', error.code);
    
    // Return meaningful error for UI
    if (error.message.includes('No liquidity')) {
      console.log('💡 No liquidity available for this pair');
      return "0";
    }
    
    if (error.message.includes('INSUFFICIENT_LIQUIDITY')) {
      console.log('💡 Insufficient liquidity in pool');
      return "0";
    }
    
    // Fallback for other errors
    console.log('🔄 Using fallback calculation');
    return "0";
  }
}

/**
 * Calculate price impact
 */
export function calculatePriceImpact(inputAmount, inputReserve, outputReserve) {
  const exactPrice = outputReserve / inputReserve;
  const actualPrice = calculateSwapOutput(inputAmount, inputReserve, outputReserve) / inputAmount;
  return Math.abs((exactPrice - actualPrice) / exactPrice) * 100;
}

/**
 * DyorSwap-style logo fetching - production ready
 */
async function getTokenLogo(contractAddress, symbol) {
  const address = contractAddress?.toLowerCase();
  const sym = symbol?.toLowerCase();
  
  // DyorSwap token registry (like how real DEXs handle it)
  const plasmaTokenRegistry = {
    'xpl': 'https://raw.githubusercontent.com/PlasmNetwork/polkadot-ethereum/master/assets/logo.png',
    'trillions': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iMTYiIGZpbGw9IiNGRjYzMDAiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik04IDJMMTQgNlY0SDE0VjEySDE0TDggMTRMMiAxMlYxMEg0VjZIMlY0TDggMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo8L3N2Zz4='
  };

  // Known token logos (fast lookup)
  if (plasmaTokenRegistry[sym]) {
    return plasmaTokenRegistry[sym];
  }

  // DyorSwap uses a simple, reliable approach
  const logoUrls = [
    // Primary: Simple, working sources
    `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/ethereum/assets/${contractAddress}/logo.png`,
    `https://tokens.1inch.io/${address}.png`,
    // Fallback: Generic token icon
    `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM4QjVDRjYiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSI+Cjx0ZXh0IHg9IjgiIHk9IjEyIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+JHtzeW1ib2wuY2hhckF0KDApLnRvVXBwZXJDYXNlKCl9PC90ZXh0Pgo8L3N2Zz4KPC9zdmc+`
  ];

  // Simple approach - try each URL, return first working one
  for (const url of logoUrls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return url;
      }
    } catch (error) {
      continue;
    }
  }
  
  // Fallback: SVG with token symbol
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#8B5CF6"/>
      <text x="16" y="20" font-family="Arial" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${symbol.charAt(0).toUpperCase()}</text>
    </svg>
  `)}`;
}

/**
 * Get token info from contract address using Plasma RPC
 */
export async function getTokenInfo(contractAddress, provider = null) {
  try {
    if (contractAddress === 'native') {
      return {
        symbol: 'XPL',
        name: 'Plasma',
        decimals: 18,
        address: 'native',
        logoUrl: 'https://plasm.io/img/plasm-icon.png' // Real Plasma logo
      };
    }

    // Validate address format
    if (!ethers.isAddress(contractAddress)) {
      throw new Error('Invalid contract address');
    }

    // Use Plasma provider if none provided
    const finalProvider = provider || getPlasmaProvider();
    
    const tokenContract = new ethers.Contract(contractAddress, ERC20_ABI, finalProvider);
    
    try {
      const [symbol, name, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.name(), 
        tokenContract.decimals()
      ]);

      // Try to fetch token logo
      const logoUrl = await getTokenLogo(contractAddress, symbol);

      return {
        symbol,
        name,
        decimals: Number(decimals),
        address: contractAddress,
        logoUrl
      };
    } catch (contractError) {
      console.error('Contract call failed:', contractError);
      
      // Check if this is the DyorSwap router
      if (contractAddress.toLowerCase() === '0xfc9869ef6e04e8dcf09234ad0bc48a6f78a493cc') {
        throw new Error('This is the DyorSwap router contract, not a token. Please paste a token contract address instead.');
      }
      
      throw new Error(`This contract doesn't appear to be a valid ERC20 token. Make sure you're pasting a token contract address, not a DEX or other type of contract.`);
    }
  } catch (error) {
    console.error('Error getting token info:', error);
    throw error;
  }
}

/**
 * Get ERC20 token balance by address (for custom/meme tokens)
 */
export async function getERC20BalanceByAddress(tokenAddress, userAddress, provider) {
  try {
    console.log(`💰 Getting balance for token: ${tokenAddress}`);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [balance, decimals] = await Promise.all([
      tokenContract.balanceOf(userAddress),
      tokenContract.decimals()
    ]);
    const formatted = ethers.formatUnits(balance, decimals);
    console.log(`✅ Balance: ${formatted}`);
    return formatted;
  } catch (error) {
    console.error(`Error getting balance for ${tokenAddress}:`, error);
    return '0.0';
  }
}

/**
 * Get token balance (supports both symbol and address)
 */
export async function getTokenBalance(tokenSymbolOrAddress, userAddress, provider) {
  try {
    // Native XPL
    if (tokenSymbolOrAddress === 'XPL' || tokenSymbolOrAddress === 'native') {
      const balance = await provider.getBalance(userAddress);
      return ethers.formatEther(balance);
    }
    
    // If it's an address (starts with 0x), use address-based fetching
    if (tokenSymbolOrAddress.startsWith('0x')) {
      return await getERC20BalanceByAddress(tokenSymbolOrAddress, userAddress, provider);
    }
    
    // Otherwise use symbol-based fetching (for default tokens)
    const tokenContract = getTokenContractSmart(tokenSymbolOrAddress, provider);
    const balance = await tokenContract.balanceOf(userAddress);
    const decimals = await tokenContract.decimals();
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    console.error(`Error getting ${tokenSymbolOrAddress} balance:`, error);
    return '0.0';
  }
}

/**
 * Approve token spending
 */
export async function approveToken(tokenSymbol, spenderAddress, amount, signer) {
  try {
    const tokenContract = getTokenContractSmart(tokenSymbol, signer);
    const decimals = await tokenContract.decimals();
    const amountInWei = ethers.parseUnits(amount.toString(), decimals);
    
    const tx = await tokenContract.approve(spenderAddress, amountInWei);
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error) {
    console.error(`Error approving ${tokenSymbol}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Execute XPL to PumpToken swap using PumpRouter (bonding curve)
 */
export async function swapXPLForPumpTokens(tokenAddress, xplAmount, minTokens, signer) {
  try {
    console.log('💎 SwapXPLForPumpTokens called:', { tokenAddress, xplAmount, minTokens });
    
    // STEP 1: Extract 2% platform fee FIRST
    console.log('💰 Extracting 2% platform fee from input...');
    const feeResult = await extractPlatformFeeFromXPL(xplAmount, signer);
    console.log('✅ Fee extracted:', feeResult.feeAmount, 'XPL');
    
    // STEP 2: Swap remaining amount (98% of original)
    const tokenContract = new ethers.Contract(tokenAddress, PUMP_TOKEN_ABI, signer);
    const decimals = await tokenContract.decimals();
    const minTokensInWei = ethers.parseUnits(minTokens.toString(), decimals);
    
    // Adjust minTokens for 98% of original amount (since we took 2% fee)
    const adjustedMinTokens = (minTokensInWei * 98n) / 100n;
    
    const pumpRouter = new ethers.Contract(
      CONTRACT_ADDRESSES.PUMP_ROUTER,
      PUMP_ROUTER_ABI,
      signer
    );
    
    // Get WXPL address for path
    const regularRouter = getRouterContract(signer);
    const wxplAddress = await regularRouter.WETH();
    const path = [wxplAddress, tokenAddress];
    
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    
    console.log('💎 PumpToken BUY details (after 2% fee extracted):', {
      originalXPL: xplAmount,
      feeExtracted: feeResult.feeAmount,
      swapAmount: feeResult.swapAmount,
      swapAmountWei: feeResult.swapAmountWei.toString(),
      adjustedMinTokens: adjustedMinTokens.toString(),
      path,
      to: await signer.getAddress(),
      deadline
    });
    
    const tx = await pumpRouter.swapExactETHForTokensSupportingFeeOnTransferTokens(
      adjustedMinTokens,
      path,
      await signer.getAddress(),
      deadline,
      { value: feeResult.swapAmountWei }  // Use 98% amount (after fee)
    );
    
    console.log('⏳ PumpToken buy transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ PumpToken buy confirmed:', receipt);
    
    return { 
      success: true, 
      txHash: receipt.hash,
      feeExtracted: feeResult.feeAmount,
      feeTxHash: feeResult.feeReceipt.hash
    };
  } catch (error) {
    console.error('❌ PumpToken buy failed:', error);
    throw error;
  }
}

/**
 * Execute PumpToken to XPL swap using PumpRouter (bonding curve)
 */
export async function swapPumpTokensForXPL(tokenAddress, tokenAmount, minXPL, signer) {
  try {
    console.log('💎 SwapPumpTokensForXPL called:', { tokenAddress, tokenAmount, minXPL });
    
    const tokenContract = new ethers.Contract(tokenAddress, PUMP_TOKEN_ABI, signer);
    const decimals = await tokenContract.decimals();
    
    // Sell 99.5% to avoid anti-whale edge cases
    const tokenAmountInWeiFull = ethers.parseUnits(tokenAmount.toString(), decimals);
    const tokenAmountInWei = (tokenAmountInWeiFull * 995n) / 1000n;
    
    // CRITICAL: Use minOut = 0n for taxed tokens (getAmountsOut doesn't include sell tax!)
    const minXPLInWei = 0n;
    
    const pumpRouter = new ethers.Contract(
      CONTRACT_ADDRESSES.PUMP_ROUTER,
      PUMP_ROUTER_ABI,
      signer
    );
    
    // Check and approve if needed
    const userAddress = await signer.getAddress();
    const currentAllowance = await tokenContract.allowance(userAddress, pumpRouter.target);
    
    if (currentAllowance < tokenAmountInWei) {
      console.log('📝 Approving PumpToken for PumpRouter...');
      const approveTx = await tokenContract.approve(pumpRouter.target, ethers.MaxUint256);
      await approveTx.wait();
      console.log('✅ PumpToken approved');
    }
    
    // Get WXPL address for path (router will unwrap to XPL automatically)
    const regularRouter = getRouterContract(signer);
    const wxplAddress = await regularRouter.WETH();
    const path = [tokenAddress, wxplAddress];
    
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    
    // Team parameters - Platform fee collection (2% of swap = 200 basis points)
    const teamAddress = '0x022ac0f0505be925e3863bb3af5f4c3aaacff1b0';  // Platform wallet (100% collected, manual referrer distribution)
    const teamRatePercent = 200n;  // 2% fee (200 basis points = 2%)
    
    console.log('💎 PumpToken sell details (V3 CORRECT format):', {
      amountIn: tokenAmountInWei.toString(),
      amountInHuman: ethers.formatUnits(tokenAmountInWei, decimals),
      amountOutMin: minXPLInWei.toString(),
      minOutNote: 'Using 0n for taxed tokens (getAmountsOut excludes tax)',
      path,
      to: await signer.getAddress(),
      team: teamAddress,
      teamRate: teamRatePercent,
      deadline
    });
    
    // PumpRouter V3 - ACTUAL working parameter order from DyorSwap transaction
    // (amountIn, amountOutMin, path, to, team, teamRatePercent, deadline)
    console.log('🚀 Calling PumpRouter.swapExactTokensForETHSupportingFeeOnTransferTokens...');
    const tx = await pumpRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
      tokenAmountInWei,      // amountIn
      minXPLInWei,           // amountOutMin
      path,                  // path array
      await signer.getAddress(), // to
      teamAddress,          // team address (position 5)
      teamRatePercent,      // team rate (position 6)
      deadline              // deadline (position 7)
    );
    
    console.log('⏳ PumpToken sell transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ PumpToken sell confirmed:', receipt);
    
    return { success: true, txHash: receipt.hash };
  } catch (error) {
    console.error('❌ PumpToken sell failed with error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    if (error.data) {
      console.error('❌ Error data:', error.data);
    }
    throw error;
  }
}

/**
 * Execute XPL to token swap using DyorSwap router
 */
export async function swapXPLForTokens(tokenSymbol, xplAmount, minTokens, signer) {
  try {
    console.log('💱 SwapXPLForTokens called:', { tokenSymbol, xplAmount, minTokens })
    
    // Validate inputs
    if (isNaN(xplAmount) || xplAmount <= 0) {
      throw new Error(`Invalid XPL amount: ${xplAmount}`)
    }
    if (isNaN(minTokens) || minTokens < 0) {
      throw new Error(`Invalid minimum tokens: ${minTokens}`)
    }
    
    // Add timeout wrapper for transaction
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Transaction timeout - please try again')), 60000) // 60 second timeout
    })
    
    const router = getRouterContract(signer);
    const wethAddress = await router.WETH();
    
    // Create path: XPL (ETH) -> Token  
    let tokenAddress;
    if (CONTRACT_ADDRESSES.TOKENS[tokenSymbol]) {
      tokenAddress = CONTRACT_ADDRESSES.TOKENS[tokenSymbol];
    } else {
      // Assume tokenSymbol is actually an address for custom tokens
      tokenAddress = tokenSymbol;
    }
    
    // Use resolveSwapPath for dynamic routing (supports multi-hop for custom tokens)
    const provider = signer.provider || getPlasmaProvider();
    const path = await resolveSwapPath(wethAddress, tokenAddress, provider);
    
    if (!path || path.length === 0) {
      throw new Error(`No trading path found for XPL to ${tokenSymbol}`);
    }
    
    // CRITICAL DEBUG: Check the actual values being passed
    console.log('🔍 DEBUGGING VALUES:', {
      xplAmount_raw: xplAmount,
      xplAmount_type: typeof xplAmount,
      xplAmount_string: xplAmount.toString(),
      minTokens_raw: minTokens,
      minTokens_type: typeof minTokens
    });
    
    const xplAmountInWei = ethers.parseEther(xplAmount.toString());
    console.log('💰 CRITICAL DEBUG - XPL Amount in Wei:', {
      original: xplAmount,
      converted: xplAmountInWei.toString(),
      formatted: ethers.formatEther(xplAmountInWei)
    });
    
    // Check if this is WXPL wrap (no fees)
    const isWXPLWrap = tokenAddress.toLowerCase() === CONTRACT_ADDRESSES.WXPL.toLowerCase();
    
    // STEP 1: Extract 2% platform fee FIRST (unless WXPL wrap)
    let feeResult = null;
    let actualSwapAmount = xplAmountInWei;
    
    if (!isWXPLWrap) {
      console.log('💰 Extracting 2% platform fee from XPL input...');
      feeResult = await extractPlatformFeeFromXPL(xplAmount, signer);
      actualSwapAmount = feeResult.swapAmountWei;
      console.log('✅ Fee extracted:', feeResult.feeAmount, 'XPL');
    } else {
      console.log('🔄 WXPL wrap detected - NO FEES');
    }
    
    // For token output, get the token contract to determine decimals
    const tokenContract = getTokenContractSmart(tokenSymbol, signer);
    const decimals = await tokenContract.decimals();
    const minTokensInWei = ethers.parseUnits(minTokens.toString(), decimals);
    
    // Adjust minOut for fee deduction (unless WXPL)
    const adjustedMinOut = isWXPLWrap ? minTokensInWei : (minTokensInWei * 98n) / 100n;
    
    // Set deadline to 20 minutes from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    
    console.log('💱 Swap details:', {
      xplAmountInWei: xplAmountInWei.toString(),
      minTokensInWei: minTokensInWei.toString(),
      path,
      decimals,
      deadline
    });
    
    // Check user balance before attempting swap
    const signerAddress = await signer.getAddress();
    const userBalance = await signer.provider.getBalance(signerAddress);
    console.log('💰 User XPL balance:', ethers.formatEther(userBalance));
    console.log('💰 Swap amount needed:', ethers.formatEther(xplAmountInWei));
    
    // Get user's token balance BEFORE swap (to calculate fee on only new tokens)
    const tokenBalanceBefore = await tokenContract.balanceOf(signerAddress);
    console.log(`📊 User ${tokenSymbol} balance before swap: ${ethers.formatUnits(tokenBalanceBefore, decimals)}`);
    
    // Use SIMPLE fixed gas limits - increased for reliability
    console.log('⛽ Using proven gas amounts...');
    const gasLimit = BigInt(450000); // Increased to 450k gas - proven working amount
    
    // Simple balance check - just verify user has enough for swap
    if (userBalance < xplAmountInWei) {
      const needed = ethers.formatEther(xplAmountInWei);
      const have = ethers.formatEther(userBalance);
      throw new Error(`Insufficient balance. Need ${needed} XPL for swap, but only have ${have} XPL`);
    }
    
    console.log('🚀 Using fixed gas limit for reliability:', gasLimit.toString());
    
    const userAddress = signerAddress;
    
    console.log('🔧 Safe swap parameters:', {
      inputXPL: ethers.formatEther(actualSwapAmount),
      minTokensOut: ethers.formatUnits(adjustedMinOut, decimals),
      feeExtracted: feeResult ? feeResult.feeAmount + ' XPL' : 'None (WXPL wrap)',
      slippageTolerance: 'From UI settings (already applied)'
    });
    
    // Execute swap with actual amount (after fee extraction)
    const txPromise = router.swapExactETHForTokens(
      adjustedMinOut, // Adjusted for fee (98% if fee was extracted)
      path,
      userAddress,
      deadline,
      { 
        value: actualSwapAmount, // 98% of original if fee was extracted, 100% for WXPL
        gasLimit: gasLimit
      }
    );
    
    const tx = await Promise.race([txPromise, timeoutPromise]);
    
    console.log('📝 Transaction sent:', tx.hash);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('✅ Swap transaction confirmed:', receipt.transactionHash);
    console.log('✅ Swap completed successfully!');
    
    const result = { success: true, txHash: receipt.transactionHash };
    
    // Include fee info if fee was collected
    if (feeResult) {
      result.feeExtracted = feeResult.feeAmount;
      result.feeTxHash = feeResult.feeReceipt.hash;
      console.log('💰 Platform fee collected:', feeResult.feeAmount, 'XPL');
    }
    
    return result;
  } catch (error) {
    console.error(`Error swapping XPL for ${tokenSymbol}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Execute generic multi-hop token-to-token swap with dynamic routing
 */
export async function swapTokensForTokensGeneric(fromToken, toToken, tokenAmount, minTokensOut, signer) {
  try {
    console.log('💱 SwapTokensForTokensGeneric called:', { 
      fromToken: fromToken.symbol, 
      toToken: toToken.symbol, 
      tokenAmount, 
      minTokensOut 
    })
    
    // Validate inputs
    if (isNaN(tokenAmount) || tokenAmount <= 0) {
      throw new Error(`Invalid token amount: ${tokenAmount}`)
    }
    if (isNaN(minTokensOut) || minTokensOut < 0) {
      throw new Error(`Invalid minimum tokens out: ${minTokensOut}`)
    }
    
    const router = getRouterContract(signer);
    const signerAddress = await signer.getAddress();
    
    // Handle native XPL properly
    const fromTokenAddress = fromToken.address === 'native' ? 'ETH' : fromToken.address;
    const toTokenAddress = toToken.address === 'native' ? 'ETH' : toToken.address;
    
    console.log('🛣️ Resolving swap path for:', {
      from: fromTokenAddress,
      to: toTokenAddress,
      fromSymbol: fromToken.symbol,
      toSymbol: toToken.symbol
    });
    
    // Use existing resolveSwapPath logic for dynamic routing
    const provider = signer.provider || getPlasmaProvider();
    const swapPath = await resolveSwapPath(fromTokenAddress, toTokenAddress, provider);
    
    if (!swapPath || swapPath.length === 0) {
      throw new Error(`No trading path found between ${fromToken.symbol} and ${toToken.symbol}`)
    }
    
    console.log('✅ Found swap path:', swapPath);
    
    // Convert amounts to proper decimals
    const fromDecimals = fromToken.decimals || 18;
    const toDecimals = toToken.decimals || 18;
    
    const tokenAmountInWei = ethers.parseUnits(tokenAmount.toString(), fromDecimals);
    const minTokensOutInWei = ethers.parseUnits(minTokensOut.toString(), toDecimals);
    
    // Check and handle approvals for ERC-20 tokens
    if (fromToken.address !== 'native') {
      console.log('🔐 Checking ERC-20 approval...');
      const fromTokenContract = getTokenContractSmart(fromToken, signer);
      const routerAddress = await router.getAddress();
      
      const currentAllowance = await fromTokenContract.allowance(signerAddress, routerAddress);
      console.log('💰 Current allowance:', ethers.formatUnits(currentAllowance, fromDecimals));
      
      if (currentAllowance < tokenAmountInWei) {
        console.log('📝 Approving tokens for router (unlimited)...');
        const approveTx = await fromTokenContract.approve(routerAddress, ethers.MaxUint256);
        await approveTx.wait();
        console.log('✅ Unlimited token approval confirmed - no need to approve again!');
      }
    }
    
    // Check user balance before attempting swap
    let userBalance;
    if (fromToken.address === 'native') {
      userBalance = await signer.provider.getBalance(signerAddress);
      console.log(`💰 User ${fromToken.symbol} balance:`, ethers.formatEther(userBalance));
    } else {
      const fromTokenContract = getTokenContractSmart(fromToken, signer);
      userBalance = await fromTokenContract.balanceOf(signerAddress);
      console.log(`💰 User ${fromToken.symbol} balance:`, ethers.formatUnits(userBalance, fromDecimals));
    }
    
    // Set deadline to 20 minutes from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    
    console.log('💱 Generic multi-hop swap details:', {
      tokenAmountInWei: tokenAmountInWei.toString(),
      minTokensOutInWei: minTokensOutInWei.toString(),
      path: swapPath,
      fromDecimals,
      toDecimals,
      deadline
    });
    
    // Use HIGHER gas limits for multi-hop FeeOnTransferTokens swaps
    console.log('⛽ Setting increased gas for multi-hop swap with fee support...');
    const gasLimit = BigInt(900000); // Higher for multi-hop FeeOnTransferTokens
    const gasPrice = await signer.provider.getFeeData();
    const maxFeePerGas = gasPrice.maxFeePerGas;
    const maxPriorityFeePerGas = gasPrice.maxPriorityFeePerGas;
    
    let tx;
    let feeResult = null;
    let actualSwapAmount = tokenAmountInWei;
    let adjustedMinOut = minTokensOutInWei;
    let balanceBefore = 0n;
    
    // For Token → XPL swaps, record balance BEFORE to calculate received amount
    if (toToken.address === 'native') {
      balanceBefore = await signer.provider.getBalance(signerAddress);
      console.log('📊 XPL balance before swap:', ethers.formatEther(balanceBefore));
    }
    
    // Check if this is a WXPL wrap/unwrap (no fees for these)
    const isWXPLWrap = fromToken.address === 'native' && toToken.address.toLowerCase() === CONTRACT_ADDRESSES.WXPL.toLowerCase();
    const isWXPLUnwrap = toToken.address === 'native' && fromToken.address.toLowerCase() === CONTRACT_ADDRESSES.WXPL.toLowerCase();
    const skipFees = isWXPLWrap || isWXPLUnwrap;
    
    // Choose appropriate swap method based on path type
    if (fromToken.address === 'native') {
      // XPL → Token swap - EXTRACT 2% FEE FIRST (unless WXPL wrap)
      if (!skipFees) {
        console.log('💰 DyorSwap: Extracting 2% platform fee from XPL input...');
        feeResult = await extractPlatformFeeFromXPL(ethers.formatEther(tokenAmountInWei), signer);
        actualSwapAmount = feeResult.swapAmountWei;
        adjustedMinOut = (minTokensOutInWei * 98n) / 100n;  // Adjust for 2% fee deduction
      } else {
        console.log('🔄 WXPL wrap detected - NO FEES');
      }
      
      const feeNote = skipFees ? '(NO FEES)' : '(after 2% fee extracted)';
      console.log(`🚀 Executing XPL → Token multi-hop swap ${feeNote}...`);
      tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        adjustedMinOut,
        swapPath,
        signerAddress,
        deadline,
        {
          value: actualSwapAmount,  // Use 98% (after fee)
          gasLimit,
          maxFeePerGas,
          maxPriorityFeePerGas
        }
      );
    } else if (toToken.address === 'native') {
      // Token → XPL swap - Will extract 2% fee from OUTPUT after swap (unless WXPL unwrap)
      if (skipFees) {
        console.log('🚀 Executing WXPL unwrap (NO FEES)...');
      } else {
        console.log('🚀 Executing Token → XPL multi-hop swap (will extract 2% fee from output)...');
      }
      tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
        tokenAmountInWei,
        minTokensOutInWei,
        swapPath,
        signerAddress,
        deadline,
        {
          gasLimit,
          maxFeePerGas,
          maxPriorityFeePerGas
        }
      );
    } else {
      // Token → Token swap (ALL ERC-20 ↔ ERC-20 including WXPL ↔ trillions)
      console.log('🚀 Executing Token → Token multi-hop swap...');
      tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        tokenAmountInWei,
        minTokensOutInWei,
        swapPath,
        signerAddress,
        deadline,
        {
          gasLimit,
          maxFeePerGas,
          maxPriorityFeePerGas
        }
      );
    }
    
    console.log('📝 Generic multi-hop swap transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Generic multi-hop swap confirmed in block:', receipt.blockNumber);
    
    const result = {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    };
    
    // Include fee extraction details if fee was collected from INPUT (XPL → Token)
    if (feeResult) {
      result.feeExtracted = feeResult.feeAmount;
      result.feeTxHash = feeResult.feeReceipt.hash;
      console.log('💰 Platform fee extracted from INPUT:', feeResult.feeAmount, 'XPL');
    }
    
    // Extract 2% fee from OUTPUT for Token → XPL swaps (DyorSwap only, skip for WXPL unwrap)
    if (toToken.address === 'native' && !feeResult && !skipFees && balanceBefore > 0n) {
      console.log('💰 Extracting 2% fee from XPL OUTPUT...');
      try {
        // Get user's XPL balance AFTER swap
        const balanceAfter = await signer.provider.getBalance(signerAddress);
        console.log('📊 XPL balance after swap:', ethers.formatEther(balanceAfter));
        
        // Calculate received XPL (after - before, accounting for gas)
        // Note: balanceAfter includes the swap output minus gas costs
        const gasUsed = receipt.gasUsed * (gasPrice.maxFeePerGas || gasPrice.gasPrice);
        const receivedXPL = balanceAfter - balanceBefore + gasUsed;
        
        console.log('📈 XPL received from swap:', ethers.formatEther(receivedXPL));
        
        // Calculate 2% fee from received amount
        const feeAmount = (receivedXPL * BigInt(PLATFORM_FEE_CONFIG.feeBps)) / 10000n;
        
        // Only extract if fee is meaningful (> 0.001 XPL)
        if (feeAmount > ethers.parseEther('0.001')) {
          console.log('💸 Sending 2% fee to platform:', ethers.formatEther(feeAmount), 'XPL');
          
          const feeTx = await signer.sendTransaction({
            to: PLATFORM_FEE_CONFIG.feeRecipient,
            value: feeAmount
          });
          
          console.log('⏳ Output fee transaction sent:', feeTx.hash);
          const feeReceipt = await feeTx.wait();
          console.log('✅ Output fee collected:', feeReceipt.hash);
          
          result.feeExtracted = ethers.formatEther(feeAmount);
          result.feeTxHash = feeReceipt.hash;
        } else {
          console.log('⚠️ Fee amount too small, skipping extraction');
        }
      } catch (feeError) {
        console.error('⚠️ Output fee extraction failed (non-critical):', feeError.message);
        // Don't fail the whole swap if fee extraction fails
      }
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Generic multi-hop swap error (${fromToken.symbol} → ${toToken.symbol}):`, error);
    return {
      success: false,
      error: error.message || 'Generic multi-hop swap failed'
    };
  }
}

/**
 * Execute multi-hop token-to-token swap: Token A → XPL → Token B
 */
export async function swapTokensForTokens(fromTokenSymbol, toTokenSymbol, tokenAmount, minTokensOut, signer) {
  try {
    console.log('💱 SwapTokensForTokens called:', { fromTokenSymbol, toTokenSymbol, tokenAmount, minTokensOut })
    
    // Validate inputs
    if (isNaN(tokenAmount) || tokenAmount <= 0) {
      throw new Error(`Invalid token amount: ${tokenAmount}`)
    }
    if (isNaN(minTokensOut) || minTokensOut < 0) {
      throw new Error(`Invalid minimum tokens out: ${minTokensOut}`)
    }
    
    const router = getRouterContract(signer);
    const wethAddress = await router.WETH();
    
    // Get token addresses
    let fromTokenAddress, toTokenAddress;
    
    if (CONTRACT_ADDRESSES.TOKENS[fromTokenSymbol]) {
      fromTokenAddress = CONTRACT_ADDRESSES.TOKENS[fromTokenSymbol];
    } else {
      fromTokenAddress = fromTokenSymbol; // Assume it's an address
    }
    
    if (CONTRACT_ADDRESSES.TOKENS[toTokenSymbol]) {
      toTokenAddress = CONTRACT_ADDRESSES.TOKENS[toTokenSymbol];
    } else {
      toTokenAddress = toTokenSymbol; // Assume it's an address
    }
    
    // Create multi-hop path: Token A → WETH → Token B
    const path = [fromTokenAddress, wethAddress, toTokenAddress];
    
    console.log('🛣️ Multi-hop path:', {
      from: fromTokenAddress,
      through: wethAddress,
      to: toTokenAddress,
      path
    });
    
    // Get token contracts for decimals
    const fromTokenContract = getTokenContractSmart(fromTokenSymbol, signer);
    const toTokenContract = getTokenContractSmart(toTokenSymbol, signer);
    
    const fromDecimals = await fromTokenContract.decimals();
    const toDecimals = await toTokenContract.decimals();
    
    const tokenAmountInWei = ethers.parseUnits(tokenAmount.toString(), fromDecimals);
    const minTokensOutInWei = ethers.parseUnits(minTokensOut.toString(), toDecimals);
    
    // Set deadline to 20 minutes from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    
    console.log('💱 Multi-hop swap details:', {
      tokenAmountInWei: tokenAmountInWei.toString(),
      minTokensOutInWei: minTokensOutInWei.toString(),
      path,
      fromDecimals,
      toDecimals,
      deadline
    });
    
    // Check user balance before attempting swap
    const signerAddress = await signer.getAddress();
    const userTokenBalance = await fromTokenContract.balanceOf(signerAddress);
    console.log(`💰 User ${fromTokenSymbol} balance:`, ethers.formatUnits(userTokenBalance, fromDecimals));
    console.log(`💰 Swap amount needed:`, ethers.formatUnits(tokenAmountInWei, fromDecimals));
    
    // Use SIMPLE fixed gas limits
    console.log('⛽ Using proven gas amounts...');
    const gasLimit = BigInt(600000); // Higher for multi-hop
    const gasPrice = await signer.provider.getFeeData();
    const maxFeePerGas = gasPrice.maxFeePerGas;
    const maxPriorityFeePerGas = gasPrice.maxPriorityFeePerGas;
    
    // Execute multi-hop swap
    console.log('🚀 Executing multi-hop swap with swapExactTokensForTokens...');
    const tx = await router.swapExactTokensForTokens(
      tokenAmountInWei,
      minTokensOutInWei,
      path,
      signerAddress,
      deadline,
      {
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas
      }
    );
    
    console.log('📝 Multi-hop swap transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Multi-hop swap confirmed in block:', receipt.blockNumber);
    
    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    };
    
  } catch (error) {
    console.error(`❌ Multi-hop swap error (${fromTokenSymbol} → ${toTokenSymbol}):`, error);
    return {
      success: false,
      error: error.message || 'Multi-hop swap failed'
    };
  }
}

/**
 * Execute token to XPL swap using DyorSwap router
 */
export async function swapTokensForXPL(tokenSymbol, tokenAmount, minXPL, signer) {
  try {
    console.log('💱 SwapTokensForXPL called:', { tokenSymbol, tokenAmount, minXPL })
    
    // Validate inputs
    if (isNaN(tokenAmount) || tokenAmount <= 0) {
      throw new Error(`Invalid token amount: ${tokenAmount}`)
    }
    if (isNaN(minXPL) || minXPL < 0) {
      throw new Error(`Invalid minimum XPL: ${minXPL}`)
    }
    
    const router = getRouterContract(signer);
    const tokenContract = getTokenContractSmart(tokenSymbol, signer);
    const userAddress = await signer.getAddress();
    
    console.log('📋 Pre-swap checks:');
    console.log(`👤 User address: ${userAddress}`);
    console.log(`🏪 Router address: ${router.target}`);
    console.log(`🪙 Token contract: ${tokenContract.target}`);
    
    // Check user's token balance first
    const userBalance = await tokenContract.balanceOf(userAddress);
    const decimals = await tokenContract.decimals();
    let tokenAmountInWei = ethers.parseUnits(tokenAmount.toString(), decimals);
    
    console.log(`💰 User ${tokenSymbol} balance: ${ethers.formatUnits(userBalance, decimals)}`);
    console.log(`💸 Trying to swap: ${ethers.formatUnits(tokenAmountInWei, decimals)}`);
    
    // Fix precision issue: if amount is very close to balance, use actual balance
    const balanceDifference = userBalance - tokenAmountInWei;
    const tolerance = ethers.parseUnits("0.01", decimals); // Larger tolerance for UI rounding
    
    // Check if we're within tolerance (either slightly over OR under)
    const absDifference = balanceDifference < 0n ? -balanceDifference : balanceDifference;
    
    if (absDifference <= tolerance) {
      console.log(`🔧 Precision fix: Requested ${ethers.formatUnits(tokenAmountInWei, decimals)} but have ${ethers.formatUnits(userBalance, decimals)}. Using actual balance (diff: ${ethers.formatUnits(absDifference, decimals)})`);
      tokenAmountInWei = userBalance;
    } else if (userBalance < tokenAmountInWei) {
      const userBalanceFormatted = ethers.formatUnits(userBalance, decimals);
      const requestedFormatted = ethers.formatUnits(tokenAmountInWei, decimals);
      throw new Error(`Insufficient ${tokenSymbol} balance. Have: ${userBalanceFormatted}, Need: ${requestedFormatted}`);
    }
    
    const wethAddress = await router.WETH();
    
    // Create path: Token -> XPL (ETH)
    let tokenAddress;
    if (CONTRACT_ADDRESSES.TOKENS[tokenSymbol]) {
      tokenAddress = CONTRACT_ADDRESSES.TOKENS[tokenSymbol];
    } else {
      // Assume tokenSymbol is actually an address for custom tokens
      tokenAddress = tokenSymbol;
    }
    
    // Use resolveSwapPath for dynamic routing (supports multi-hop for custom tokens)
    const provider = signer.provider || getPlasmaProvider();
    const path = await resolveSwapPath(tokenAddress, wethAddress, provider);
    
    if (!path || path.length === 0) {
      throw new Error(`No trading path found for ${tokenSymbol} to XPL`);
    }
    
    const minXPLInWei = ethers.parseEther(minXPL.toString());
    
    console.log(`🛣️ Swap path (${path.length} hops): ${path.join(' -> ')}`);
    console.log(`📊 Amount in wei: ${tokenAmountInWei.toString()}`);
    console.log(`📊 Min XPL in wei: ${minXPLInWei.toString()}`);
    
    // Check current allowance
    const currentAllowance = await tokenContract.allowance(userAddress, router.target);
    console.log(`🔓 Current allowance: ${ethers.formatUnits(currentAllowance, decimals)}`);
    
    if (currentAllowance < tokenAmountInWei) {
      console.log('📝 Approving router to spend tokens (unlimited for convenience)...');
      // Use MAX uint256 for unlimited approval (one-time approval for all future swaps)
      const maxApproval = ethers.MaxUint256;
      const approvalTx = await tokenContract.approve(router.target, maxApproval);
      console.log('⏳ Waiting for approval transaction...');
      await approvalTx.wait();
      console.log('✅ Unlimited approval confirmed - no need to approve again!');
    } else {
      console.log('✅ Sufficient allowance already exists');
    }
    
    // Check if this is WXPL unwrap (no fees for WXPL unwrap)
    const isWXPLUnwrap = tokenAddress.toLowerCase() === CONTRACT_ADDRESSES.WXPL.toLowerCase();
    
    // Record balance BEFORE swap for post-swap fee extraction
    const balanceBefore = await signer.provider.getBalance(userAddress);
    console.log('📊 XPL balance before swap:', ethers.formatEther(balanceBefore));
    
    // Set deadline to 20 minutes from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    
    console.log('🚀 Executing swap transaction...');
    console.log(`📊 Parameters:`, {
      tokenAmountInWei: tokenAmountInWei.toString(),
      minXPLInWei: minXPLInWei.toString(),
      path,
      userAddress,
      deadline,
      willExtractFee: !isWXPLUnwrap
    });
    
    // Use SIMPLE fixed gas limits for reliability  
    console.log('⛽ Using proven gas amounts for token→XPL swap...');
    const gasLimit = BigInt(500000); // Increased to 500k gas - proven working amount
    console.log('⛽ Token→XPL swap gas limit:', gasLimit.toString());
    
    // FIXED: Aligned execution with quote calculation
    console.log('🔄 Token→XPL swap with aligned fee collection...');
    
    // Use the minXPLInWei from frontend (already has user's slippage applied)
    console.log('🔧 SIMPLIFIED token→XPL swap (no fees):', {
      tokenAmountInWei: ethers.formatUnits(tokenAmountInWei, decimals),
      minXPLOut: ethers.formatEther(minXPLInWei),
      slippageTolerance: 'From UI settings (already applied)'
    });
    
    // Execute swap with slippage from UI (already applied in minXPLInWei)
    const swapTx = await router.swapExactTokensForETH(
      tokenAmountInWei,
      minXPLInWei, // Use minXPLInWei from frontend (slippage already applied)
      path,
      userAddress,
      deadline,
      { gasLimit }
    );
    
    console.log('⏳ Waiting for swap transaction confirmation...');
    const receipt = await swapTx.wait();
    console.log('✅ Swap transaction confirmed:', receipt.transactionHash);
    console.log('✅ Token→XPL swap completed successfully!');
    
    const result = { success: true, txHash: swapTx.hash, receipt };
    
    // Extract 2% fee from OUTPUT XPL (unless WXPL unwrap)
    if (!isWXPLUnwrap) {
      console.log('💰 Extracting 2% fee from XPL OUTPUT...');
      try {
        // Get balance AFTER swap
        const balanceAfter = await signer.provider.getBalance(userAddress);
        console.log('📊 XPL balance after swap:', ethers.formatEther(balanceAfter));
        
        // Calculate received XPL (accounting for gas)
        const gasUsed = receipt.gasUsed * receipt.gasPrice;
        const receivedXPL = balanceAfter - balanceBefore + gasUsed;
        
        console.log('📈 XPL received from swap:', ethers.formatEther(receivedXPL));
        
        // Calculate 2% fee
        const feeAmount = (receivedXPL * BigInt(PLATFORM_FEE_CONFIG.feeBps)) / 10000n;
        
        // Only extract if fee is meaningful (> 0.001 XPL)
        if (feeAmount > ethers.parseEther('0.001')) {
          console.log('💸 Sending 2% fee to platform:', ethers.formatEther(feeAmount), 'XPL');
          
          const feeTx = await signer.sendTransaction({
            to: PLATFORM_FEE_CONFIG.feeRecipient,
            value: feeAmount
          });
          
          console.log('⏳ Output fee transaction sent:', feeTx.hash);
          const feeReceipt = await feeTx.wait();
          console.log('✅ Output fee collected:', feeReceipt.hash);
          
          result.feeExtracted = ethers.formatEther(feeAmount);
          result.feeTxHash = feeReceipt.hash;
        } else {
          console.log('⚠️ Fee amount too small, skipping extraction');
        }
      } catch (feeError) {
        console.error('⚠️ Output fee extraction failed (non-critical):', feeError.message);
        // Don't fail the whole swap if fee extraction fails
      }
    } else {
      console.log('🔄 WXPL unwrap detected - NO FEES');
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error swapping ${tokenSymbol} for XPL:`, error);
    console.error(`❌ Error code:`, error.code);
    console.error(`❌ Error data:`, error.data);
    console.error(`❌ Error reason:`, error.reason);
    console.error(`❌ Full error:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Extract meaningful error message
    let errorMsg = error.message || 'Unknown error';
    if (error.reason) errorMsg = error.reason;
    if (error.data?.message) errorMsg = error.data.message;
    if (errorMsg.includes('UniswapV2Library: INSUFFICIENT_LIQUIDITY')) {
      errorMsg = 'Insufficient liquidity in the pool. Try a smaller amount or different token pair.';
    } else if (errorMsg.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
      errorMsg = 'Price moved too much! Try increasing slippage tolerance or smaller amount.';
    } else if (errorMsg.includes('TRANSFER_FAILED')) {
      errorMsg = 'Token transfer failed. This token may have transfer restrictions or fees.';
    }
    
    return { success: false, error: errorMsg };
  }
}

/**
 * Add liquidity to pool
 */
export async function addLiquidity(tokenSymbol, xplAmount, tokenAmount, signer) {
  try {
    const dexContract = getDEXContract(tokenSymbol, signer);
    const tokenContract = getTokenContractSmart(tokenSymbol, signer);
    
    const xplAmountInWei = ethers.parseEther(xplAmount.toString());
    const decimals = await tokenContract.decimals();
    const tokenAmountInWei = ethers.parseUnits(tokenAmount.toString(), decimals);
    
    // Approve token spending
    const approvalTx = await tokenContract.approve(dexContract.target, tokenAmountInWei);
    await approvalTx.wait();
    
    // Add liquidity
    const tx = await dexContract.addLiquidity(tokenAmountInWei, {
      value: xplAmountInWei
    });
    
    const receipt = await tx.wait();
    return { success: true, txHash: tx.hash, receipt };
  } catch (error) {
    console.error(`Error adding liquidity for ${tokenSymbol}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get pool reserves from Uniswap V2 pair
 */
export async function getPoolReserves(tokenSymbol, provider) {
  try {
    const factory = getFactoryContract(provider);
    const router = getRouterContract(provider);
    const wethAddress = await router.WETH();
    
    // Get pair address
    let tokenAddress;
    if (CONTRACT_ADDRESSES.TOKENS[tokenSymbol]) {
      tokenAddress = CONTRACT_ADDRESSES.TOKENS[tokenSymbol];
    } else {
      // Assume tokenSymbol is actually an address for custom tokens
      tokenAddress = tokenSymbol;
    }
    const pairAddress = await factory.getPair(
      wethAddress,
      tokenAddress
    );
    
    if (pairAddress === ethers.ZeroAddress) {
      return { xplReserve: '0', tokenReserve: '0' };
    }
    
    const pair = getPairContract(pairAddress, provider);
    const [reserve0, reserve1] = await pair.getReserves();
    
    // Check which token is token0 and token1
    const token0 = await pair.token0();
    const isWETHToken0 = token0.toLowerCase() === wethAddress.toLowerCase();
    
    return {
      xplReserve: ethers.formatEther(isWETHToken0 ? reserve0 : reserve1),
      tokenReserve: ethers.formatEther(isWETHToken0 ? reserve1 : reserve0)
    };
  } catch (error) {
    console.error(`Error getting reserves for ${tokenSymbol}:`, error);
    return { xplReserve: '0', tokenReserve: '0' };
  }
}

/**
 * Wrap XPL to WXPL using WXPL contract deposit function
 */
export async function wrapXPL(xplAmount, signer) {
  try {
    console.log('🔄 Wrapping XPL to WXPL:', { xplAmount });
    
    // Validate input
    if (isNaN(xplAmount) || xplAmount <= 0) {
      throw new Error(`Invalid XPL amount: ${xplAmount}`);
    }
    
    // Get WXPL contract
    const wxplContract = new ethers.Contract(CONTRACT_ADDRESSES.WXPL, WXPL_ABI, signer);
    const xplAmountInWei = ethers.parseEther(xplAmount.toString());
    
    console.log('💰 Wrapping amount:', ethers.formatEther(xplAmountInWei), 'XPL');
    
    // Check user balance
    const userAddress = await signer.getAddress();
    const userBalance = await signer.provider.getBalance(userAddress);
    
    if (userBalance < xplAmountInWei) {
      throw new Error(`Insufficient XPL balance. Have: ${ethers.formatEther(userBalance)}, Need: ${ethers.formatEther(xplAmountInWei)}`);
    }
    
    // Call deposit function with XPL value
    const tx = await wxplContract.deposit({ value: xplAmountInWei });
    console.log('🔄 Wrap transaction sent:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('✅ XPL wrapped successfully');
    
    return { success: true, txHash: tx.hash, receipt };
  } catch (error) {
    console.error('❌ Error wrapping XPL:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Unwrap WXPL to XPL using WXPL contract withdraw function
 */
export async function unwrapWXPL(wxplAmount, signer) {
  try {
    console.log('🔄 Unwrapping WXPL to XPL:', { wxplAmount });
    
    // Validate input
    if (isNaN(wxplAmount) || wxplAmount <= 0) {
      throw new Error(`Invalid WXPL amount: ${wxplAmount}`);
    }
    
    // Get WXPL contract
    const wxplContract = new ethers.Contract(CONTRACT_ADDRESSES.WXPL, WXPL_ABI, signer);
    let wxplAmountInWei = ethers.parseEther(wxplAmount.toString());
    
    console.log('💰 Unwrapping amount:', ethers.formatEther(wxplAmountInWei), 'WXPL');
    
    // Check user WXPL balance
    const userAddress = await signer.getAddress();
    const userBalance = await wxplContract.balanceOf(userAddress);
    
    console.log(`💰 User WXPL balance: ${ethers.formatEther(userBalance)}`);
    console.log(`💸 Trying to unwrap: ${ethers.formatEther(wxplAmountInWei)}`);
    
    // Fix precision issue: if amount is very close to balance, use actual balance
    const balanceDifference = userBalance - wxplAmountInWei;
    const tolerance = ethers.parseUnits("0.01", 18); // 0.01 WXPL tolerance
    
    // Check if we're within tolerance (either slightly over OR under)
    const absDifference = balanceDifference < 0n ? -balanceDifference : balanceDifference;
    
    if (absDifference <= tolerance) {
      console.log(`🔧 Precision fix: Requested ${ethers.formatEther(wxplAmountInWei)} but have ${ethers.formatEther(userBalance)}. Using actual balance (diff: ${ethers.formatEther(absDifference)})`);
      wxplAmountInWei = userBalance;
    } else if (userBalance < wxplAmountInWei) {
      throw new Error(`Insufficient WXPL balance. Have: ${ethers.formatEther(userBalance)}, Need: ${ethers.formatEther(wxplAmountInWei)}`);
    }
    
    // Call withdraw function
    const tx = await wxplContract.withdraw(wxplAmountInWei);
    console.log('🔄 Unwrap transaction sent:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('✅ WXPL unwrapped successfully');
    
    return { success: true, txHash: tx.hash, receipt };
  } catch (error) {
    console.error('❌ Error unwrapping WXPL:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch all launched tokens DIRECTLY from blockchain (no backend needed)
 */
export async function fetchLaunchedTokensOnchain() {
  try {
    console.log('🚀 Fetching launched tokens DIRECTLY from blockchain...');
    
    const provider = getPlasmaProvider();
    const pumpFactory = new ethers.Contract(
      CONTRACT_ADDRESSES.PUMP_FACTORY,
      PUMP_FACTORY_ABI,
      provider
    );
    
    // Get launches from blockchain
    const MAX_TOKENS = 200;
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
    
    console.log(`✅ Found ${uniqueLaunches.length} UNIQUE tokens`);
    
    // Fetch metadata for each token (limit to 100 to avoid timeout)
    const tokens = [];
    const METADATA_LIMIT = 100;
    
    for (let i = 0; i < Math.min(uniqueLaunches.length, METADATA_LIMIT); i++) {
      try {
        const launch = uniqueLaunches[i];
        const tokenAddress = launch.token;
        
        const tokenContract = new ethers.Contract(tokenAddress, PUMP_TOKEN_ABI, provider);
        
        let symbol = 'UNKNOWN';
        let name = 'Unknown';
        let image = '';
        
        try {
          symbol = await tokenContract.symbol();
          name = symbol;
        } catch (e) {
          console.log(`  ⚠️ symbol() failed for ${tokenAddress.substring(0, 8)}`);
        }
        
        if (symbol !== 'UNKNOWN') {
          try {
            const tokenName = await tokenContract.name();
            if (tokenName && tokenName !== symbol && !tokenName.includes('bought')) {
              name = tokenName;
            }
          } catch (e) {}
          
          try {
            image = await tokenContract.image();
          } catch (e) {}
        }
        
        // Calculate bonding progress
        const realEth = parseFloat(ethers.formatEther(launch.realEthReserves));
        const targetEth = parseFloat(ethers.formatEther(launch.liquidityEth));
        const bondingProgress = launch.complete ? 100 : (targetEth > 0 ? Math.min(100, (realEth / targetEth) * 100) : 0);
        
        // Calculate market cap
        const virtualEth = parseFloat(ethers.formatEther(launch.virtualEthReserves));
        const realTokens = parseFloat(ethers.formatEther(launch.realTokenReserves));
        const currentPrice = realTokens > 0 ? virtualEth / realTokens : 0;
        
        let totalSupply = 1000000000;
        try {
          const ts = await tokenContract.totalSupply();
          totalSupply = parseFloat(ethers.formatEther(ts));
        } catch (e) {}
        
        const initialVirtualEth = parseFloat(ethers.formatEther(launch.initialVirtualEthReserves));
        const initialVirtualTokens = parseFloat(ethers.formatEther(launch.initialVirtualTokenReserves));
        const marketCap = initialVirtualTokens > 0 
          ? initialVirtualEth * (totalSupply / initialVirtualTokens)
          : currentPrice * totalSupply;
        
        const logoUrl = image ? `https://ipfs.io/ipfs/${image}` : '';
        
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
        
        console.log(`✅ [${i + 1}/${Math.min(uniqueLaunches.length, METADATA_LIMIT)}] $${symbol} (${name}) - Progress: ${bondingProgress.toFixed(1)}%`);
        
        // Small delay to avoid rate limiting
        if (i < Math.min(uniqueLaunches.length, METADATA_LIMIT) - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Error loading token:`, error.message);
      }
    }
    
    // Sort by bonding progress
    tokens.sort((a, b) => b.bondingProgress - a.bondingProgress);
    
    console.log(`🎉 Successfully loaded ${tokens.length} tokens from blockchain!`);
    return { tokens, total: tokens.length };
    
  } catch (error) {
    console.error('❌ Error fetching launched tokens from blockchain:', error);
    return { tokens: [], total: 0 };
  }
}