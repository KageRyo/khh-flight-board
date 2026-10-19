import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const recoveryTitle = 'Recover published flight data';
export async function recoverPublishedData({ repository, token, now = Date.now, fetcher = fetch }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !token) throw new Error('缺少有效的 GitHub repository 或 token');
  const endpoint = `https://api.github.com/repos/${repository}/actions/workflows/pages.yml`;
  async function request(url, method = 'GET', body) {
    const response = await fetcher(url, {
      method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`GitHub ${method}: HTTP ${response.status}`);
    return response;
  }
  // Include failed recoveries in the cooldown: an upstream outage must not create a dispatch loop.
  const response = await request(`${endpoint}/runs?branch=main&per_page=100`);
  const { workflow_runs: runs } = await response.json();
  if (!Array.isArray(runs)) throw new Error('GitHub 回傳無效的工作清單');
  const mainRuns = runs.filter(run => run.head_branch === 'main');
  if (mainRuns.some(run => run.status !== 'completed')) return { action: 'active', message: '已有發布工作等待或執行中，跳過補發' };
  if (mainRuns.some(run => run.display_title === recoveryTitle && now() - Date.parse(run.created_at) < 30 * 60000)) {
    return { action: 'cooldown', message: '30 分鐘內已嘗試補發，等待下次監測' };
  }
  // Do not retry this POST: an ambiguous network failure may already have created a run.
  await request(`${endpoint}/dispatches`, 'POST', { ref: 'main', inputs: { recovery: true } });
  return { action: 'dispatched', message: '已觸發 main 補發；發布完成後會再次檢查資料新鮮度' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await recoverPublishedData({ repository: process.env.GITHUB_REPOSITORY, token: process.env.GITHUB_TOKEN }), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
