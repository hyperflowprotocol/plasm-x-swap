const BASE_TOKENS = [
  {
    address: 'native',
    name: 'Plasma',
    symbol: 'XPL',
    decimals: 18,
    logoURI: 'https://app.dyorswap.finance/PlasmaLogo.png',
    isNative: true
  },
  {
    address: '0x6100e367285b01f48d07953803a2d8dca5d19873',
    name: 'Wrapped XPL',
    symbol: 'WXPL',
    decimals: 18,
    logoURI: 'https://app.dyorswap.finance/PlasmaLogo.png',
    isWrapped: true
  },
  {
    address: '0xd1c6f989e9552bd75f2f92758a609e4350eef4c9',
    name: 'USDT',
    symbol: 'USDT0',
    decimals: 6,
    logoURI: 'https://assets.coingecko.com/coins/images/325/small/Tether.png'
  }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  res.status(200).json(BASE_TOKENS);
}
