import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { TEMPLATES, TemplateId } from "../shared/templates";

export async function checkoutVersion(ctx: MutationCtx, project: Doc<"projects">, version: Doc<"versions">) {
  await ctx.db.patch("projects", project._id, { doc: version.doc, currentVersionId: version._id, updatedAt: Date.now() });
}

export async function commitVersion(
  ctx: MutationCtx,
  project: Doc<"projects">,
  fields: Pick<Doc<"versions">, "doc" | "summary" | "operations" | "changedIds" | "instruction" | "elementId">,
): Promise<Id<"versions">> {
  const number = project.versionCount + 1;
  const versionId = await ctx.db.insert("versions", {
    ...fields,
    projectId: project._id,
    number,
    parentId: project.currentVersionId,
    createdAt: Date.now(),
  });
  await ctx.db.patch("projects", project._id, {
    doc: fields.doc,
    currentVersionId: versionId,
    versionCount: number,
    updatedAt: Date.now(),
  });
  return versionId;
}

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const rows = await ctx.db
      .query("versions")
      .withIndex("by_projectId_and_number", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(100);
    return rows.map(({ doc: _doc, ...rest }) => rest);
  },
});

export const checkout = mutation({
  args: { projectId: v.id("projects"), versionId: v.id("versions") },
  handler: async (ctx, { projectId, versionId }) => {
    const project = await ctx.db.get("projects", projectId);
    const version = await ctx.db.get("versions", versionId);
    if (!project || !version || version.projectId !== projectId) throw new Error("Version not found");
    await checkoutVersion(ctx, project, version);
    return null;
  },
});

export const undo = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get("projects", projectId);
    if (!project?.currentVersionId) return null;
    const current = await ctx.db.get("versions", project.currentVersionId);
    const parent = current?.parentId ? await ctx.db.get("versions", current.parentId) : null;
    if (!current || !parent) return null;
    await checkoutVersion(ctx, project, parent);
    return { changedIds: current.changedIds, summary: current.summary };
  },
});

export const resetToOriginal = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get("projects", projectId);
    if (!project) throw new Error("Project not found");
    await commitVersion(ctx, project, {
      doc: TEMPLATES[project.templateId as TemplateId].doc,
      summary: "Reset to original",
      operations: [],
      changedIds: [],
    });
    return null;
  },
});
