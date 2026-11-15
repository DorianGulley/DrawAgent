import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";

const KEY = "direct.deviceKey";

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else for (let i = 0; i < bytes; i++) values[i] = Math.floor(Math.random() * 256);
  return Array.from(values, (b) => b.toString(16).padStart(2, "0")).join("");
}

const VALID = /^dev_[a-f0-9]{48}$/;
let cached: string | null = null;

function fromKeychain(): string | null {
  try {
    return SecureStore.getItem(KEY);
  } catch {
    return null;
  }
}

function fromFile(file: File): string | null {
  try {
    return file.exists ? file.textSync().trim() : null;
  } catch {
    return null;
  }
}

export function deviceKey(): string {
  if (cached) return cached;
  const file = new File(Paths.document, "direct-device-key");
  const stored = [fromKeychain(), fromFile(file)].find((value) => value && VALID.test(value));
  if (stored) return (cached = stored);
  const fresh = `dev_${randomHex(24)}`;
  try {
    SecureStore.setItem(KEY, fresh);
  } catch {
    file.write(fresh).catch(() => {});
  }
  return (cached = fresh);
}
