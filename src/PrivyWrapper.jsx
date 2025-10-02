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
        loginMethods: ['wallet'],
        
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

        walletConnectCloudProjectId: undefined,
        
        legalRequirements: {
          termsAndConditionsUrl: undefined,
          privacyPolicyUrl: undefined,
        },

        experimentalFeatures: {
          noPromptOnSignature: true,
        },
        
        walletConnect: {
          version: '2',
        },
        
        mfa: {
          noPromptOnMfaRequired: false,
        },
        
        customAuth: {
          enabled: false,
        },

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
