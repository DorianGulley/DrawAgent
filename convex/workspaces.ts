import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { insertDesign, insertDesignDoc } from "./designs";
import { cleanText, ownerHashFor } from "./lib";
import { componentRole } from "./schema";
import { outline } from "../shared/context";
import { KINDS } from "../shared/kinds";
import { AppDoc } from "../shared/model";

const DEFAULT_USAGE: Record<Doc<"components">["role"], string> = {
  app: "The app itself. It shows the logo in its header and uses the app icon on the home screen.",
  logo: "The brand mark. It appears in the app's header and inspires the app icon.",
  icon: "The app's home screen icon. It should match the logo and the app's colors.",
};

const ROLE_NAMES: Record<Doc<"components">["role"], string> = { app: "App", logo: "Logo", icon: "App icon" };

export async function ownedWorkspace(ctx: QueryCtx | MutationCtx, deviceKey: string, workspaceId: Id<"workspaces">) {
  const ownerHash = await ownerHashFor(deviceKey);
  const workspace = await ctx.db.get("workspaces", workspaceId);
  if (!workspace || workspace.ownerHash !== ownerHash) throw new Error("Workspace not found");
  return { workspace, ownerHash };
}

export async function componentsOf(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  return await ctx.db
    .query("components")
    .withIndex("by_workspaceId_and_order", (q) => q.eq("workspaceId", workspaceId))
    .take(30);
}

async function hydrate(ctx: QueryCtx, component: Doc<"components">) {
  const run = await ctx.db
    .query("agentRuns")
    .withIndex("by_componentId", (q) => q.eq("componentId", component._id))
    .order("desc")
    .first();
  const design = component.designId ? await ctx.db.get("designs", component.designId) : null;
  const project = component.projectId ? await ctx.db.get("projects", component.projectId) : null;
  const latest = project?.latestVersionId ? await ctx.db.get("versions", project.latestVersionId) : null;
  return {
    ...component,
    run: run ? { _id: run._id, status: run.status, message: run.message, summary: run.summary ?? null, updatedAt: run.updatedAt } : null,
    design: design
      ? { _id: design._id, kind: design.kind, doc: design.doc as AppDoc, position: design.position, versionCount: design.versionCount, updatedAt: design.updatedAt }
      : null,
    project: project
      ? {
          _id: project._id,
          name: project.name,
          url: project.url,
          agent: project.agent,
          versionCount: project.versionCount,
          latestSummary: latest?.summary ?? null,
          afterUrl: latest?.afterImageId ? await ctx.storage.getUrl(latest.afterImageId) : null,
          updatedAt: project.updatedAt,
        }
      : null,
  };
}

export async function workspaceContext(ctx: QueryCtx, workspaceId: Id<"workspaces">, focusId?: Id<"components">): Promise<string> {
  const workspace = await ctx.db.get("workspaces", workspaceId);
  if (!workspace) return "";
  const parts: string[] = [`Workspace "${workspace.name}". It is one app and the parts that belong to it. How each part relates to the others is described in its "usage".`];
  for (const [index, component] of (await componentsOf(ctx, workspaceId)).entries()) {
    const focus = component._id === focusId ? " (THIS IS THE PART BEING EDITED)" : "";
    const lines = [`${index + 1}. ${component.name} [${component.role}]${focus}`, `   usage: ${component.usage}`];
    if (component.projectId) {
      const project = await ctx.db.get("projects", component.projectId);
      if (project) {
        const versions = await ctx.db
          .query("versions")
          .withIndex("by_projectId_and_number", (q) => q.eq("projectId", project._id))
          .order("desc")
          .take(5);
        lines.push(`   live web app at ${project.url}, built by a coding agent (${project.agent}). Recent versions:`);
        for (const version of versions) lines.push(`     v${version.number}: ${version.summary}`);
      }
    }
    if (component.designId) {
      const design = await ctx.db.get("designs", component.designId);
      if (design) {
        const kind = KINDS[design.kind];
        lines.push(`   in-app ${kind?.name ?? design.kind} design, version ${design.position}, canvas ${kind?.canvas.width}x${kind?.canvas.height ?? "auto"}. Structure:`);
        lines.push(outline(design.doc as AppDoc, 60).replace(/^/gm, "     "));
      }
    }
    parts.push(lines.join("\n"));
  }
  return parts.join("\n\n");
}

export const list = query({
  args: { deviceKey: v.string() },
  handler: async (ctx, { deviceKey }) => {
    const ownerHash = await ownerHashFor(deviceKey);
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_ownerHash_and_updatedAt", (q) => q.eq("ownerHash", ownerHash))
      .order("desc")
      .take(50);
    return await Promise.all(
      workspaces.map(async (workspace) => ({
        ...workspace,
        components: await Promise.all((await componentsOf(ctx, workspace._id)).map((component) => hydrate(ctx, component))),
      })),
    );
  },
});

export const get = query({
  args: { deviceKey: v.string(), workspaceId: v.id("workspaces") },
  handler: async (ctx, { deviceKey, workspaceId }) => {
    const ownerHash = await ownerHashFor(deviceKey);
    const workspace = await ctx.db.get("workspaces", workspaceId);
    if (!workspace || workspace.ownerHash !== ownerHash) return null;
    return {
      ...workspace,
      components: await Promise.all((await componentsOf(ctx, workspaceId)).map((component) => hydrate(ctx, component))),
    };
  },
});

export const component = query({
  args: { deviceKey: v.string(), componentId: v.id("components") },
  handler: async (ctx, { deviceKey, componentId }) => {
    const component = await ctx.db.get("components", componentId);
    if (!component) return null;
    const ownerHash = await ownerHashFor(deviceKey);
    const workspace = await ctx.db.get("workspaces", component.workspaceId);
    if (!workspace || workspace.ownerHash !== ownerHash) return null;
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_componentId", (q) => q.eq("componentId", componentId))
      .order("desc")
      .take(10);
    return {
      ...(await hydrate(ctx, component)),
      workspace: { _id: workspace._id, name: workspace.name, emoji: workspace.emoji },
      runs: runs.map(({ _id, status, message, summary, versionNumber, note, updatedAt, baseNumber }) => ({ _id, status, message, summary, versionNumber, note, updatedAt, baseNumber })),
    };
  },
});

async function addPart(
  ctx: MutationCtx,
  ownerHash: string,
  workspaceId: Id<"workspaces">,
  role: Doc<"components">["role"],
  source: { templateId?: string; projectId?: Id<"projects"> },
  order: number,
) {
  if (source.projectId) {
    const project = await ctx.db.get("projects", source.projectId);
    if (!project) throw new Error("That connected app is gone");
    return await ctx.db.insert("components", { workspaceId, role, name: ROLE_NAMES[role], usage: DEFAULT_USAGE[role], projectId: project._id, order });
  }
  const kindId = role === "app" ? "app" : role;
  const templateId = source.templateId ?? KINDS[kindId].templates[0].id;
  const { designId } = await insertDesign(ctx, ownerHash, kindId, templateId);
  return await ctx.db.insert("components", { workspaceId, role, name: ROLE_NAMES[role], usage: DEFAULT_USAGE[role], designId, order });
}

export const create = mutation({
  args: {
    deviceKey: v.string(),
    name: v.string(),
    emoji: v.string(),
    appProjectId: v.optional(v.id("projects")),
    appTemplateId: v.optional(v.string()),
    appPrompt: v.optional(v.string()),
    logoTemplateId: v.optional(v.string()),
    iconTemplateId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerHash = await ownerHashFor(args.deviceKey);
    const workspaceId = await ctx.db.insert("workspaces", {
      ownerHash,
      name: cleanText(args.name, 40) || "Untitled",
      emoji: cleanText(args.emoji, 8) || "🏺",
      updatedAt: Date.now(),
    });
    const prompt = cleanText(args.appPrompt ?? "", 1200);
    if (prompt) {
      const doc: AppDoc = {
        schemaVersion: 1,
        root: {
          id: "screen",
          type: "screen",
          name: "Screen",
          style: {},
          children: [
            { id: "building-title", type: "heading", name: "Title", text: "Clay is building your app", style: { fontSize: 28 } },
            { id: "building-note", type: "text", name: "Description", text: prompt.slice(0, 80), style: {} },
          ],
        },
      };
      const designId = await insertDesignDoc(ctx, ownerHash, "app", doc, { templateId: "prompt", name: cleanText(args.name, 40) || "App", emoji: cleanText(args.emoji, 8) || "🏺", summary: "Your description" });
      const componentId = await ctx.db.insert("components", { workspaceId, role: "app", name: ROLE_NAMES.app, usage: DEFAULT_USAGE.app, designId, order: 0 });
      const runId = await ctx.db.insert("agentRuns", {
        componentId,
        workspaceId,
        note: prompt,
        marks: [],
        baseNumber: 0,
        status: "queued",
        message: "Sent to Clay",
        mode: "generate",
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.clay.run, { runId });
    } else {
      await addPart(ctx, ownerHash, workspaceId, "app", { projectId: args.appProjectId, templateId: args.appTemplateId }, 0);
    }
    if (args.logoTemplateId) await addPart(ctx, ownerHash, workspaceId, "logo", { templateId: args.logoTemplateId }, 1);
    if (args.iconTemplateId) await addPart(ctx, ownerHash, workspaceId, "icon", { templateId: args.iconTemplateId }, 2);
    return workspaceId;
  },
});

export const addComponent = mutation({
  args: { deviceKey: v.string(), workspaceId: v.id("workspaces"), role: componentRole, templateId: v.optional(v.string()), projectId: v.optional(v.id("projects")) },
  handler: async (ctx, { deviceKey, workspaceId, role, templateId, projectId }) => {
    const { ownerHash } = await ownedWorkspace(ctx, deviceKey, workspaceId);
    const existing = await componentsOf(ctx, workspaceId);
    const id = await addPart(ctx, ownerHash, workspaceId, role, { templateId, projectId }, existing.length);
    await ctx.db.patch("workspaces", workspaceId, { updatedAt: Date.now() });
    return id;
  },
});

export const updateComponent = mutation({
  args: { deviceKey: v.string(), componentId: v.id("components"), name: v.optional(v.string()), usage: v.optional(v.string()) },
  handler: async (ctx, { deviceKey, componentId, name, usage }) => {
    const component = await ctx.db.get("components", componentId);
    if (!component) throw new Error("Part not found");
    await ownedWorkspace(ctx, deviceKey, component.workspaceId);
    await ctx.db.patch("components", componentId, {
      ...(name !== undefined ? { name: cleanText(name, 40) || component.name } : {}),
      ...(usage !== undefined ? { usage: cleanText(usage, 400) } : {}),
    });
    return null;
  },
});

export const removeComponent = mutation({
  args: { deviceKey: v.string(), componentId: v.id("components") },
  handler: async (ctx, { deviceKey, componentId }) => {
    const component = await ctx.db.get("components", componentId);
    if (!component) return null;
    await ownedWorkspace(ctx, deviceKey, component.workspaceId);
    if (component.role === "app") throw new Error("A workspace always keeps its app");
    await ctx.db.delete("components", componentId);
    return null;
  },
});

export const update = mutation({
  args: { deviceKey: v.string(), workspaceId: v.id("workspaces"), name: v.optional(v.string()), emoji: v.optional(v.string()) },
  handler: async (ctx, { deviceKey, workspaceId, name, emoji }) => {
    await ownedWorkspace(ctx, deviceKey, workspaceId);
    await ctx.db.patch("workspaces", workspaceId, {
      ...(name !== undefined ? { name: cleanText(name, 40) || "Untitled" } : {}),
      ...(emoji !== undefined ? { emoji: cleanText(emoji, 8) || "🏺" } : {}),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { deviceKey: v.string(), workspaceId: v.id("workspaces") },
  handler: async (ctx, { deviceKey, workspaceId }) => {
    await ownedWorkspace(ctx, deviceKey, workspaceId);
    for (const component of await componentsOf(ctx, workspaceId)) await ctx.db.delete("components", component._id);
    await ctx.db.delete("workspaces", workspaceId);
    return null;
  },
});
