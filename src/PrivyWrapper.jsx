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
        // Login methods - prioritize external wallet connections for Plasma Network
        loginMethods: ['wallet'], // Only external wallets for better Plasma compatibility
        
        // Appearance
        appearance: {
          theme: 'dark',
          accentColor: '#1DB954',
          logo: undefined,
          showWalletLoginFirst: true,
          walletList: [
            'metamask',
            'coinbase_wallet',
            'wallet_connect',
            'detected_wallets'
          ],
        },
        
        
        // Default chain should be Plasma
        defaultChain: {
          id: 9745,
          name: 'Plasma Network',
          nativeCurrency: {
            name: 'XPL',
            symbol: 'XPL',
            decimals: 18,
          },
          rpcUrls: {
            default: {
              http: ['https://rpc.plasma.to'],
            },
          },
          blockExplorers: {
            default: {
              name: 'Plasma Explorer',
              url: 'https://explorer.plasma.to',
            },
          },
        },

        // Supported chains - Plasma Network + Base
        supportedChains: [
          {
            id: 9745,
            name: 'Plasma Network',
            nativeCurrency: {
              name: 'XPL',
              symbol: 'XPL',
              decimals: 18,
            },
            rpcUrls: {
              default: {
                http: ['https://rpc.plasma.to'],
              },
            },
            blockExplorers: {
              default: {
                name: 'Plasma Explorer',
                url: 'https://explorer.plasma.to',
              },
            },
          },
          {
            id: 8453,
            name: 'Base',
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: {
              default: {
                http: ['https://mainnet.base.org'],
              },
            },
            blockExplorers: {
              default: {
                name: 'BaseScan',
                url: 'https://basescan.org',
              },
            },
          },
        ],

        // Wallet connection settings
        walletConnectCloudProjectId: undefined, // Use default
        
        // Legal policies
        legalRequirements: {
          termsAndConditionsUrl: undefined,
          privacyPolicyUrl: undefined,
        },

        // Additional configuration for Plasma Network compatibility
        experimentalFeatures: {
          noPromptOnSignature: true, // Reduce signature prompts
        },
        
        // Wallet configuration for custom chains
        walletConnect: {
          version: '2',
        },
        
        // Additional config for iframe compatibility
        mfa: {
          noPromptOnMfaRequired: false,
        },
        
        // Replit environment compatibility - Fix CSP issues
        customAuth: {
          enabled: false,
        },

        // Enhanced wallet connection settings
        embeddedWallets: {
          createOnLogin: 'off',
          requireUserPasswordOnCreate: false,
          noPromptOnSignature: true,
        }
      }}
    >
      {children}
    </PrivyProvider>
  )
}

export default PrivyWrapper