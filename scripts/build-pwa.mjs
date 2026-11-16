import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

async function filesIn(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? filesIn(`${path}/${entry.name}`) : `${path}/${entry.name}`))).flat();
}
const files = (await filesIn("dist")).filter((file) => !file.endsWith(".map") && !file.endsWith("sw.js"));
const version = createHash("sha256");
for (const file of files) version.update(await readFile(file));
const precache = files.map((file) => `/${file.slice(5)}`);
await writeFile("dist/sw.js", `
const CACHE = 'clay-${version.digest("hex").slice(0, 12)}';
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('clay-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache Convex data, uploads, model requests, or external previews.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
`);
console.log(`PWA shell generated (${precache.length} files). Workspace editing and AI require an internet connection.`);
