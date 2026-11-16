import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { cleanText, ownerHashFor } from "./lib";
import { ownedWorkspace } from "./workspaces";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PER_WORKSPACE = 40;

function sniff(bytes: Uint8Array): string | null {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function assetsOf(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const rows = await ctx.db
    .query("assets")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .take(MAX_PER_WORKSPACE);
  return await Promise.all(
    rows.map(async (row) => ({ _id: row._id, name: row.name, width: row.width ?? null, height: row.height ?? null, url: await ctx.storage.getUrl(row.storageId) })),
  );
}

export const list = query({
  args: { deviceKey: v.string(), workspaceId: v.id("workspaces") },
  handler: async (ctx, { deviceKey, workspaceId }) => {
    const workspace = await ctx.db.get("workspaces", workspaceId);
    if (!workspace || workspace.ownerHash !== (await ownerHashFor(deviceKey))) return [];
    return (await assetsOf(ctx, workspaceId)).reverse();
  },
});

export const urls = query({
  args: { deviceKey: v.string(), ids: v.array(v.string()) },
  handler: async (ctx, { deviceKey, ids }) => {
    const ownerHash = await ownerHashFor(deviceKey);
    const out: Record<string, string> = {};
    for (const raw of ids.slice(0, 60)) {
      const id = ctx.db.normalizeId("assets", raw);
      const asset = id ? await ctx.db.get("assets", id) : null;
      if (!asset) continue;
      const workspace = await ctx.db.get("workspaces", asset.workspaceId);
      if (workspace?.ownerHash !== ownerHash) continue;
      const url = await ctx.storage.getUrl(asset.storageId);
      if (url) out[raw] = url;
    }
    return out;
  },
});

export const checkOwner = internalQuery({
  args: { deviceKey: v.string(), workspaceId: v.id("workspaces") },
  handler: async (ctx, { deviceKey, workspaceId }) => {
    await ownedWorkspace(ctx, deviceKey, workspaceId);
    const count = (await ctx.db.query("assets").withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId)).take(MAX_PER_WORKSPACE)).length;
    return count < MAX_PER_WORKSPACE;
  },
});

export const insert = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => await ctx.db.insert("assets", { ...args, createdAt: Date.now() }),
});

export const add = action({
  args: {
    deviceKey: v.string(),
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
    name: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"assets">> => {
    const reject = async (message: string): Promise<never> => {
      await ctx.storage.delete(args.storageId);
      throw new Error(message);
    };
    let room: boolean;
    try {
      room = await ctx.runQuery(internal.assets.checkOwner, { deviceKey: args.deviceKey, workspaceId: args.workspaceId });
    } catch {
      return await reject("Workspace not found");
    }
    if (!room) return await reject(`A workspace holds up to ${MAX_PER_WORKSPACE} photos`);
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("The upload didn't arrive");
    if (blob.size > MAX_BYTES) return await reject("Photos can be up to 10 MB");
    const contentType = sniff(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));
    if (!contentType) return await reject("That file isn't a JPEG, PNG, GIF, or WebP photo");
    const dimension = (value?: number) => (value && Number.isFinite(value) && value > 0 && value < 20000 ? Math.round(value) : undefined);
    return await ctx.runMutation(internal.assets.insert, {
      workspaceId: args.workspaceId,
      storageId: args.storageId,
      name: cleanText(args.name ?? "", 60) || "Photo",
      contentType,
      size: blob.size,
      width: dimension(args.width),
      height: dimension(args.height),
    });
  },
});

export const remove = mutation({
  args: { deviceKey: v.string(), assetId: v.id("assets") },
  handler: async (ctx, { deviceKey, assetId }) => {
    const asset = await ctx.db.get("assets", assetId);
    if (!asset) return null;
    await ownedWorkspace(ctx, deviceKey, asset.workspaceId);
    await ctx.storage.delete(asset.storageId);
    await ctx.db.delete("assets", assetId);
    return null;
  },
});
