import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { cleanText, ownerHashFor } from "./lib";
import { recall, remember } from "./memory";
import { complete, parseJson } from "./models";
import { decryptSecret } from "./secrets";
import { componentsOf, ownedWorkspace, workspaceContext } from "./workspaces";

const COOLDOWN_MS = 2 * 60 * 1000;

async function ownedSuggestion(ctx: MutationCtx, deviceKey: string, suggestionId: Id<"suggestions">) {
  const suggestion = await ctx.db.get("suggestions", suggestionId);
  if (!suggestion) throw new Error("Suggestion not found");
  const { workspace } = await ownedWorkspace(ctx, deviceKey, suggestion.workspaceId);
  return { suggestion, workspace };
}

export async function scheduleSuggestions(ctx: MutationCtx, workspace: Doc<"workspaces">, force = false) {
  if (!workspace.keyId) return;
  if (!force && workspace.suggestedAt && Date.now() - workspace.suggestedAt < COOLDOWN_MS) return;
  await ctx.db.patch("workspaces", workspace._id, { suggestedAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.suggestions.generate, { workspaceId: workspace._id });
}

export const forComponent = query({
  args: { deviceKey: v.string(), componentId: v.id("components") },
  handler: async (ctx, { deviceKey, componentId }) => {
    const component = await ctx.db.get("components", componentId);
    if (!component) return [];
    const workspace = await ctx.db.get("workspaces", component.workspaceId);
    if (!workspace || workspace.ownerHash !== (await ownerHashFor(deviceKey))) return [];
    const rows = await ctx.db
      .query("suggestions")
      .withIndex("by_componentId_and_status", (q) => q.eq("componentId", componentId).eq("status", "pending"))
      .take(3);
    return rows.map(({ _id, title, reason, instruction }) => ({ _id, title, reason, instruction }));
  },
});

export const request = mutation({
  args: { deviceKey: v.string(), workspaceId: v.id("workspaces") },
  handler: async (ctx, { deviceKey, workspaceId }) => {
    const { workspace } = await ownedWorkspace(ctx, deviceKey, workspaceId);
    const pending = await ctx.db
      .query("suggestions")
      .withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspaceId).eq("status", "pending"))
      .first();
    const edited = await ctx.db
      .query("agentRuns")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
      .first();
    if (pending || !edited) return null;
    await scheduleSuggestions(ctx, workspace);
    return null;
  },
});

export const apply = mutation({
  args: { deviceKey: v.string(), suggestionId: v.id("suggestions") },
  handler: async (ctx, { deviceKey, suggestionId }) => {
    const { suggestion, workspace } = await ownedSuggestion(ctx, deviceKey, suggestionId);
    if (suggestion.status !== "pending") return null;
    if (!workspace.keyId) throw new Error("Pick an API key for this workspace first");
    const component = await ctx.db.get("components", suggestion.componentId);
    const design = component?.designId ? await ctx.db.get("designs", component.designId) : null;
    if (!component || !design) throw new Error("That part is gone");
    const runId = await ctx.db.insert("agentRuns", {
      componentId: component._id,
      workspaceId: workspace._id,
      note: suggestion.instruction,
      marks: [],
      baseNumber: design.position,
      status: "queued",
      message: "Applying Clay's suggestion",
      suggestionId,
      updatedAt: Date.now(),
    });
    await ctx.db.patch("suggestions", suggestionId, { status: "applied", runId });
    await ctx.scheduler.runAfter(0, internal.clay.run, { runId });
    return runId;
  },
});

export const decline = mutation({
  args: { deviceKey: v.string(), suggestionId: v.id("suggestions") },
  handler: async (ctx, { deviceKey, suggestionId }) => {
    const { suggestion, workspace } = await ownedSuggestion(ctx, deviceKey, suggestionId);
    if (suggestion.status !== "pending") return null;
    await ctx.db.patch("suggestions", suggestionId, { status: "declined" });
    const component = await ctx.db.get("components", suggestion.componentId);
    await ctx.scheduler.runAfter(0, internal.suggestions.rememberDecline, {
      workspaceId: workspace._id,
      text: `User declined Clay's suggestion for the ${component?.name ?? "part"}: "${suggestion.title}" (${suggestion.instruction}). Don't suggest this again.`,
      workspaceName: workspace.name,
    });
    return null;
  },
});

export const rememberDecline = internalAction({
  args: { workspaceId: v.id("workspaces"), text: v.string(), workspaceName: v.string() },
  handler: async (_ctx, { workspaceId, text, workspaceName }) => {
    await remember(workspaceId, text, { workspace: workspaceName, kind: "declined-suggestion" });
    return null;
  },
});

export const load = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get("workspaces", workspaceId);
    if (!workspace?.keyId) return null;
    const key = await ctx.db.get("apiKeys", workspace.keyId);
    if (!key) return null;
    const parts = (await componentsOf(ctx, workspaceId)).filter((component) => component.designId);
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(12);
    const past = await ctx.db
      .query("suggestions")
      .withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspaceId).eq("status", "declined"))
      .order("desc")
      .take(15);
    const names = new Map(parts.map((part) => [part._id as string, part.name]));
    return {
      workspaceName: workspace.name,
      context: await workspaceContext(ctx, workspaceId),
      parts: parts.map((part) => ({ id: part._id, name: part.name, role: part.role })),
      edits: runs
        .filter((run) => run.status === "done")
        .map((run) => `${names.get(run.componentId) ?? "a part"}: asked "${run.note || "(marks only)"}" → ${run.summary ?? ""}`),
      declined: past.map((row) => `${names.get(row.componentId) ?? "a part"}: ${row.title}`),
      key: { provider: key.provider, model: key.model, ciphertext: key.ciphertext, iv: key.iv },
    };
  },
});

export const store = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    items: v.array(v.object({ componentId: v.id("components"), title: v.string(), reason: v.string(), instruction: v.string() })),
  },
  handler: async (ctx, { workspaceId, items }) => {
    const stale = await ctx.db
      .query("suggestions")
      .withIndex("by_workspaceId_and_status", (q) => q.eq("workspaceId", workspaceId).eq("status", "pending"))
      .take(50);
    for (const row of stale) await ctx.db.patch("suggestions", row._id, { status: "stale" });
    const valid = new Set((await componentsOf(ctx, workspaceId)).filter((component) => component.designId).map((component) => component._id as string));
    for (const item of items.slice(0, 3)) {
      if (!valid.has(item.componentId)) continue;
      await ctx.db.insert("suggestions", {
        workspaceId,
        componentId: item.componentId,
        title: cleanText(item.title, 70),
        reason: cleanText(item.reason, 200),
        instruction: cleanText(item.instruction, 400),
        status: "pending",
        createdAt: Date.now(),
      });
    }
    return null;
  },
});

const SYSTEM = `You are Clay's design partner. Clay is an app where people shape one app and its parts (logo, app icon). You look at what this person has asked for before and what Clay remembers about their taste, and propose a few small, specific changes they would likely want next.

Answer with one JSON object, nothing else:
{"suggestions": [{"partId": "<id of the part to change>", "title": "<imperative, at most 8 words>", "reason": "<one sentence tying it to what they did or prefer, addressed to them as you>", "instruction": "<a precise design request Clay's editor can carry out on that part>"}]}

Rules: propose 0 to 3 suggestions. Ground each one in their past edits or remembered preferences, such as carrying a color they chose on one part to another part that still uses the old one. Never repeat something they declined. Never propose something already done. Only target the listed part ids. If nothing is worth suggesting, return an empty list.`;

export const generate = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }): Promise<null> => {
    const data = await ctx.runQuery(internal.suggestions.load, { workspaceId });
    if (!data || data.parts.length === 0 || data.edits.length === 0) return null;
    const remembered = await recall(workspaceId, "design preferences, colors, style, things the user liked or declined");
    const request = [
      data.context,
      remembered ? `\nWhat Clay remembers about this person in this workspace (from their Supermemory profile and past sessions):\n${remembered}` : "",
      `\nTheir recent edits, newest first:\n${data.edits.map((line) => `- ${line}`).join("\n")}`,
      data.declined.length ? `\nSuggestions they declined (never repeat these):\n${data.declined.map((line) => `- ${line}`).join("\n")}` : "",
      `\nParts you can target:\n${data.parts.map((part) => `- ${part.id}: ${part.name} (${part.role})`).join("\n")}`,
      "\nAnswer in JSON.",
    ].join("\n");
    try {
      const apiKey = await decryptSecret(data.key.ciphertext, data.key.iv);
      const answer = await complete(data.key.provider, apiKey, data.key.model, SYSTEM, request, []);
      const parsed = parseJson(answer) as { suggestions?: unknown };
      const items = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
        .filter((item): item is { partId: string; title: string; reason: string; instruction: string } =>
          Boolean(item) && typeof item.partId === "string" && typeof item.title === "string" && typeof item.instruction === "string",
        )
        .filter((item) => data.parts.some((part) => part.id === item.partId))
        .map((item) => ({ componentId: item.partId as Id<"components">, title: item.title, reason: typeof item.reason === "string" ? item.reason : "", instruction: item.instruction }));
      await ctx.runMutation(internal.suggestions.store, { workspaceId, items });
    } catch (error) {
      console.warn("Suggestions failed", error instanceof Error ? error.message : error);
    }
    return null;
  },
});
