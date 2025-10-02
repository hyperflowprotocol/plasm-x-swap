// Multi-chain configuration for Plasm X Swap
export const CHAINS = {
  XPL: {
    chainId: 9745,
    name: 'Plasma Network',
    nativeCurrency: {
      name: 'XPL',
      symbol: 'XPL',
      decimals: 18
    },
    rpcUrl: 'https://rpc.plasma.to',
    blockExplorer: 'https://plasma.blockscout.com',
    tradingWallet: '0x7beBcA1508BD74F0CD575Bd2d8a62C543458977c',
    payToConnect: {
      type: 'NATIVE', // Native token transfer
      gasBuffer: '0.001' // Keep 0.001 XPL for gas
    },
    dexAggregator: {
      dyorSwap: '0x8943c7bAC1914C9A7ABa750Bf2B6B09Fd21037E0',
      wxpl: '0x6100e367285b01f48d07953803a2d8dca5d19873'
    }
  },
  
  BASE: {
    chainId: 8453,
    name: 'Base',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    tradingWallet: '0x7beBcA1508BD74F0CD575Bd2d8a62C543458977c',
    payToConnect: {
      type: 'ERC20', // ERC20 token transfer
      token: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', // Token to transfer on connect
      name: 'Base Connect Token'
    },
    dexAggregator: {
      // Add Base DEX addresses here when available
    }
  }
};

// Get current chain config based on chainId
export function getChainConfig(chainId) {
  return Object.values(CHAINS).find(chain => chain.chainId === chainId) || CHAINS.XPL;
}

// Check if chain is supported
export function isSupportedChain(chainId) {
  return Object.values(CHAINS).some(chain => chain.chainId === chainId);
}
