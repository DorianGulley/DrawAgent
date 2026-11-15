import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { designScope } from "./schema";
import { ownerHashFor } from "./lib";
import { loadMemory, saveMemory } from "./style";
import { findTemplate, kindOf } from "../shared/kinds";
import { AppDoc } from "../shared/model";
import { EditError, Operation, applyOperations } from "../shared/operations";
import { applyProfile, profileOf, tallyOperations } from "../shared/style";

async function ownedDesign(ctx: MutationCtx, deviceKey: string, designId: Id<"designs">) {
  const ownerHash = await ownerHashFor(deviceKey);
  const design = await ctx.db.get("designs", designId);
  if (!design || design.ownerHash !== ownerHash) throw new Error("Design not found");
  return { design, ownerHash };
}

async function versionAt(ctx: MutationCtx, designId: Id<"designs">, number: number) {
  return await ctx.db
    .query("designVersions")
    .withIndex("by_designId_and_number", (q) => q.eq("designId", designId).eq("number", number))
    .unique();
}

async function moveTo(ctx: MutationCtx, design: Doc<"designs">, version: Doc<"designVersions">) {
  await ctx.db.patch("designs", design._id, { doc: version.doc, position: version.number, updatedAt: Date.now() });
}

export const list = query({
  args: { deviceKey: v.string() },
  handler: async (ctx, { deviceKey }) => {
    const ownerHash = await ownerHashFor(deviceKey);
    return await ctx.db
      .query("designs")
      .withIndex("by_ownerHash_and_updatedAt", (q) => q.eq("ownerHash", ownerHash))
      .order("desc")
      .take(100);
  },
});

export const get = query({
  args: { deviceKey: v.string(), designId: v.id("designs") },
  handler: async (ctx, { deviceKey, designId }) => {
    const ownerHash = await ownerHashFor(deviceKey);
    const design = await ctx.db.get("designs", designId);
    if (!design || design.ownerHash !== ownerHash) return null;
    const versions = await ctx.db
      .query("designVersions")
      .withIndex("by_designId_and_number", (q) => q.eq("designId", designId))
      .order("desc")
      .take(60);
    return {
      ...design,
      history: versions.map(({ doc: _doc, ...rest }) => ({ ...rest, operations: rest.operations as Operation[] })),
    };
  },
});

export const create = mutation({
  args: { deviceKey: v.string(), kind: v.string(), templateId: v.string() },
  handler: async (ctx, { deviceKey, kind: kindId, templateId }) => {
    const ownerHash = await ownerHashFor(deviceKey);
    const kind = kindOf(kindId);
    const template = findTemplate(kindId, templateId);
    const { memory } = await loadMemory(ctx, ownerHash);
    const seeded = applyProfile(template.doc, kind, profileOf(memory));
    const doc = seeded.length ? applyOperations(template.doc, kind, seeded).doc : template.doc;
    const now = Date.now();
    const designId = await ctx.db.insert("designs", {
      ownerHash,
      kind: kind.id,
      templateId: template.id,
      name: template.name,
      emoji: template.emoji,
      doc,
      position: 0,
      versionCount: 0,
      updatedAt: now,
    });
    await ctx.db.insert("designVersions", {
      designId,
      number: 0,
      doc,
      summary: seeded.length ? `Started from ${template.name}, in your style` : `Started from ${template.name}`,
      operations: [],
      changedIds: [],
      scope: "start",
      createdAt: now,
    });
    return { designId, seeded: seeded.length > 0 };
  },
});

export const commit = mutation({
  args: {
    deviceKey: v.string(),
    designId: v.id("designs"),
    operations: v.array(v.any()),
    summary: v.string(),
    scope: designScope,
    instruction: v.optional(v.string()),
  },
  handler: async (ctx, { deviceKey, designId, operations, summary, scope, instruction }) => {
    const { design, ownerHash } = await ownedDesign(ctx, deviceKey, designId);
    let result;
    try {
      result = applyOperations(design.doc as AppDoc, kindOf(design.kind), operations as Operation[]);
    } catch (error) {
      if (error instanceof EditError) return { ok: false as const, message: error.message };
      throw error;
    }
    const stale = await ctx.db
      .query("designVersions")
      .withIndex("by_designId_and_number", (q) => q.eq("designId", designId).gt("number", design.position))
      .take(200);
    for (const row of stale) await ctx.db.delete("designVersions", row._id);
    const number = design.position + 1;
    await ctx.db.insert("designVersions", {
      designId,
      number,
      doc: result.doc,
      summary: summary.slice(0, 120) || "Changed the look",
      operations: result.operations,
      changedIds: result.changedIds,
      scope,
      instruction: instruction?.slice(0, 300),
      createdAt: Date.now(),
    });
    await ctx.db.patch("designs", designId, { doc: result.doc, position: number, versionCount: number, updatedAt: Date.now() });
    const { memory } = await loadMemory(ctx, ownerHash);
    await saveMemory(ctx, ownerHash, tallyOperations(memory, result.doc, result.operations));
    return { ok: true as const, number, changedIds: result.changedIds };
  },
});

export const undo = mutation({
  args: { deviceKey: v.string(), designId: v.id("designs") },
  handler: async (ctx, { deviceKey, designId }) => {
    const { design } = await ownedDesign(ctx, deviceKey, designId);
    if (design.position <= 0) return null;
    const current = await versionAt(ctx, designId, design.position);
    const previous = await versionAt(ctx, designId, design.position - 1);
    if (!current || !previous) return null;
    await moveTo(ctx, design, previous);
    return { changedIds: current.changedIds, summary: current.summary };
  },
});

export const goBack = mutation({
  args: { deviceKey: v.string(), designId: v.id("designs"), number: v.number() },
  handler: async (ctx, { deviceKey, designId, number }) => {
    const { design } = await ownedDesign(ctx, deviceKey, designId);
    const version = await versionAt(ctx, designId, number);
    if (!version) throw new Error("That look is gone");
    await moveTo(ctx, design, version);
    return null;
  },
});

export const rename = mutation({
  args: { deviceKey: v.string(), designId: v.id("designs"), name: v.string() },
  handler: async (ctx, { deviceKey, designId, name }) => {
    await ownedDesign(ctx, deviceKey, designId);
    const clean = name.replace(/\s+/g, " ").trim().slice(0, 40);
    if (clean) await ctx.db.patch("designs", designId, { name: clean });
    return null;
  },
});

export const remove = mutation({
  args: { deviceKey: v.string(), designId: v.id("designs") },
  handler: async (ctx, { deviceKey, designId }) => {
    await ownedDesign(ctx, deviceKey, designId);
    const versions = await ctx.db
      .query("designVersions")
      .withIndex("by_designId_and_number", (q) => q.eq("designId", designId))
      .take(500);
    for (const row of versions) await ctx.db.delete("designVersions", row._id);
    await ctx.db.delete("designs", designId);
    return null;
  },
});
