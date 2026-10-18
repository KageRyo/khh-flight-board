import { validSnapshot } from './model.mjs';
import { BOARDS, sourceUrl, layout } from './config.mjs';
const $ = id => document.getElementById(id);
const STATIC = document.documentElement.dataset.mode === 'static';
let preferences = {};
try { const saved = JSON.parse(localStorage.getItem('khh-preferences')); if(saved && typeof saved === 'object') preferences = saved; } catch {}
let source = [location.hash.slice(1),preferences.source,'int'].find(value=>typeof value==='string'&&Object.hasOwn(BOARDS,value));
let snapshot = null, problem = null, origin = '', loading = false, cacheWarning = '';
let page = 0, rotating = typeof preferences.rotating==='boolean'?preferences.rotating:true, pollSeconds = 60, timer, request, generation = 0, lastRotation = Date.now(), renderedKey = '';
$('search').value=typeof preferences.query==='string'?preferences.query:'';
$('filter').value=preferences.filter==='active'?'active':'all';
function renderRotation(){ $('rotate').setAttribute('aria-pressed',String(rotating));$('rotate').textContent=rotating?'Ⅱ 暫停輪播':'▶ 開始輪播'; }
function savePreferences(){
  try { localStorage.setItem('khh-preferences',JSON.stringify({source,query:$('search').value,filter:$('filter').value,rotating})); } catch { /* 設定無法儲存時仍可操作看板。 */ }
}
renderRotation();
const dateFormat = new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const clockFormat = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false});
const englishStatus = {'離站':'Departed','起飛':'Departed','抵達':'Arrived','到站':'Arrived','登機中':'Boarding','報到中':'Check In','辦理報到':'Check In','準時':'On Time','延誤':'Delayed','取消':'Cancelled','尚未登機':'Yet to board','登機門關閉':'Gate Closed','最後登機':'Final Call'};
const airlineNames = {CAL:'中華航空',EVA:'長榮航空',UIA:'立榮',MDA:'華信',DAC:'德安',TTW:'tigerair',CPA:'國泰航空',HKE:'香港快運',APJ:'peach',HVN:'越南航空',VJC:'VietJet Air',TWB:'德威航空',AXM:'AirAsia',AIQ:'AirAsia',CEB:'Cebu Pacific'};
function metrics(){
  const available=$('fids').clientHeight-document.querySelector('.board-title').offsetHeight-document.querySelector('.announcement').offsetHeight-$('notice').offsetHeight;
  return layout(innerWidth,innerHeight,BOARDS[source].international,available);
}
function filtered(){
  const query = $('search').value.trim().toLocaleLowerCase();
  return (snapshot?.flights || []).filter(f => ($('filter').value === 'all' || !['departed','arrived'].includes(f.tone)) &&
    (!query || [f.number,f.destination,f.airport,f.airline].some(v => v.toLocaleLowerCase().includes(query))));
}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function compactTime(value){return value === '—' ? '—' : value.replace(':','');}
function airlineBadge(f){
  const style = {TTW:'tiger',APJ:'peach',VJC:'vietjet',AXM:'airasia',AIQ:'airasia'}[f.airlineCode] || '';
  const badge=node('div',`airline-badge ${style}`);badge.title=f.airline;
  if(/^https:\/\/www\.kia\.gov\.tw\/images\//.test(f.logo)){
    const img=node('img');img.src=f.logo;img.alt='';img.loading='lazy';img.addEventListener('error',()=>img.remove(),{once:true});badge.append(img);
  }
  const word=node('span','airline-word');word.append(node('b','',airlineNames[f.airlineCode] || f.airline.replace(/航空公司$|航空$/,'')),node('small','',f.airlineCode));badge.append(word);return badge;
}
function table(flights,index,rowCount){
  const config=BOARDS[source], domestic=!config.international;
  const table=node('table','flight-table');table.setAttribute('aria-label',`${config.label}第 ${index+1} 欄`);
  const headers=[['airline','航空公司','Airlines'],['number','航班班次','Flight No.'],['place',config.airportLabel,config.airportEnglish],['scheduled','表定時間',config.direction==='arr'?'STA':'STD']];
  if(domestic)headers.push(['updated','預計／實際',config.direction==='arr'?'ETA / ATA':'ETD / ATD']);
  headers.push(['gate','登機門','GATE'],['status','航班狀態','Flt Status']);
  const cols=node('colgroup'),thead=node('thead'),head=node('tr');
  for(const [key,zh,en] of headers){const col=node('col',`${key}-col`);cols.append(col);const th=node('th','',zh);th.scope='col';th.append(node('span','',en));head.append(th);}
  thead.append(head);table.append(cols,thead);const body=node('tbody');
  for(let i=0;i<rowCount;i++){
    const f=flights[i],tr=node('tr');
    if(!f){tr.setAttribute('aria-hidden','true');for(let c=0;c<headers.length;c++)tr.append(node('td','','\u00a0'));body.append(tr);continue;}
    tr.title=[f.airline,f.number,f.destination,`表定 ${f.scheduled}`,`${f.timeLabel} ${f.updatedTime}`,`登機門 ${f.gate}`,f.status,f.cause].filter(Boolean).join(' · ');
    const airline=node('td','airline-cell');airline.append(airlineBadge(f));
    const place=node('td','place',f.destination);place.append(node('small','',f.airport));
    tr.append(airline,node('td','flight-number',f.number.replace(/^([A-Z0-9]{2})(\d)/,'$1-$2')),place,node('td','scheduled',compactTime(f.scheduled)));
    if(domestic){const updated=node('td','updated',compactTime(f.updatedTime));updated.title=`${f.timeLabel} ${f.updatedTime}`;tr.append(updated);}
    tr.append(node('td','gate',f.gate));
    const status=node('td',`flight-status status-${f.tone}`),main=node('span','status-main');
    const stamp = f.updatedTime !== '—' && ['departed','arrived'].includes(f.tone) ? compactTime(f.updatedTime)+' ' : '';
    main.append(document.createTextNode(stamp+f.status));if(englishStatus[f.status])main.append(node('span','status-english',englishStatus[f.status]));status.append(main);
    if(!domestic && f.updatedTime!=='—' && !['departed','arrived'].includes(f.tone))status.append(node('span','status-extra',`${f.timeLabel} ${compactTime(f.updatedTime)}`));
    if(f.cause)status.append(node('span','status-extra',f.cause));tr.append(status);body.append(tr);
  }
  table.append(body);return table;
}
function renderStatus(){
  const stamp=snapshot?.lastSuccess?Date.parse(snapshot.lastSuccess):null,age=stamp===null?0:Math.max(0,Math.floor((Date.now()-stamp)/1000));
  const maxAge=STATIC?900:pollSeconds*2;
  const stale=Boolean(problem||snapshot?.stale||(stamp!==null&&age>maxAge));
  $('connection').textContent=loading?'查詢中':!snapshot?'等待資料':stale?'快取資料':STATIC?'官方資料快照':'已取得官方資料';
  $('live-dot').classList.toggle('warning',stale||!snapshot);
  $('last-success').textContent=stamp===null?'尚未成功':dateFormat.format(new Date(stamp));if(stamp!==null)$('last-success').dateTime=snapshot.lastSuccess;
  $('age').textContent=stamp===null?'':`（${age<60?`${age} 秒`:age<3600?`${Math.floor(age/60)} 分鐘`:`${Math.floor(age/3600)} 小時`}前）`;
  const notices=[];if(problem)notices.push(problem);if(stale&&snapshot)notices.push(`顯示${origin||'保留'}快取，航班可能已異動。`);
  if(snapshot?.storageWarning)notices.push(snapshot.storageWarning);if(cacheWarning)notices.push(cacheWarning);
  const changed=$('notice').hidden!==!notices.length;
  $('notice').hidden=!notices.length;$('notice').textContent=notices.join(' ');$('refresh').disabled=loading;
  if(changed)requestAnimationFrame(render);
  $('poll-label').textContent=STATIC?'Pages：每 60 秒檢查快照 / GitHub 約每 5 分鐘取得官方資料（排程可能延遲）':`本機每 ${pollSeconds} 秒查詢官方資料 · 非內部 FIDS 同步`;
}
function render(){
  renderStatus();
  const config=BOARDS[source],m=metrics(),flights=filtered(),total=Math.max(1,Math.ceil(flights.length/m.capacity));page=Math.min(Math.max(page,0),total-1);
  const visible=flights.slice(page*m.capacity,(page+1)*m.capacity),key=`${source}|${page}|${m.capacity}|${JSON.stringify(visible)}`;
  if(key!==renderedKey){$('board').replaceChildren(...Array.from({length:m.panels},(_,i)=>table(visible.slice(i*m.rowCount,(i+1)*m.rowCount),i,m.rowCount)));renderedKey=key;}
  $('board').classList.toggle('single',!config.international);$('board').hidden=!flights.length;$('empty').hidden=Boolean(flights.length);$('board').setAttribute('aria-busy',String(loading));
  $('fids').classList.toggle('arrival',config.direction==='arr');$('title-zh').textContent=config.title;$('title-en').textContent=config.english;
  $('summary').textContent=`${config.label} · ${flights.length} 班`;$('page').textContent=`${String(page+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;
  $('previous').disabled=total<=1;$('next').disabled=total<=1;
  document.querySelectorAll('[data-source]').forEach(button=>{const selected=button.dataset.source===source;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
  $('source-link').href=sourceUrl(source);
  if(!flights.length){$('empty-title').textContent=!snapshot?loading?'正在取得航班':'暫時無法取得資料':snapshot.flights.length?'沒有符合條件的航班':'官方目前未提供航班';$('empty-copy').textContent=!snapshot?'將持續自動重試；目前沒有成功快取。':snapshot.flights.length?'請調整搜尋或切換為全部航班。':'此為官方空清單，將定期重新查詢。';}
  renderStatus();
}
function restore(){try{const value=JSON.parse(localStorage.getItem(`khh-v2-${source}`));if(validSnapshot(value,source)){snapshot={...value,stale:true};origin='瀏覽器';}}catch{}}
async function refresh(){
  if(loading)return;clearTimeout(timer);loading=true;render();const run=generation,selected=source,controller=new AbortController();request=controller;const timeout=setTimeout(()=>controller.abort(),28000);
  try{
    const url=STATIC?`./data/${selected}.json?t=${Math.floor(Date.now()/60000)}`:`./api/flights?source=${selected}`;
    const response=await fetch(url,{cache:'no-store',signal:controller.signal}),value=await response.json();if(run!==generation)return;
    if(!STATIC&&Number.isInteger(value.pollSeconds)&&value.pollSeconds>=30&&value.pollSeconds<=3600)pollSeconds=value.pollSeconds;
    if(!response.ok||!validSnapshot(value,selected))throw new Error(value.error||'無法取得有效航班資料');
    if(snapshot&&Date.parse(snapshot.lastSuccess)>Date.parse(value.lastSuccess)){problem='網站資料較舊，保留較新的瀏覽器快取';}
    else{snapshot=value;origin=value.stale?'伺服器':'';problem=value.error||null;try{localStorage.setItem(`khh-v2-${source}`,JSON.stringify(value));cacheWarning='';}catch{cacheWarning='瀏覽器無法儲存快取';}}
  }catch(err){if(run!==generation)return;problem=controller.signal.aborted?'資料連線逾時':`更新失敗：${err.message}`;}
  finally{clearTimeout(timeout);if(run===generation){loading=false;render();timer=setTimeout(refresh,pollSeconds*1000);}}
}
function selectSource(value){
  if(value===source||!Object.hasOwn(BOARDS,value))return;generation++;request?.abort();clearTimeout(timer);source=value;snapshot=null;problem=null;origin='';loading=false;page=0;cacheWarning='';lastRotation=Date.now();
  history.replaceState(null,'',`#${source}`);savePreferences();restore();void refresh();
}
function turn(delta){const pages=Math.max(1,Math.ceil(filtered().length/metrics().capacity));page=(page+delta+pages)%pages;lastRotation=Date.now();render();}
document.querySelectorAll('[data-source]').forEach(button=>button.addEventListener('click',()=>selectSource(button.dataset.source)));
window.addEventListener('hashchange',()=>selectSource(location.hash.slice(1)));
$('refresh').addEventListener('click',refresh);for(const id of ['search','filter'])$(id).addEventListener('input',()=>{page=0;lastRotation=Date.now();savePreferences();render();});
$('previous').addEventListener('click',()=>turn(-1));$('next').addEventListener('click',()=>turn(1));
$('rotate').addEventListener('click',()=>{rotating=!rotating;lastRotation=Date.now();renderRotation();savePreferences();render();});
let shareTimer;
$('share').addEventListener('click',async()=>{
  const url=new URL(location.href);url.hash=source;
  try{await navigator.clipboard.writeText(url.href);clearTimeout(shareTimer);$('share').textContent='已複製';shareTimer=setTimeout(()=>$('share').textContent='連結',2000);}
  catch{window.prompt('複製看板連結',url.href);}
});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{cacheWarning='全螢幕無法啟動，可使用 F11';renderStatus();}});
document.addEventListener('fullscreenchange',render);window.addEventListener('resize',render);window.addEventListener('online',refresh);window.addEventListener('offline',()=>{problem='瀏覽器已離線';renderStatus();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastRotation=Date.now();refresh();}});
function tick(){const now=new Date();$('clock').textContent=clockFormat.format(now);$('date').textContent=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit'}).format(now)+' UTC+8';renderStatus();if(rotating&&!document.hidden&&!['INPUT','SELECT'].includes(document.activeElement.tagName)&&Date.now()-lastRotation>=18000)turn(1);}
savePreferences();restore();void refresh();tick();setInterval(tick,1000);
