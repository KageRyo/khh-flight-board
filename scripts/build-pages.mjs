import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { BOARDS, sourceUrl } from '../public/config.mjs';
import { normalizeFlights, validSnapshot } from '../public/model.mjs';

const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
export async function buildPages({outDir,previousBase,fetcher=fetch,now=Date.now}){
  // Fetch all feeds before touching output. Failed builds cannot deploy a partial board.
  const snapshots=await Promise.all(Object.keys(BOARDS).map(async source=>{
    try{
      const response=await fetcher(sourceUrl(source),{signal:AbortSignal.timeout(20000),cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const flights=normalizeFlights(JSON.parse((await response.text()).replace(/^\uFEFF/,'')),source);
      return {source,flights,lastSuccess:new Date(now()).toISOString(),stale:false,error:null,sourceUrl:sourceUrl(source)};
    }catch(error){
      if(previousBase){
        try{
          const url=new URL(`data/${source}.json`,previousBase.endsWith('/')?previousBase:previousBase+'/');url.searchParams.set('t',String(now()));
          const response=await fetcher(url.href,{signal:AbortSignal.timeout(12000),cache:'no-store'});
          if(!response.ok)throw new Error('previous snapshot unavailable');
          const previous=await response.json();
          if(validSnapshot(previous,source,now()))return {...previous,stale:true,error:'官方資料更新失敗，保留上次成功快照',sourceUrl:sourceUrl(source)};
        }catch{/* 沒有可靠舊快照就中止發布，讓現有網站繼續服務。 */}
      }
      throw new Error(`${source}: 無法取得官方資料且沒有有效舊快照 (${error.message})`);
    }
  }));
  await mkdir(outDir,{recursive:true});await cp(publicDir,outDir,{recursive:true});await mkdir(join(outDir,'data'),{recursive:true});
  const html=await readFile(join(publicDir,'index.html'),'utf8');
  await writeFile(join(outDir,'index.html'),html.replace('<html lang="zh-Hant">','<html lang="zh-Hant" data-mode="static">'));
  await Promise.all(snapshots.map(value=>writeFile(join(outDir,'data',`${value.source}.json`),JSON.stringify(value))));
  await writeFile(join(outDir,'.nojekyll'),'');
  return snapshots.map(({source,flights,lastSuccess,stale})=>({source,count:flights.length,lastSuccess,stale}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{console.log(JSON.stringify(await buildPages({outDir:resolve('dist'),previousBase:process.env.PREVIOUS_SITE_URL}),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
