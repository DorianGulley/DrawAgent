import { MutationCtx, QueryCtx } from "./_generated/server";

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function projectForKey(ctx: QueryCtx | MutationCtx, key: string) {
  if (!/^dk_[a-f0-9]{48}$/.test(key)) throw new Error("Invalid project key");
  const keyHash = await sha256(key);
  const project = await ctx.db
    .query("projects")
    .withIndex("by_keyHash", (q) => q.eq("keyHash", keyHash))
    .unique();
  if (!project) throw new Error("Unknown project key");
  return project;
}

export function cleanText(value: string, max: number): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

export function cleanUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("URL must be http(s)");
  return url.toString();
}
