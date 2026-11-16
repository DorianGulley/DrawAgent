import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { designScope } from "./schema";
import { ownerHashFor } from "./lib";
import { loadMemory, saveMemory } from "./style";
import { findTemplate, kindOf } from "../shared/kinds";
import { AppDoc } from "../shared/model";
import { EditError, Operation, applyOperations } from "../shared/operations";
import { applyProfile, profileOf, tallyOperations, untallyOperations } from "../shared/style";

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

export async function insertDesign(ctx: MutationCtx, ownerHash: string, kindId: string, templateId: string) {
  const kind = kindOf(kindId);
  const template = findTemplate(kindId, templateId);
  const { memory } = await loadMemory(ctx, ownerHash);
  const seeded = applyProfile(template.doc, kind, profileOf(memory));
  const doc = seeded.length ? applyOperations(template.doc, kind, seeded).doc : template.doc;
  const designId = await insertDesignDoc(ctx, ownerHash, kind.id, doc, {
    templateId: template.id,
    name: template.name,
    emoji: template.emoji,
    summary: seeded.length ? `Started from ${template.name}, in your style` : `Started from ${template.name}`,
  });
  return { designId, seeded: seeded.length > 0 };
}

export async function insertDesignDoc(
  ctx: MutationCtx,
  ownerHash: string,
  kindId: string,
  doc: AppDoc,
  meta: { templateId: string; name: string; emoji: string; summary: string },
) {
  const now = Date.now();
  const designId = await ctx.db.insert("designs", {
    ownerHash,
    kind: kindId,
    templateId: meta.templateId,
    name: meta.name,
    emoji: meta.emoji,
    doc,
    position: 0,
    versionCount: 0,
    updatedAt: now,
  });
  await ctx.db.insert("designVersions", { designId, number: 0, doc, summary: meta.summary, operations: [], changedIds: [], scope: "start", createdAt: now });
  return designId;
}

export const create = mutation({
  args: { deviceKey: v.string(), kind: v.string(), templateId: v.string() },
  handler: async (ctx, { deviceKey, kind, templateId }) => await insertDesign(ctx, await ownerHashFor(deviceKey), kind, templateId),
});

export async function commitOperations(
  ctx: MutationCtx,
  design: Doc<"designs">,
  ownerHash: string,
  input: { operations: Operation[]; summary: string; scope: Doc<"designVersions">["scope"]; instruction?: string; fromNumber?: number },
) {
  const parent = input.fromNumber ?? design.position;
  const base = parent === design.position ? design.doc : (await versionAt(ctx, design._id, parent))?.doc;
  if (!base) return { ok: false as const, message: "That version is gone" };
  let result;
  try {
    result = applyOperations(base as AppDoc, kindOf(design.kind), input.operations);
  } catch (error) {
    if (error instanceof EditError) return { ok: false as const, message: error.message };
    throw error;
  }
  const number = design.versionCount + 1;
  await ctx.db.insert("designVersions", {
    designId: design._id,
    number,
    doc: result.doc,
    summary: input.summary.slice(0, 160) || "Changed the look",
    operations: result.operations,
    changedIds: result.changedIds,
    scope: input.scope,
    instruction: input.instruction?.slice(0, 500),
    parent,
    createdAt: Date.now(),
  });
  await ctx.db.patch("designs", design._id, { doc: result.doc, position: number, versionCount: number, updatedAt: Date.now() });
  if (input.scope !== "everything" && input.scope !== "agent") {
    const { memory } = await loadMemory(ctx, ownerHash);
    await saveMemory(ctx, ownerHash, tallyOperations(memory, result.doc, result.operations));
  }
  return { ok: true as const, number, changedIds: result.changedIds };
}

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
    return await commitOperations(ctx, design, ownerHash, { operations: operations as Operation[], summary, scope, instruction });
  },
});

export const undo = mutation({
  args: { deviceKey: v.string(), designId: v.id("designs") },
  handler: async (ctx, { deviceKey, designId }) => {
    const { design, ownerHash } = await ownedDesign(ctx, deviceKey, designId);
    const current = await versionAt(ctx, designId, design.position);
    if (!current || current.number === 0) return null;
    const previous = await versionAt(ctx, designId, current.parent ?? current.number - 1);
    if (!previous) return null;
    await moveTo(ctx, design, previous);
    if (current.scope === "everything" || current.scope === "agent") return { changedIds: current.changedIds, summary: current.summary };
    const { memory } = await loadMemory(ctx, ownerHash);
    await saveMemory(ctx, ownerHash, untallyOperations(memory, current.doc as AppDoc, current.operations as Operation[]));
    return { changedIds: current.changedIds, summary: current.summary };
  },
});

export const versions = query({
  args: { deviceKey: v.string(), designId: v.id("designs") },
  handler: async (ctx, { deviceKey, designId }) => {
    const ownerHash = await ownerHashFor(deviceKey);
    const design = await ctx.db.get("designs", designId);
    if (!design || design.ownerHash !== ownerHash) return null;
    const rows = await ctx.db
      .query("designVersions")
      .withIndex("by_designId_and_number", (q) => q.eq("designId", designId))
      .order("desc")
      .take(60);
    return rows.reverse().map((row) => ({
      number: row.number,
      parent: row.parent ?? null,
      doc: row.doc as AppDoc,
      summary: row.summary,
      scope: row.scope,
      changedIds: row.changedIds,
      createdAt: row.createdAt,
    }));
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
