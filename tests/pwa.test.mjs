import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
function worker() {
  const handlers = new Map();
  const shell = new Response('<html>Clay offline shell</html>');
  const cachedAsset = new Response('cached app bundle');
  const cached = new Map([['/index.html', shell]]);
  const deleted = [];
  let precached = [];
  runInNewContext(source, {
    URL,
    self: { location: { origin: 'https://clay.example' }, clients: { claim: async () => {} }, addEventListener: (name, callback) => handlers.set(name, callback) },
    fetch: async () => { throw new Error('offline'); },
    caches: {
      open: async () => ({ addAll: async (urls) => { precached = Array.from(urls); } }),
      keys: async () => ['clay-old', 'another-app-cache'],
      delete: async (key) => { deleted.push(key); return true; },
      match: async (request) => typeof request === 'string' ? cached.get(request) : cachedAsset,
    },
  });
  return { handlers, shell, cachedAsset, deleted, precache: () => precached };
}
test('installation precaches the exported shell and all route chunks', async () => {
  const w = worker(); let done;
  w.handlers.get('install')({ waitUntil: (promise) => { done = promise; } }); await done;
  const files = w.precache();
  assert.ok(files.includes('/index.html')); assert.ok(files.includes('/manifest.json'));
  assert.ok(files.some((path) => path.includes('/js/web/entry-')));
  for (const path of files) await readFile(new URL(`../dist${path}`, import.meta.url));
});
test('offline deep links return the app shell', async () => {
  const w = worker(); let response;
  w.handlers.get('fetch')({ request: { url: 'https://clay.example/workspace/example', method: 'GET', mode: 'navigate' }, respondWith: (promise) => { response = promise; } });
  assert.equal(await response, w.shell);
});
test('Convex, image uploads, and external requests never enter the PWA cache', () => {
  const w = worker(); let intercepted = false;
  for (const request of [
    { url: 'https://deployment.convex.cloud/api/query', method: 'GET' },
    { url: 'https://deployment.convex.cloud/api/storage', method: 'POST' },
    { url: 'https://clay.example/upload', method: 'POST' },
  ]) w.handlers.get('fetch')({ request, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
});
test('activation removes old Clay caches while preserving unrelated caches', async () => {
  const w = worker(); let done;
  w.handlers.get('activate')({ waitUntil: (promise) => { done = promise; } }); await done;
  assert.deepEqual(w.deleted, ['clay-old']);
});
