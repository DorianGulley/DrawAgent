import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { ownerHashFor } from "./lib";
import {
  CATEGORY_LABELS,
  EMPTY_MEMORY,
  STYLE_CATEGORIES,
  StyleCategory,
  StyleMemory,
  describePreference,
  evidenceCount,
  profileOf,
} from "../shared/style";

export async function loadMemory(ctx: QueryCtx | MutationCtx, ownerHash: string) {
  const row = await ctx.db
    .query("styleMemory")
    .withIndex("by_ownerHash", (q) => q.eq("ownerHash", ownerHash))
    .unique();
  const memory: StyleMemory = row ? { tallies: row.tallies, overrides: row.overrides } : EMPTY_MEMORY;
  return { row, memory };
}

export async function saveMemory(ctx: MutationCtx, ownerHash: string, memory: StyleMemory) {
  const { row } = await loadMemory(ctx, ownerHash);
  const fields = {
    tallies: memory.tallies as Record<string, (number | string)[]>,
    overrides: memory.overrides as Record<string, number | string>,
    updatedAt: Date.now(),
  };
  if (row) await ctx.db.patch("styleMemory", row._id, fields);
  else await ctx.db.insert("styleMemory", { ownerHash, ...fields });
}

const category = v.union(...STYLE_CATEGORIES.map((name) => v.literal(name)));

export const get = query({
  args: { deviceKey: v.string() },
  handler: async (ctx, { deviceKey }) => {
    const { memory } = await loadMemory(ctx, await ownerHashFor(deviceKey));
    const profile = profileOf(memory);
    const entries = STYLE_CATEGORIES.filter((name) => profile[name] !== undefined).map((name) => ({
      category: name,
      label: CATEGORY_LABELS[name],
      value: profile[name]!,
      description: describePreference(name, profile[name]!),
      evidence: evidenceCount(memory, name),
      chosen: memory.overrides[name] !== undefined,
    }));
    return { profile, entries };
  },
});

function validValue(name: StyleCategory, value: number | string): number | string {
  if (name === "accent" || name === "surface") {
    if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error("Pick a color");
    return value.toUpperCase();
  }
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Pick a value");
  const ranges: Record<string, [number, number]> = { radius: [0, 999], padding: [0, 64], gap: [0, 48], weight: [300, 900] };
  const [min, max] = ranges[name];
  return Math.round(Math.min(max, Math.max(min, value)));
}

export const setPreference = mutation({
  args: { deviceKey: v.string(), category, value: v.union(v.number(), v.string()) },
  handler: async (ctx, { deviceKey, category: name, value }) => {
    const ownerHash = await ownerHashFor(deviceKey);
    const { memory } = await loadMemory(ctx, ownerHash);
    await saveMemory(ctx, ownerHash, { ...memory, overrides: { ...memory.overrides, [name]: validValue(name, value) } });
    return null;
  },
});

export const remove = mutation({
  args: { deviceKey: v.string(), category },
  handler: async (ctx, { deviceKey, category: name }) => {
    const ownerHash = await ownerHashFor(deviceKey);
    const { memory } = await loadMemory(ctx, ownerHash);
    const tallies = { ...memory.tallies };
    const overrides = { ...memory.overrides };
    delete tallies[name];
    delete overrides[name];
    await saveMemory(ctx, ownerHash, { tallies, overrides });
    return null;
  },
});

export const reset = mutation({
  args: { deviceKey: v.string() },
  handler: async (ctx, { deviceKey }) => {
    const ownerHash = await ownerHashFor(deviceKey);
    await saveMemory(ctx, ownerHash, EMPTY_MEMORY);
    return null;
  },
});
