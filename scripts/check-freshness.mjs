import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BOARDS } from '../public/config.mjs';
import { validSnapshot } from '../public/model.mjs';

export async function checkFreshness({ base, now = Date.now, fetcher = fetch, maxAgeSeconds = 900 }) {
  const checkedAt = now();
  const sources = await Promise.all(Object.keys(BOARDS).map(async source => {
    try {
      const url = new URL(`data/${source}.json`, base.endsWith('/') ? base : base + '/');
      url.searchParams.set('t', String(checkedAt));
      const response = await fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const snapshot = await response.json();
      if (!validSnapshot(snapshot, source, checkedAt)) throw new Error('無效快照');
      const ageSeconds = Math.max(0, Math.floor((checkedAt - Date.parse(snapshot.lastSuccess)) / 1000));
      const ok = ageSeconds <= maxAgeSeconds && !snapshot.stale && !snapshot.error;
      return { source, ok, lastSuccess: snapshot.lastSuccess, ageSeconds, error: ok ? null : snapshot.error || (snapshot.stale ? '仍在使用備援快照' : '資料已超過更新期限') };
    } catch (error) {
      return { source, ok: false, error: error.message };
    }
  }));
  return { ok: sources.every(source => source.ok), checkedAt: new Date(checkedAt).toISOString(), sources };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await checkFreshness({ base: process.env.SITE_URL || 'https://kageryo.github.io/khh-flight-board/' });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
