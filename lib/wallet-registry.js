let registeredWallets = [];

function registerWallet(address) {
  if (!registeredWallets.includes(address.toLowerCase())) {
    registeredWallets.push(address.toLowerCase());
  }
}

function getRegisteredWallets() {
  return registeredWallets;
}

function clearRegisteredWallets() {
  registeredWallets = [];
}

module.exports = {
  registerWallet,
  getRegisteredWallets,
  clearRegisteredWallets
};
