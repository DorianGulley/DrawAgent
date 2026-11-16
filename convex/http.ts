import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { kindOf } from "../shared/kinds";
import { buildPreviewHtml } from "../shared/preview";

const http = httpRouter();

http.route({
  pathPrefix: "/s/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).pathname.slice(3).replace(/[^a-z0-9]/g, "");
    const share = slug ? await ctx.runQuery(internal.shares.load, { slug }) : null;
    if (!share) return new Response("This Clay link doesn't exist anymore.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    const kind = kindOf(share.kind);
    const title = share.name.replace(/[&<>"']/g, "");
    const html = buildPreviewHtml(share.doc, { insetTop: 12, insetBottom: 12, canvas: kind.canvas, assets: share.assets }).replace(
      "<head>",
      `<head><title>${title} · made with Clay</title><meta property="og:title" content="${title}"><meta property="og:description" content="Made with Clay">`,
    );
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
        "Cache-Control": "no-store",
      },
    });
  }),
});

export default http;
