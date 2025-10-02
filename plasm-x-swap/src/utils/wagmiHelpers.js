import { BrowserProvider } from 'ethers'

export function walletClientToSigner(walletClient) {
  const { account, chain, transport } = walletClient
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }
  const provider = new BrowserProvider(transport, network)
  const signer = provider.getSigner(account.address)
  return signer
}

export async function getEthersProvider(walletClient) {
  const { chain, transport } = walletClient
  const network = {
    chainId: chain.id,
    name: chain.name,
  }
  return new BrowserProvider(transport, network)
}
