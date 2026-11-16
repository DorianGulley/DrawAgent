const KEY = "clay.deviceKey";
let cached: string | null = null;

export function deviceKey(): string {
  if (cached) return cached;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && /^dev_[a-f0-9]{48}$/.test(saved)) return (cached = saved);
  } catch { /* Storage can be unavailable in private browsing. */ }
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  cached = `dev_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  try { localStorage.setItem(KEY, cached); } catch { /* Retain identity for this session. */ }
  return cached;
}
