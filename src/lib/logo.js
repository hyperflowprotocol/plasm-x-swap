// src/lib/logo.js
const DYOR_BASE = "https://dyorswap.org";
const DYOR_TOKENLIST_CANDIDATES = [
  "/tokenlist.json",
  "/tokens.json",
  "/assets/tokenlist.json",
  "/assets/tokens.json",
];
const DYOR_LOGO_DIRS = [
  "/assets/tokens",
  "/assets/icons", 
  "/assets/logos",
  "/logos",
];

const IMAGE_EXTS = [".png", ".svg", ".webp"];
const cache = new Map(); // addr -> logoURL

/** HEAD/GET exists check (HEAD first, fallback to GET for hosts that block HEAD) */
async function urlExists(url) {
  try {
    const h = await fetch(url, { method: "HEAD" });
    if (h.ok) return true;
  } catch {}
  try {
    const r = await fetch(url, { method: "GET", headers: { "cache-control": "no-cache" } });
    return r.ok;
  } catch { return false; }
}

/** Try to load a Dyor token list (Uniswap spec-ish: { tokens:[{address,logoURI}...] }) */
let tokenList = null;
async function loadDyorTokenList() {
  if (tokenList !== null) return tokenList;
  for (const path of DYOR_TOKENLIST_CANDIDATES) {
    try {
      const res = await fetch(DYOR_BASE + path, { cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json();
      // Accept either {tokens:[...]} or array map
      if (Array.isArray(json?.tokens) || Array.isArray(json)) {
        tokenList = json;
        return tokenList;
      }
    } catch {}
  }
  tokenList = null;
  return null;
}

/** Resolve from token list by exact address (lowercased) */
function logoFromList(addr, list) {
  const A = addr.toLowerCase();
  const items = Array.isArray(list?.tokens) ? list.tokens : Array.isArray(list) ? list : [];
  const found = items.find((t) => (t.address || "").toLowerCase() === A);
  return found?.logoURI;
}

/** Build dyorswap.org guessed URL: /assets/<dir>/<address>.<ext> */
function buildGuess(addr) {
  const a = addr.toLowerCase();
  const urls = [];
  for (const dir of DYOR_LOGO_DIRS) {
    for (const ext of IMAGE_EXTS) {
      urls.push(`${DYOR_BASE}${dir}/${a}${ext}`);
    }
  }
  return urls;
}

/** Public API: resolve a logo URL (or undefined). Never use names—address only. */
export async function resolveLogo(meta) {
  const address = meta.address.toLowerCase();
  if (!address.startsWith("0x") || address.length !== 42) return undefined;
  if (cache.has(address)) return cache.get(address);

  // 1) Dyor token list
  const list = await loadDyorTokenList();
  const fromList = list ? logoFromList(address, list) : undefined;
  if (fromList && await urlExists(fromList)) {
    cache.set(address, fromList);
    return fromList;
  }

  // 2) Address-based guesses in common directories
  for (const url of buildGuess(address)) {
    if (await urlExists(url)) {
      cache.set(address, url);
      return url;
    }
  }

  // 3) Fallback: identicon (never wrong, just generic)
  const identicon = `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`;
  cache.set(address, identicon);
  return identicon;
}

/** Convenience img props with safe fallback (use in React) */
export function imgProps(logo, alt) {
  return {
    src: logo,
    alt: alt || "token",
    onError: (e) => { 
      e.currentTarget.onerror = null; 
      e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${alt||"addr"}`; 
    }
  };
}