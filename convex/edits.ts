import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { interpret } from "../shared/interpreter";
import { EditError, applyOperations } from "../shared/operations";
import { AppDoc } from "../shared/model";
import { commitVersion } from "./versions";

export const submit = mutation({
  args: { projectId: v.id("projects"), elementId: v.string(), instruction: v.string() },
  handler: async (ctx, { projectId, elementId, instruction }) => {
    const project = await ctx.db.get("projects", projectId);
    if (!project) throw new Error("Project not found");
    const doc = project.doc as AppDoc;
    const plan = interpret(doc, elementId, instruction.slice(0, 300));
    if (!plan.ok) return { ok: false as const, message: plan.message };
    try {
      const result = applyOperations(doc, plan.operations);
      const versionId = await commitVersion(ctx, project, {
        doc: result.doc,
        summary: plan.summary,
        operations: result.operations,
        changedIds: result.changedIds,
        instruction,
        elementId,
      });
      return { ok: true as const, versionId, summary: plan.summary, targetId: plan.targetId, changedIds: result.changedIds, number: project.versionCount + 1 };
    } catch (error) {
      if (error instanceof EditError) return { ok: false as const, message: error.message };
      throw error;
    }
  },
});
