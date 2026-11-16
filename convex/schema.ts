import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const feedbackStatus = v.union(
  v.literal("pending"),
  v.literal("claimed"),
  v.literal("working"),
  v.literal("published"),
  v.literal("failed"),
);

export const designScope = v.union(
  v.literal("start"),
  v.literal("one"),
  v.literal("many"),
  v.literal("everything"),
  v.literal("example"),
  v.literal("agent"),
);

export const provider = v.union(v.literal("openai"), v.literal("anthropic"));
export const componentRole = v.union(v.literal("app"), v.literal("logo"), v.literal("icon"));
export const runStatus = v.union(v.literal("queued"), v.literal("thinking"), v.literal("done"), v.literal("failed"));

export const elementInfo = v.object({
  selector: v.string(),
  tag: v.string(),
  text: v.string(),
  styles: v.record(v.string(), v.string()),
});

export const mark = v.object({
  kind: v.union(v.literal("pen"), v.literal("arrow"), v.literal("circle"), v.literal("text")),
  tag: v.union(v.literal("change"), v.literal("broken"), v.literal("keep")),
  points: v.array(v.object({ x: v.number(), y: v.number() })),
  text: v.optional(v.string()),
  elements: v.array(elementInfo),
});

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    url: v.string(),
    emoji: v.string(),
    agent: v.string(),
    keyHash: v.string(),
    versionCount: v.number(),
    latestVersionId: v.optional(v.id("versions")),
    updatedAt: v.number(),
  })
    .index("by_updatedAt", ["updatedAt"])
    .index("by_keyHash", ["keyHash"]),
  feedback: defineTable({
    projectId: v.id("projects"),
    note: v.string(),
    marks: v.array(mark),
    imageId: v.optional(v.id("_storage")),
    viewport: v.object({ width: v.number(), height: v.number(), scrollY: v.number() }),
    pageUrl: v.string(),
    baseVersionId: v.optional(v.id("versions")),
    status: feedbackStatus,
    statusMessage: v.optional(v.string()),
    versionId: v.optional(v.id("versions")),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_projectId_and_status", ["projectId", "status"]),
  feedbackEvents: defineTable({
    feedbackId: v.id("feedback"),
    status: feedbackStatus,
    message: v.string(),
    at: v.number(),
  }).index("by_feedbackId", ["feedbackId"]),
  versions: defineTable({
    projectId: v.id("projects"),
    number: v.number(),
    feedbackId: v.optional(v.id("feedback")),
    summary: v.string(),
    url: v.string(),
    commitSha: v.optional(v.string()),
    afterImageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_projectId_and_number", ["projectId", "number"]),
  designs: defineTable({
    ownerHash: v.string(),
    kind: v.string(),
    templateId: v.string(),
    name: v.string(),
    emoji: v.string(),
    doc: v.any(),
    position: v.number(),
    versionCount: v.number(),
    updatedAt: v.number(),
  }).index("by_ownerHash_and_updatedAt", ["ownerHash", "updatedAt"]),
  designVersions: defineTable({
    designId: v.id("designs"),
    number: v.number(),
    doc: v.any(),
    summary: v.string(),
    operations: v.any(),
    changedIds: v.array(v.string()),
    scope: designScope,
    instruction: v.optional(v.string()),
    parent: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_designId_and_number", ["designId", "number"]),
  apiKeys: defineTable({
    ownerHash: v.string(),
    provider,
    label: v.string(),
    last4: v.string(),
    model: v.string(),
    ciphertext: v.string(),
    iv: v.string(),
    createdAt: v.number(),
  }).index("by_ownerHash", ["ownerHash"]),
  workspaces: defineTable({
    ownerHash: v.string(),
    name: v.string(),
    emoji: v.string(),
    keyId: v.optional(v.id("apiKeys")),
    suggestedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_ownerHash_and_updatedAt", ["ownerHash", "updatedAt"]),
  components: defineTable({
    workspaceId: v.id("workspaces"),
    role: componentRole,
    name: v.string(),
    usage: v.string(),
    designId: v.optional(v.id("designs")),
    projectId: v.optional(v.id("projects")),
    order: v.number(),
  })
    .index("by_workspaceId_and_order", ["workspaceId", "order"])
    .index("by_designId", ["designId"])
    .index("by_projectId", ["projectId"]),
  agentRuns: defineTable({
    componentId: v.id("components"),
    workspaceId: v.id("workspaces"),
    note: v.string(),
    marks: v.array(v.object({ tag: v.string(), text: v.optional(v.string()), ids: v.array(v.string()) })),
    imageId: v.optional(v.id("_storage")),
    baseNumber: v.number(),
    status: runStatus,
    message: v.string(),
    summary: v.optional(v.string()),
    versionNumber: v.optional(v.number()),
    model: v.optional(v.string()),
    suggestionId: v.optional(v.id("suggestions")),
    updatedAt: v.number(),
  })
    .index("by_componentId", ["componentId"])
    .index("by_workspaceId", ["workspaceId"]),
  suggestions: defineTable({
    workspaceId: v.id("workspaces"),
    componentId: v.id("components"),
    title: v.string(),
    reason: v.string(),
    instruction: v.string(),
    status: v.union(v.literal("pending"), v.literal("applied"), v.literal("declined"), v.literal("stale")),
    runId: v.optional(v.id("agentRuns")),
    createdAt: v.number(),
  })
    .index("by_componentId_and_status", ["componentId", "status"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"]),
  styleMemory: defineTable({
    ownerHash: v.string(),
    tallies: v.record(v.string(), v.array(v.union(v.number(), v.string()))),
    overrides: v.record(v.string(), v.union(v.number(), v.string())),
    updatedAt: v.number(),
  }).index("by_ownerHash", ["ownerHash"]),
});
