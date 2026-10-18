import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFreshness } from '../scripts/check-freshness.mjs';

const now = () => Date.parse('2026-10-19T02:00:00Z');
const base = 'https://example.test/board/';
function fetcher(overrides = {}) {
  return async url => {
    const source = new URL(url).pathname.split('/').at(-1).replace('.json', '');
    return new Response(JSON.stringify({ source, flights: [], lastSuccess: '2026-10-19T01:55:00Z', stale: false, ...overrides[source] }));
  };
}
test('已發布的四組資料都必須有效且在新鮮度期限內', async () => {
  const result = await checkFreshness({ base, now, fetcher: fetcher() });
  assert.equal(result.ok, true);
  assert.deepEqual(result.sources.map(s => s.source), ['int', 'int-arr', 'dom', 'dom-arr']);
  assert.equal(result.sources[0].ageSeconds, 300);
});
test('單一過期、備援或來源混用的快照會使整體健康檢查失敗', async () => {
  for (const bad of [
    { lastSuccess: '2026-10-19T01:30:00Z' },
    { stale: true },
    { source: 'int' },
    { lastSuccess: '2026-10-20T00:00:00Z' },
    { flights: [{}] }
  ]) {
    const result = await checkFreshness({ base, now, fetcher: fetcher({ dom: bad }) });
    assert.equal(result.ok, false);
    assert.equal(result.sources.find(s => s.source === 'dom').ok, false);
    assert.equal(result.sources.find(s => s.source === 'int').ok, true);
  }
});
test('HTTP 錯誤和無效 JSON 仍回報其他來源的檢查結果', async () => {
  for (const response of [() => new Response('down', { status: 503 }), () => new Response('<html>')]) {
    const result = await checkFreshness({ base, now, fetcher: async url => url.includes('/dom.json') ? response() : fetcher()(url) });
    assert.equal(result.ok, false);
    assert.equal(result.sources.length, 4);
    assert.ok(result.sources.find(s => s.source === 'dom').error);
  }
});
