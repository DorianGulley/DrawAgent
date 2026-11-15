import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { TEMPLATES, TemplateId } from "../shared/templates";

async function createProject(ctx: MutationCtx, templateId: TemplateId, now: number) {
  const template = TEMPLATES[templateId];
  const projectId = await ctx.db.insert("projects", {
    name: template.name,
    tagline: template.tagline,
    emoji: template.emoji,
    templateId,
    doc: template.doc,
    versionCount: 1,
    updatedAt: now,
  });
  const versionId = await ctx.db.insert("versions", {
    projectId,
    number: 1,
    doc: template.doc,
    summary: "Original",
    operations: [],
    changedIds: [],
    createdAt: now,
  });
  await ctx.db.patch("projects", projectId, { currentVersionId: versionId });
  return projectId;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").withIndex("by_updatedAt").order("desc").take(50);
    return await Promise.all(
      projects.map(async (project) => {
        const current = project.currentVersionId ? await ctx.db.get("versions", project.currentVersionId) : null;
        return { ...project, currentNumber: current?.number ?? 1 };
      }),
    );
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get("projects", projectId);
    if (!project) return null;
    const current = project.currentVersionId ? await ctx.db.get("versions", project.currentVersionId) : null;
    return { ...project, current };
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("projects").take(1);
    if (existing.length > 0) return null;
    const now = Date.now();
    await createProject(ctx, "dashboard", now - 1000);
    await createProject(ctx, "habits", now);
    return null;
  },
});

export const createFromTemplate = mutation({
  args: { templateId: v.union(v.literal("habits"), v.literal("dashboard")) },
  handler: async (ctx, { templateId }) => createProject(ctx, templateId, Date.now()),
});
