import { ethers } from "ethers";

// ===== BigInt-safe helpers =====

// ---------- BigInt-safe helpers ----------
export const toWei = (amtStr, decimals) =>
  ethers.parseUnits(amtStr || "0", decimals);                // -> bigint

export const fromWei = (amt, decimals) =>
  ethers.formatUnits(amt, decimals);                         // -> string for UI only

// Integer slippage math: minOut = out * (10_000 - bps) / 10_000
export const applySlippageBps = (out, bps) => {
  const BPS_DEN = 10_000n;
  const bpsBig = BigInt(bps);                         // e.g. 150 = 1.5%
  return (out * (BPS_DEN - bpsBig)) / BPS_DEN;
};

// Platform fee calculation: fee = amount * bps / 10_000
export const calculateFeeBps = (amount, bps) => {
  const BPS_DEN = 10_000n;
  const bpsBig = BigInt(Math.floor(bps)); // bps is already in basis points
  return (amount * bpsBig) / BPS_DEN;
};

// Check if token is fee-exempt (stablecoins, WXPL)
export const isTokenFeeExempt = (tokenAddress, feeExemptTokens) => {
  if (!tokenAddress || tokenAddress === 'native' || tokenAddress === 'XPL') {
    return false;
  }
  return feeExemptTokens.some(exemptToken => 
    exemptToken.toLowerCase() === tokenAddress.toLowerCase()
  );
};

// Conditional fee calculation - returns 0 for exempt tokens
export const calculateConditionalFee = (amount, bps, inputToken, outputToken, feeExemptTokens) => {
  // Check if either input or output token is fee-exempt
  const isInputExempt = isTokenFeeExempt(inputToken, feeExemptTokens);
  const isOutputExempt = isTokenFeeExempt(outputToken, feeExemptTokens);
  
  // No fee if either token is exempt
  if (isInputExempt || isOutputExempt) {
    return 0n;
  }
  
  return calculateFeeBps(amount, bps);
};

// Safer logging (never stringify BigInt directly)
export const safeLog = (label, obj) => {
  const replacer = (_k, v) => (typeof v === "bigint" ? v.toString() : v);
  console.log(label, JSON.stringify(obj, replacer, 2));
};

// ---------- Quote ----------
export async function getQuote({
  router,           // ethers.Contract (router)
  path,             // string[] [from, to]
  amountIn,         // bigint
}) {
  const amounts = await router.getAmountsOut(amountIn, path);
  const out = amounts[amounts.length - 1];
  return out; // bigint
}

// ---------- Approve if needed (bigint-safe) ----------
export async function approveIfNeeded({
  token, owner, spender, needed,
}) {
  const allowance = await token.allowance(owner, spender);
  if (allowance < needed) {
    const tx = await token.approve(spender, needed);
    await tx.wait();
  }
}