import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { ownerHashFor } from "./lib";
import { verifyKey } from "./models";
import { provider } from "./schema";
import { encryptSecret } from "./secrets";

export const list = query({
  args: { deviceKey: v.string() },
  handler: async (ctx, { deviceKey }) => {
    const ownerHash = await ownerHashFor(deviceKey);
    const rows = await ctx.db
      .query("apiKeys")
      .withIndex("by_ownerHash", (q) => q.eq("ownerHash", ownerHash))
      .take(20);
    return rows.map(({ _id, provider, label, last4, model, createdAt }) => ({ _id, provider, label, last4, model, createdAt }));
  },
});

export const store = internalMutation({
  args: { ownerHash: v.string(), provider, label: v.string(), last4: v.string(), model: v.string(), ciphertext: v.string(), iv: v.string() },
  handler: async (ctx, args) => await ctx.db.insert("apiKeys", { ...args, createdAt: Date.now() }),
});

export const add = action({
  args: { deviceKey: v.string(), provider, apiKey: v.string(), label: v.optional(v.string()) },
  handler: async (ctx, { deviceKey, provider: which, apiKey, label }): Promise<{ keyId: Id<"apiKeys">; model: string }> => {
    const ownerHash = await ownerHashFor(deviceKey);
    const key = apiKey.trim();
    if (key.length < 20 || key.length > 300 || /\s/.test(key)) throw new Error("That doesn't look like an API key");
    const model = await verifyKey(which, key);
    const { ciphertext, iv } = await encryptSecret(key);
    const name = (label ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || (which === "openai" ? "OpenAI" : "Anthropic");
    const keyId: Id<"apiKeys"> = await ctx.runMutation(internal.keys.store, { ownerHash, provider: which, label: name, last4: key.slice(-4), model, ciphertext, iv });
    return { keyId, model };
  },
});

export const remove = mutation({
  args: { deviceKey: v.string(), keyId: v.id("apiKeys") },
  handler: async (ctx, { deviceKey, keyId }) => {
    const ownerHash = await ownerHashFor(deviceKey);
    const row = await ctx.db.get("apiKeys", keyId);
    if (!row || row.ownerHash !== ownerHash) throw new Error("Key not found");
    await ctx.db.delete("apiKeys", keyId);
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_ownerHash_and_updatedAt", (q) => q.eq("ownerHash", ownerHash))
      .take(200);
    for (const workspace of workspaces) if (workspace.keyId === keyId) await ctx.db.patch("workspaces", workspace._id, { keyId: undefined });
    return null;
  },
});
