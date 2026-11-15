import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    tagline: v.string(),
    emoji: v.string(),
    templateId: v.string(),
    doc: v.any(),
    currentVersionId: v.optional(v.id("versions")),
    versionCount: v.number(),
    updatedAt: v.number(),
  }).index("by_updatedAt", ["updatedAt"]),
  versions: defineTable({
    projectId: v.id("projects"),
    number: v.number(),
    parentId: v.optional(v.id("versions")),
    doc: v.any(),
    summary: v.string(),
    instruction: v.optional(v.string()),
    elementId: v.optional(v.string()),
    operations: v.any(),
    changedIds: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_projectId_and_number", ["projectId", "number"]),
});
