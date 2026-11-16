import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve("dist");
const mime = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf", ".svg": "image/svg+xml" };
const port = Number(process.env.PORT || 8090);
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let file = resolve(root, `.${path}`);
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    try { if (!(await stat(file)).isFile()) file = resolve(root, "index.html"); }
    catch { if (extname(file)) { res.writeHead(404); res.end(); return; } file = resolve(root, "index.html"); }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch { res.writeHead(500); res.end("Unable to serve Clay"); }
}).listen(port, () => console.log(`Clay PWA: http://localhost:${port}`));
