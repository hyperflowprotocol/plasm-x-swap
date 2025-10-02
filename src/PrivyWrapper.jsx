import React from 'react'
import { PrivyProvider } from '@privy-io/react-auth'

const PrivyWrapper = ({ children }) => {
  const appId = import.meta.env.VITE_PRIVY_APP_ID || 
                import.meta.env.PRIVY_APP_ID || 
                process.env.PRIVY_APP_ID

  console.log('🔐 Privy App ID configured:', appId ? 'Yes' : 'No')

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // ALL LOGIN METHODS
        loginMethods: ['wallet'],
        
        // Appearance - wallet first
        appearance: {
          theme: 'dark',
          accentColor: '#E0004F',
          showWalletLoginFirst: true,
          walletList: ['metamask', 'coinbase_wallet', 'rainbow', 'wallet_connect'],
          walletChainType: 'ethereum-only'
        },
        
        // Supported chains
        defaultChain: { id: 9745 },
        supportedChains: [
          {
            id: 9745,
            name: 'Plasma Network',
            nativeCurrency: { name: 'XPL', symbol: 'XPL', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://rpc.plasma.to'] }
            },
            blockExplorers: {
              default: { name: 'Plasma Explorer', url: 'https://plasma.blockscout.com' }
            }
          },
          {
            id: 8453,
            name: 'Base',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://mainnet.base.org'] }
            },
            blockExplorers: {
              default: { name: 'BaseScan', url: 'https://basescan.org' }
            }
          }
        ],
        
        embeddedWallets: {
          createOnLogin: 'off'
        }
      }}
    >
      {children}
    </PrivyProvider>
  )
}

export default PrivyWrapper
