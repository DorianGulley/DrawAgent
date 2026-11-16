import { v } from "convex/values";
import { internalQuery, mutation } from "./_generated/server";
import { ownedWorkspace } from "./workspaces";
import { AppDoc, imageSources } from "../shared/model";

function slug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => "abcdefghijkmnpqrstuvwxyz23456789"[byte % 32]).join("");
}

export const publish = mutation({
  args: { deviceKey: v.string(), componentId: v.id("components") },
  handler: async (ctx, { deviceKey, componentId }) => {
    const component = await ctx.db.get("components", componentId);
    if (!component?.designId) throw new Error("Only parts made in Clay can be shared");
    const { workspace } = await ownedWorkspace(ctx, deviceKey, component.workspaceId);
    const design = (await ctx.db.get("designs", component.designId))!;
    const existing = await ctx.db
      .query("shares")
      .withIndex("by_componentId", (q) => q.eq("componentId", componentId))
      .order("desc")
      .first();
    const name = component.role === "app" ? workspace.name : `${workspace.name} ${component.name.toLowerCase()}`;
    if (existing && existing.versionNumber === design.position) return existing.slug;
    const value = existing?.slug ?? slug();
    const row = { slug: value, workspaceId: workspace._id, componentId, name, kind: design.kind, doc: design.doc, versionNumber: design.position, createdAt: Date.now() };
    if (existing) await ctx.db.replace("shares", existing._id, row);
    else await ctx.db.insert("shares", row);
    return value;
  },
});

export const load = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const share = await ctx.db
      .query("shares")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!share) return null;
    const assets: Record<string, string> = {};
    for (const raw of imageSources((share.doc as AppDoc).root)) {
      const id = ctx.db.normalizeId("assets", raw);
      const asset = id ? await ctx.db.get("assets", id) : null;
      if (asset?.workspaceId !== share.workspaceId) continue;
      const url = await ctx.storage.getUrl(asset.storageId);
      if (url) assets[raw] = url;
    }
    return { name: share.name, kind: share.kind, doc: share.doc as AppDoc, assets };
  },
});
