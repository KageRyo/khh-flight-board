import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeFlights, validSnapshot } from '../public/model.mjs';
import { BOARDS, sourceUrl } from '../public/config.mjs';

export const SOURCES = Object.freeze(Object.fromEntries(Object.keys(BOARDS).map(key => [key,sourceUrl(key)])));

export function createFeed({ source, intervalMs = 60000, timeoutMs = 12000, cacheFile, fetcher = fetch, now = Date.now }) {
  if (!SOURCES[source]) throw new Error('未知資料來源');
  let snapshot = { source, flights: [], lastSuccess: null };
  let error = null, storageWarning = null, lastAttempt = null, pending = null;
  const loaded = (async () => {
    if (!cacheFile) return;
    try {
      const stored = JSON.parse(await readFile(cacheFile, 'utf8'));
      if (validSnapshot(stored, source, now())) snapshot = stored;
    } catch { /* 首次執行或損壞的快取均不視為即時資料。 */ }
  })();
  const result = () => ({ ...snapshot, stale: Boolean(error) || !snapshot.lastSuccess || now() - Date.parse(snapshot.lastSuccess) > intervalMs * 2,
    error, storageWarning, lastAttempt: lastAttempt === null ? null : new Date(lastAttempt).toISOString(),
    pollSeconds: intervalMs / 1000, sourceUrl: SOURCES[source] });
  async function refresh() {
    lastAttempt = now();
    try {
      const response = await fetcher(SOURCES[source], { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`官方服務回應 HTTP ${response.status}`);
      const raw = await response.text();
      if (raw.length > 5_000_000) throw new Error('官方回應超過預期大小');
      const flights = normalizeFlights(JSON.parse(raw.replace(/^\uFEFF/, '')), source);
      snapshot = { source, flights, lastSuccess: new Date(now()).toISOString() };
      error = null;
      if (cacheFile) {
        try {
          await mkdir(dirname(cacheFile), { recursive: true });
          await writeFile(`${cacheFile}.tmp`, JSON.stringify(snapshot), 'utf8');
          await rename(`${cacheFile}.tmp`, cacheFile);
          storageWarning = null;
        } catch { storageWarning = '無法寫入磁碟快取，重新啟動後可能無法復原'; }
      }
    } catch (err) {
      error = err.name === 'TimeoutError' ? '官方資料連線逾時' : err instanceof SyntaxError ? '官方回應不是有效 JSON' : '無法更新官方資料：' + err.message;
    }
    return result();
  }
  return {
    async get() {
      await loaded;
      if (pending) return pending;
      if (lastAttempt !== null && now() - lastAttempt < intervalMs) return result();
      pending = refresh().finally(() => { pending = null; });
      return pending;
    }
  };
}
