import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const pages=await import('../scripts/build-pages.mjs').catch(()=>({}));
const departure={expectTime:'08:00',realTime:'',airLineNum:'ZZ123',goalAirportName:'測試',airFlyStatus:'尚未登機'};
test('Pages 建置產生四種獨立快照、原始取得時間與子路徑資產',async()=>{
  assert.equal(typeof pages.buildPages,'function');
  const outDir=await mkdtemp(join(tmpdir(),'khh-pages-'));
  try{
    await pages.buildPages({outDir,now:()=>Date.parse('2026-10-18T14:00Z'),fetcher:async url=>new Response(JSON.stringify([url.includes('ARR.json')?{...departure,goalAirportName:undefined,upAirportName:'來源城市',airFlyStatus:'抵達'}:departure]))});
    const data=JSON.parse(await readFile(join(outDir,'data/int-arr.json'),'utf8'));
    assert.equal(data.source,'int-arr');assert.equal(data.flights[0].destination,'來源城市');assert.equal(data.lastSuccess,'2026-10-18T14:00:00.000Z');
    const html=await readFile(join(outDir,'index.html'),'utf8');assert.match(html,/data-mode="static"/);assert.match(html,/src="\.\/app.mjs"/);
  }finally{await rm(outDir,{recursive:true,force:true});}
});
test('官方故障時 Pages 保留上次成功時間並標示快取；沒有可用舊快照則拒絕發布',async()=>{
  const outDir=await mkdtemp(join(tmpdir(),'khh-pages-'));
  const previous={source:'int',lastSuccess:'2026-10-18T13:00:00Z',flights:[],stale:false};
  try{
    const fetcher=async url=>{
      if(url.startsWith('https://www.kia.gov.tw'))throw new Error('down');
      const source=url.match(/\/([^/]+)\.json/)[1];return new Response(JSON.stringify({...previous,source}));
    };
    await pages.buildPages({outDir,previousBase:'https://example.test/board/',fetcher});
    const data=JSON.parse(await readFile(join(outDir,'data/int.json'),'utf8'));
    assert.equal(data.stale,true);assert.equal(data.lastSuccess,'2026-10-18T13:00:00Z');assert.match(data.error,/官方/);
    await assert.rejects(pages.buildPages({outDir,fetcher:async()=>{throw new Error('down');}}));
  }finally{await rm(outDir,{recursive:true,force:true});}
});
