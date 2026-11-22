// Serves the real production build with the repo-city mockup script injected into index.html.
// Usage: bun server.js <path to frontend/build> <port>
const path = require('path');
const BUILD = path.resolve(process.argv[2]);
const PORT = Number(process.argv[3] || 49200);
const HERE = __dirname;

const page = async () => {
  const html = await Bun.file(path.join(BUILD, 'index.html')).text();
  return new Response(html.replace('</body>', '<script src="/__city/city-inject.js"></script></body>'), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
};

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url);
    const p = decodeURIComponent(url.pathname);
    if (p.startsWith('/__city/')) {
      const name = path.basename(p);
      const f = Bun.file(path.join(HERE, name));
      return (await f.exists()) ? new Response(f, { headers: { 'cache-control': 'no-store' } }) : new Response('not found', { status: 404 });
    }
    if (p.startsWith('/api/')) return Response.json({ error: 'mockup server: no API' }, { status: 503 });
    const file = path.join(BUILD, p);
    if (!file.startsWith(BUILD)) return new Response('forbidden', { status: 403 });
    if (p !== '/' && path.extname(p)) {
      const f = Bun.file(file);
      return (await f.exists()) ? new Response(f) : new Response('not found', { status: 404 });
    }
    return page();
  },
});
console.log('repo-city mockup on http://127.0.0.1:' + PORT);
