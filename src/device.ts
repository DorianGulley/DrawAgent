import * as SecureStore from "expo-secure-store";

const KEY = "direct.deviceKey";

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else for (let i = 0; i < bytes; i++) values[i] = Math.floor(Math.random() * 256);
  return Array.from(values, (b) => b.toString(16).padStart(2, "0")).join("");
}

let cached: string | null = null;

export function deviceKey(): string {
  if (cached) return cached;
  const stored = SecureStore.getItem(KEY);
  if (stored && /^dev_[a-f0-9]{48}$/.test(stored)) return (cached = stored);
  const fresh = `dev_${randomHex(24)}`;
  SecureStore.setItem(KEY, fresh);
  return (cached = fresh);
}
