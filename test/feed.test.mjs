import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const lib = await import('../lib/feed.mjs').catch(() => ({}));
const rows = [{ expectTime: '23:50', realTime: '', airLineNum: 'ZZ123', goalAirportName: '測試目的地', airLineName: '測試航空', airFlyStatus: '登機中' }];

test('失敗保留最後成功時間和航班，恢復後接受空清單', async () => {
  assert.equal(typeof lib.createFeed, 'function');
  let now = Date.parse('2026-10-18T12:00:00Z');
  let mode = 'ok';
  const feed = lib.createFeed({ source: 'int', intervalMs: 30000, now: () => now, fetcher: async () => {
    if (mode === 'fail') throw new Error('offline');
    return new Response(JSON.stringify(mode === 'empty' ? [] : rows));
  }});
  const first = await feed.get();
  assert.equal(first.stale, false);
  mode = 'fail'; now += 30001;
  const stale = await feed.get();
  assert.equal(stale.stale, true);
  assert.equal(stale.lastSuccess, first.lastSuccess);
  assert.equal(stale.flights[0].number, 'ZZ123');
  mode = 'empty'; now += 30001;
  const recovered = await feed.get();
  assert.equal(recovered.stale, false);
  assert.deepEqual(recovered.flights, []);
  assert.notEqual(recovered.lastSuccess, first.lastSuccess);
});
test('同時請求合併，上游失敗期間也遵守輪詢間隔', async () => {
  let calls = 0;
  const feed = lib.createFeed({ source: 'int', intervalMs: 30000, fetcher: async () => { calls++; throw new Error('down'); } });
  const results = await Promise.all([feed.get(), feed.get(), feed.get()]);
  assert.equal(calls, 1);
  assert.equal(results[0].lastSuccess, null);
  assert.equal(results[0].stale, true);
  await feed.get();
  assert.equal(calls, 1);
});
test('上游格式錯誤與 HTTP 錯誤不覆蓋快取', async () => {
  let mode = 'ok', now = Date.now();
  const feed = lib.createFeed({ source: 'dom', intervalMs: 30000, now: () => now, fetcher: async () =>
    new Response(JSON.stringify(mode === 'ok' ? rows : { message: 'unavailable' }), { status: mode === 'http' ? 503 : 200 }) });
  const first = await feed.get();
  for (mode of ['bad', 'http']) {
    now += 30001;
    const result = await feed.get();
    assert.equal(result.stale, true);
    assert.equal(result.lastSuccess, first.lastSuccess);
  }
});
test('磁碟快取可在重新啟動且斷線時復原', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'khh-test-'));
  try {
    const file = join(dir, 'int.json');
    const feed = lib.createFeed({ source: 'int', cacheFile: file, fetcher: async () => new Response(JSON.stringify(rows)) });
    const first = await feed.get();
    const restarted = lib.createFeed({ source: 'int', cacheFile: file, fetcher: async () => { throw new Error('down'); } });
    const result = await restarted.get();
    assert.equal(result.stale, true);
    assert.equal(result.lastSuccess, first.lastSuccess);
    assert.equal(result.flights[0].number, 'ZZ123');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
