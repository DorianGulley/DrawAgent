import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";
import { withImages } from "./feedback";
import { cleanText, cleanUrl, projectForKey } from "./lib";

async function ownedFeedback(ctx: MutationCtx, key: string, feedbackId: Id<"feedback">) {
  const project = await projectForKey(ctx, key);
  const item = await ctx.db.get("feedback", feedbackId);
  if (!item || item.projectId !== project._id) throw new Error("Feedback not found for this project");
  return { project, item };
}

async function setStatus(
  ctx: MutationCtx,
  feedbackId: Id<"feedback">,
  status: "claimed" | "working" | "failed" | "published",
  message: string,
  extra: { versionId?: Id<"versions"> } = {},
) {
  const now = Date.now();
  await ctx.db.patch("feedback", feedbackId, { status, statusMessage: message, updatedAt: now, ...extra });
  await ctx.db.insert("feedbackEvents", { feedbackId, status, message, at: now });
}

export const project = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const { keyHash: _keyHash, ...project } = await projectForKey(ctx, key);
    return project;
  },
});

export const updateProject = mutation({
  args: { key: v.string(), url: v.optional(v.string()), agent: v.optional(v.string()) },
  handler: async (ctx, { key, url, agent }) => {
    const project = await projectForKey(ctx, key);
    await ctx.db.patch("projects", project._id, {
      ...(url ? { url: cleanUrl(url) } : {}),
      ...(agent ? { agent: cleanText(agent, 20) } : {}),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const pending = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const project = await projectForKey(ctx, key);
    const items = await ctx.db
      .query("feedback")
      .withIndex("by_projectId_and_status", (q) => q.eq("projectId", project._id).eq("status", "pending"))
      .take(20);
    return items.map((item) => ({ id: item._id, note: item.note, marks: item.marks.length, createdAt: item._creationTime }));
  },
});

export const get = query({
  args: { key: v.string(), feedbackId: v.id("feedback") },
  handler: async (ctx, { key, feedbackId }) => {
    const project = await projectForKey(ctx, key);
    const item = await ctx.db.get("feedback", feedbackId);
    if (!item || item.projectId !== project._id) throw new Error("Feedback not found for this project");
    const base = item.baseVersionId ? await ctx.db.get("versions", item.baseVersionId) : null;
    return { ...(await withImages(ctx, item)), projectUrl: project.url, baseVersion: base ? { number: base.number, commitSha: base.commitSha ?? null } : null };
  },
});

export const claim = mutation({
  args: { key: v.string(), feedbackId: v.id("feedback") },
  handler: async (ctx, { key, feedbackId }) => {
    const { item } = await ownedFeedback(ctx, key, feedbackId);
    if (item.status !== "pending") throw new Error(`Feedback is already ${item.status}`);
    await setStatus(ctx, feedbackId, "claimed", "Your agent picked this up");
    return null;
  },
});

export const report = mutation({
  args: { key: v.string(), feedbackId: v.id("feedback"), status: v.union(v.literal("working"), v.literal("failed")), message: v.string() },
  handler: async (ctx, { key, feedbackId, status, message }) => {
    const { item } = await ownedFeedback(ctx, key, feedbackId);
    if (item.status === "published" || item.status === "failed") throw new Error(`Feedback is already ${item.status}`);
    if (status === "working" && item.status === "pending") throw new Error("Claim the feedback first");
    await setStatus(ctx, feedbackId, status, cleanText(message, 280) || (status === "failed" ? "The agent stopped" : "Working"));
    return null;
  },
});

export const generateUploadUrl = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await projectForKey(ctx, key);
    return await ctx.storage.generateUploadUrl();
  },
});

export const publish = mutation({
  args: {
    key: v.string(),
    feedbackId: v.id("feedback"),
    summary: v.string(),
    url: v.optional(v.string()),
    commitSha: v.optional(v.string()),
    afterImageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { project, item } = await ownedFeedback(ctx, args.key, args.feedbackId);
    if (item.status !== "claimed" && item.status !== "working") throw new Error(`Cannot publish feedback that is ${item.status}`);
    const summary = cleanText(args.summary, 500);
    if (!summary) throw new Error("Summary is required");
    const commitSha = args.commitSha?.trim().toLowerCase();
    if (commitSha && !/^[0-9a-f]{7,40}$/.test(commitSha)) throw new Error("commit_sha must be a hex git sha");
    const url = args.url ? cleanUrl(args.url) : project.url;
    const number = project.versionCount + 1;
    const versionId = await ctx.db.insert("versions", {
      projectId: project._id,
      number,
      feedbackId: item._id,
      summary,
      url,
      commitSha,
      afterImageId: args.afterImageId,
      createdAt: Date.now(),
    });
    await ctx.db.patch("projects", project._id, { versionCount: number, latestVersionId: versionId, url, updatedAt: Date.now() });
    await setStatus(ctx, item._id, "published", `Published v${number}`, { versionId });
    return { versionId, number };
  },
});
