// utils/clipboard.js
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = text; 
    ta.style.position = "fixed"; 
    ta.style.opacity = "0";
    document.body.appendChild(ta); 
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { 
    return false; 
  }
}