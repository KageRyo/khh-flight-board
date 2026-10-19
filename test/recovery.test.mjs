import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoverPublishedData } from '../scripts/recover-published-data.mjs';

const now = () => Date.parse('2026-10-19T13:00:00Z');
const options = { repository: 'owner/board', token: 'test-token', now };
function api(runs = [], status = 204) {
  const calls = [];
  return { calls, fetcher: async (url, init) => {
    calls.push({ url, ...init });
    return init.method === 'POST' ? new Response(null, { status }) : Response.json({ workflow_runs: runs });
  } };
}
test('過期資料只觸發 main 的補發工作一次', async () => {
  const server = api();
  const result = await recoverPublishedData({ ...options, ...server });
  assert.equal(result.action, 'dispatched');
  assert.equal(server.calls.length, 2);
  assert.deepEqual(JSON.parse(server.calls[1].body), { ref: 'main', inputs: { recovery: true } });
});
test('發布中或等待中的工作會阻止重複補發', async () => {
  for (const status of ['in_progress', 'queued', 'waiting', 'pending', 'requested']) {
    const server = api([{ status, head_branch: 'main' }]);
    assert.equal((await recoverPublishedData({ ...options, ...server })).action, 'active');
    assert.equal(server.calls.length, 1);
  }
});
test('補發失敗仍受 30 分鐘冷卻限制，期限到後才再補發', async () => {
  for (const minutes of [29, 30]) {
    const server = api([{ status: 'completed', conclusion: 'failure', head_branch: 'main', display_title: 'Recover published flight data', created_at: new Date(now() - minutes * 60000).toISOString() }]);
    assert.equal((await recoverPublishedData({ ...options, ...server })).action, minutes === 29 ? 'cooldown' : 'dispatched');
  }
});
test('其他分支的執行不會阻止 main 補發', async () => {
  const server = api([{ status: 'in_progress', head_branch: 'feature' }]);
  assert.equal((await recoverPublishedData({ ...options, ...server })).action, 'dispatched');
});
test('GitHub 拒絕請求時回報失敗，不假裝已補發也不重送 POST', async () => {
  const server = api([], 403);
  await assert.rejects(recoverPublishedData({ ...options, ...server }), /HTTP 403/);
  assert.equal(server.calls.length, 2);
  await assert.rejects(recoverPublishedData({ ...options, fetcher: async () => new Response(null, { status: 503 }) }), /HTTP 503/);
});
