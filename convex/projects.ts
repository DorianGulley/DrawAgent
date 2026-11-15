import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { cleanText, cleanUrl, sha256 } from "./lib";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").withIndex("by_updatedAt").order("desc").take(50);
    return await Promise.all(
      projects.map(async ({ keyHash: _keyHash, ...project }) => {
        const open = await ctx.db
          .query("feedback")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .order("desc")
          .take(20);
        const latest = project.latestVersionId ? await ctx.db.get("versions", project.latestVersionId) : null;
        return {
          ...project,
          openCount: open.filter((item) => item.status !== "published" && item.status !== "failed").length,
          latestSummary: latest?.summary ?? null,
        };
      }),
    );
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get("projects", projectId);
    if (!project) return null;
    const { keyHash: _keyHash, ...rest } = project;
    const latest = project.latestVersionId ? await ctx.db.get("versions", project.latestVersionId) : null;
    return { ...rest, latest };
  },
});

export const create = mutation({
  args: { name: v.string(), url: v.string(), emoji: v.optional(v.string()), agent: v.string() },
  handler: async (ctx, args) => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const key = "dk_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const url = cleanUrl(args.url);
    const projectId = await ctx.db.insert("projects", {
      name: cleanText(args.name, 40) || "Untitled",
      url,
      emoji: cleanText(args.emoji ?? "✨", 8) || "✨",
      agent: cleanText(args.agent, 20),
      keyHash: await sha256(key),
      versionCount: 1,
      updatedAt: Date.now(),
    });
    const versionId = await ctx.db.insert("versions", {
      projectId,
      number: 1,
      summary: "Connected to Direct",
      url,
      createdAt: Date.now(),
    });
    await ctx.db.patch("projects", projectId, { latestVersionId: versionId });
    return { projectId, key };
  },
});
