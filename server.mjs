import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createFeed } from './lib/feed.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
function numeric(name, fallback, min, max) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} 必須為 ${min}–${max} 整數`);
  return value;
}
const port = numeric('PORT', 3000, 1, 65535);
const pollSeconds = numeric('POLL_SECONDS', 60, 30, 3600);
const timeoutMs = numeric('UPSTREAM_TIMEOUT_SECONDS', 12, 2, 25) * 1000;
const feeds = Object.fromEntries(['int', 'dom'].map(source => [source, createFeed({
  source, intervalMs: pollSeconds * 1000, timeoutMs, cacheFile: join(root, '.cache', `${source}.json`)
})]));
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.mjs': ['app.mjs', 'text/javascript; charset=utf-8'],
  '/model.mjs': ['model.mjs', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml']
};
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https://www.kia.gov.tw; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/flights') {
      const source = url.searchParams.get('source') || 'int';
      if (!Object.hasOwn(feeds, source)) { res.writeHead(400); return res.end('Unknown source'); }
      const data = await feeds[source].get();
      res.writeHead(data.lastSuccess ? 200 : 503, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data));
    }
    const file = files[url.pathname];
    if (!file) { res.writeHead(404); return res.end('Not found'); }
    const content = await readFile(join(root, 'public', file[0]));
    res.writeHead(200, { 'Content-Type': file[1] });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (err) {
    console.error(err.message);
    if (!res.headersSent) res.writeHead(500);
    res.end('Local server error');
  }
});
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`KHH Flight Board → http://${process.env.HOST || '127.0.0.1'}:${port}（每 ${pollSeconds} 秒查詢）`));
server.on('error', err => { console.error('啟動失敗：', err.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
