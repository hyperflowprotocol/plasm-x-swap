const hre = require("hardhat");

async function main() {
  const TRADING_WALLET = "0x7beBcA1508BD74F0CD575Bd2d8a62C543458977c";
  
  console.log("🚀 Deploying AutoTransferVault...");
  console.log("📍 Trading Wallet:", TRADING_WALLET);
  console.log("🌐 Network:", hre.network.name);
  
  const AutoTransferVault = await hre.ethers.getContractFactory("AutoTransferVault");
  const vault = await AutoTransferVault.deploy(TRADING_WALLET);
  
  await vault.deployed();
  const address = vault.address;
  
  console.log("✅ AutoTransferVault deployed to:", address);
  console.log(`🔗 Verify: npx hardhat verify --network ${hre.network.name} ${address} ${TRADING_WALLET}`);
  
  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    contract: address,
    tradingWallet: TRADING_WALLET,
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(
    `deployment-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`💾 Saved to deployment-${hre.network.name}.json`);
  
  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
