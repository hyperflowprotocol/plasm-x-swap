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
        // Login methods - ALL wallet options
        loginMethods: ['wallet', 'email', 'sms'],
        
        // Wallet connectors - Enable ALL popular wallets
        walletConnectors: ['metamask', 'coinbase_wallet', 'wallet_connect', 'rainbow', 'phantom'],
        
        // Appearance
        appearance: {
          theme: 'dark',
          accentColor: '#E0004F',
          logo: 'https://plasm-x.exchange/logo.png',
          showWalletLoginFirst: true // Show wallet options first
        },
        
        // Supported chains - XPL and Base
        supportedChains: [
          {
            id: 9745,
            name: 'Plasma Network',
            network: 'plasma',
            nativeCurrency: { name: 'XPL', symbol: 'XPL', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://rpc.plasma.to'] },
              public: { http: ['https://rpc.plasma.to'] }
            },
            blockExplorers: {
              default: { name: 'Plasma Explorer', url: 'https://plasma.blockscout.com' }
            }
          },
          {
            id: 8453,
            name: 'Base',
            network: 'base',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://mainnet.base.org'] },
              public: { http: ['https://mainnet.base.org'] }
            },
            blockExplorers: {
              default: { name: 'BaseScan', url: 'https://basescan.org' }
            }
          }
        ],
        
        // Embedded wallet config
        embeddedWallets: {
          createOnLogin: 'users-without-wallets'
        }
      }}
    >
      {children}
    </PrivyProvider>
  )
}

export default PrivyWrapper
