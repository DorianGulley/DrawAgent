const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function secretKey(): Promise<CryptoKey> {
  const secret = process.env.CLAY_KEY_SECRET;
  if (!secret) throw new Error("CLAY_KEY_SECRET is not set on this deployment");
  const raw = fromBase64(secret);
  if (raw.length !== 32) throw new Error("CLAY_KEY_SECRET must be 32 bytes, base64-encoded");
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await secretKey(), encoder.encode(plain));
  return { ciphertext: toBase64(new Uint8Array(data)), iv: toBase64(iv) };
}

export async function decryptSecret(ciphertext: string, iv: string): Promise<string> {
  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await secretKey(), fromBase64(ciphertext));
  return new TextDecoder().decode(data);
}
