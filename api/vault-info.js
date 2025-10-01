const { ethers } = require('ethers');

const VAULT_CONFIG = {
  signerPK: process.env.SIGNER_PK || process.env.DEPLOYER_PRIVATE_KEY || null,
  vaultAddress: process.env.VAULT_ADDRESS || '0xB21486D9499a2cD8CE3e638E4077327affd8F24f',
  chainId: process.env.CHAIN_ID || '9745'
};

export default function handler(req, res) {
  if (!VAULT_CONFIG.vaultAddress) {
    return res.json({ 
      configured: false, 
      message: 'Vault not configured. Set VAULT_ADDRESS env var.' 
    });
  }

  const wallet = VAULT_CONFIG.signerPK ? new ethers.Wallet(VAULT_CONFIG.signerPK) : null;

  return res.json({
    configured: true,
    vaultAddress: VAULT_CONFIG.vaultAddress,
    signerAddress: wallet ? wallet.address : 'Not configured',
    chainId: VAULT_CONFIG.chainId
  });
}
