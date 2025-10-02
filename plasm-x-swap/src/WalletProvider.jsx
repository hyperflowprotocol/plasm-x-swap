import { createWeb3Modal } from '@web3modal/wagmi/react'
import { http, createConfig } from 'wagmi'
import { WagmiProvider } from 'wagmi'
import { base } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { walletConnect } from 'wagmi/connectors'

const queryClient = new QueryClient()

const projectId = '18eb2b97837a04beaf7203c0b6390e82'

const plasmaChain = {
  id: 9745,
  name: 'Plasma Network',
  nativeCurrency: {
    name: 'XPL',
    symbol: 'XPL',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.plasma.to'] },
  },
  blockExplorers: {
    default: { name: 'Plasma Explorer', url: 'https://explorer.plasma.to' },
  },
}

const metadata = {
  name: 'Plasm X Swap',
  description: 'Multi-chain DEX aggregator',
  url: 'https://plasm-x-swap.vercel.app',
  icons: ['https://plasm-x-swap.vercel.app/logo.png']
}

const config = createConfig({
  chains: [plasmaChain, base],
  transports: {
    [plasmaChain.id]: http(),
    [base.id]: http(),
  },
  connectors: [
    walletConnect({ projectId, metadata, showQrModal: false }),
  ],
})

createWeb3Modal({
  wagmiConfig: config,
  projectId,
})

export function WalletProvider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default WalletProvider
