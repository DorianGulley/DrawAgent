import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { cleanText } from "./lib";
import { mark } from "./schema";

const MAX_MARKS = 40;
const MAX_POINTS = 600;

export async function withImages(ctx: QueryCtx, item: Doc<"feedback">) {
  const events = await ctx.db
    .query("feedbackEvents")
    .withIndex("by_feedbackId", (q) => q.eq("feedbackId", item._id))
    .order("desc")
    .take(12);
  return {
    ...item,
    imageUrl: item.imageId ? await ctx.storage.getUrl(item.imageId) : null,
    events: events.reverse(),
  };
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    note: v.string(),
    marks: v.array(mark),
    imageId: v.id("_storage"),
    viewport: v.object({ width: v.number(), height: v.number(), scrollY: v.number() }),
    pageUrl: v.string(),
    baseVersionId: v.optional(v.id("versions")),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get("projects", args.projectId);
    const base = args.baseVersionId ? await ctx.db.get("versions", args.baseVersionId) : null;
    if (args.baseVersionId && base?.projectId !== args.projectId) throw new Error("Version not found");
    if (!project) throw new Error("Project not found");
    const note = cleanText(args.note, 1000);
    if (args.marks.length > MAX_MARKS) throw new Error("Too many marks");
    const marks = args.marks.map((m) => ({
      ...m,
      points: m.points.slice(0, MAX_POINTS),
      text: m.text === undefined ? undefined : cleanText(m.text, 280),
      elements: m.elements.slice(0, 5).map((el) => ({
        selector: cleanText(el.selector, 300),
        tag: cleanText(el.tag, 30),
        text: cleanText(el.text, 200),
        styles: Object.fromEntries(Object.entries(el.styles).slice(0, 16).map(([k, val]) => [cleanText(k, 40), cleanText(val, 120)])),
      })),
    }));
    if (!note && marks.length === 0) throw new Error("Draw something or add a note");
    const now = Date.now();
    const feedbackId = await ctx.db.insert("feedback", {
      ...args,
      note,
      marks,
      pageUrl: cleanText(args.pageUrl, 500),
      baseVersionId: base?._id ?? project.latestVersionId,
      status: "pending",
      updatedAt: now,
    });
    await ctx.db.insert("feedbackEvents", { feedbackId, status: "pending", message: base && base._id !== project.latestVersionId ? `Sent to your agent (marked on v${base.number})` : "Sent to your agent", at: now });
    await ctx.db.patch("projects", project._id, { updatedAt: now });
    return feedbackId;
  },
});

export const requestRevert = mutation({
  args: { versionId: v.id("versions") },
  handler: async (ctx, { versionId }) => {
    const version = await ctx.db.get("versions", versionId);
    if (!version) throw new Error("Version not found");
    const project = (await ctx.db.get("projects", version.projectId))!;
    const now = Date.now();
    const target = version.commitSha ? `commit ${version.commitSha}` : `version ${version.number}`;
    const feedbackId = await ctx.db.insert("feedback", {
      projectId: project._id,
      note: `Roll back to v${version.number} (${target}): restore the app to exactly how it was at that point. Use git (for example git revert of the later commits) rather than rewriting history.`,
      marks: [],
      viewport: { width: 0, height: 0, scrollY: 0 },
      pageUrl: project.url,
      baseVersionId: project.latestVersionId,
      status: "pending",
      updatedAt: now,
    });
    await ctx.db.insert("feedbackEvents", { feedbackId, status: "pending", message: `Asked your agent to roll back to v${version.number}`, at: now });
    return feedbackId;
  },
});

export const listForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const items = await ctx.db
      .query("feedback")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(30);
    return await Promise.all(items.map((item) => withImages(ctx, item)));
  },
});

export const timeline = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const versions = await ctx.db
      .query("versions")
      .withIndex("by_projectId_and_number", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(50);
    return await Promise.all(
      versions.map(async (version) => {
        const item = version.feedbackId ? await ctx.db.get("feedback", version.feedbackId) : null;
        return {
          ...version,
          note: item?.note ?? null,
          beforeUrl: item?.imageId ? await ctx.storage.getUrl(item.imageId) : null,
          afterUrl: version.afterImageId ? await ctx.storage.getUrl(version.afterImageId) : null,
        };
      }),
    );
  },
});
