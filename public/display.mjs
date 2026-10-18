import { BOARDS, sourceUrl } from './config.mjs';
import { validSnapshot } from './model.mjs';
import { flightKey, selectDisplay, safeAirlineLogo } from './display-model.mjs';
const $ = id => document.getElementById(id);
const mode = document.documentElement.dataset.display === 'counter' ? 'counter' : 'gate';
const isStatic = document.documentElement.dataset.mode === 'static';
const params = new URLSearchParams(location.search);
let source = ['int','dom'].includes(params.get('source')) ? params.get('source') : 'int';
let requested = {location:params.get(mode) || '',airline:params.get('airline') || '',flight:params.get('flight') || ''};
let snapshot = null, selection, problem = '', loading = false, generation = 0, controller, timer, pollSeconds = 60;
const dateFormat = new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const clockFormat = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false});
$('source').value = source;
$('airline-control').hidden = mode !== 'counter';
$('flight-control').hidden = false;
function node(tag, cls, text) { const el = document.createElement(tag); if(cls)el.className=cls; if(text !== undefined)el.textContent=text; return el; }
function options(id, values, value, label = v => v) {
  const el=$(id); el.replaceChildren(...values.map(v=>{const option=node('option','',label(v));option.value=v;return option;}));
  el.disabled=!values.length; el.value=value;
}
function setUrl() {
  const url = new URL(location.href); url.searchParams.set('source',source);
  for(const key of ['gate','counter','airline','flight'])url.searchParams.delete(key);
  if(selection.location)url.searchParams.set(mode,selection.location);
  if(mode==='counter' && selection.airline)url.searchParams.set('airline',selection.airline);
  if(selection.selected)url.searchParams.set('flight',flightKey(selection.selected));
  history.replaceState(null,'',url);
}
function airlineBanner(flight) {
  const banner=node('div','airline-banner'),logo=safeAirlineLogo(flight.logo);
  if(logo){const img=node('img');img.src=logo;img.alt='';img.addEventListener('error',()=>img.remove(),{once:true});banner.append(img);}
  banner.append(node('strong','',flight.airline));return banner;
}
function detail(label,value,cls='') {const el=node('div','detail');el.append(node('small','',label),node('strong',cls,value));return el;}
function gateContent(flight) {
  const hero=node('div','flight-hero'),place=node('div','hero-destination',flight.destination);place.append(node('small','',flight.airport));
  hero.append(node('div','hero-number',flight.number),place);
  const details=node('div','flight-details');details.append(detail('表定起飛 Scheduled',flight.scheduled),detail(`${flight.timeLabel}起飛 ${flight.timeLabel==='實際'?'Actual':'Estimated'}`,flight.updatedTime),detail('航班狀態 Flight status',flight.status,`status-${flight.tone}`));
  const nodes=[airlineBanner(flight),hero,details];if(flight.cause)nodes.push(node('p','cause',flight.cause));return nodes;
}
function counterContent(flights) {
  const table=node('table','counter-table');table.setAttribute('aria-label','此櫃台航空公司航班');
  const head=node('thead'),row=node('tr');
  for(const [zh,en] of [['航班','Flight'],['目的地','Destination'],['表定／異動','Scheduled / Updated'],['航班狀態','Flight status']]){const th=node('th','',zh);th.scope='col';th.append(node('small','',en));row.append(th);}head.append(row);table.append(head);
  const body=node('tbody');
  for(const f of flights){const tr=node('tr'),place=node('td','destination',f.destination),time=node('td','',f.scheduled),state=node('td',`status-${f.tone}`,f.status);place.append(node('small','',f.airport));if(f.updatedTime!=='—')time.append(node('small','',`${f.timeLabel} ${f.updatedTime}`));if(f.cause)state.append(node('small','',f.cause));tr.append(node('td','',f.number),place,time,state);body.append(tr);}
  table.append(body);return [airlineBanner(flights[0]),table];
}
function health() {
  const stamp=snapshot ? Date.parse(snapshot.lastSuccess) : null;
  const seconds=stamp===null?0:Math.max(0,Math.floor((Date.now()-stamp)/1000));
  const stale=Boolean(snapshot && (snapshot.stale || problem || seconds > (isStatic?900:pollSeconds*2)));
  const age=seconds<60?`${seconds} 秒`:seconds<3600?`${Math.floor(seconds/60)} 分鐘`:`${Math.floor(seconds/3600)} 小時`;
  $('health').textContent=snapshot?`${loading?'更新中 · ':''}${stale?'保留資料':'官方資料'} · 最後成功 ${dateFormat.format(new Date(stamp))}（${age}前）`:(loading?'正在取得官方資料':'尚無成功資料，將自動重試');
  const notices=[problem,stale?`保留 ${age}前資料，航班可能已異動，請以現場公告為準。`:'',snapshot?.storageWarning || ''].filter(Boolean);
  $('screen-footer').hidden=!notices.length;$('notice').hidden=!notices.length;$('notice').textContent=notices.join(' ');$('refresh').disabled=loading;
}
function render() {
  selection=selectDisplay(snapshot?.flights || [],mode,requested);
  options('location',selection.locations,selection.location);
  options('airline',selection.airlines,selection.airline);
  options('flight',selection.flights.map(flightKey),selection.selected?flightKey(selection.selected):'',key=>{const f=selection.flights.find(f=>flightKey(f)===key);return `${f.number} ${f.scheduled} ${f.destination}`;});
  $('location-value').textContent=selection.location || '—';
  const brands={EVA:'eva',UIA:'eva',CAL:'cal',TTW:'tiger',CPA:'cathay',APJ:'peach'};
  $('monitor').dataset.brand=brands[selection.selected?.airlineCode] || 'neutral';
  $('content').replaceChildren(...(selection.selected?(mode==='gate'?gateContent(selection.selected):counterContent([selection.selected])):[]));
  $('content').setAttribute('aria-busy',String(loading));$('empty').hidden=Boolean(selection.selected);
  $('empty').textContent=!snapshot?(loading?'正在取得官方航班資料':'暫時無法取得資料，將自動重試'):!snapshot.flights.length?'官方目前未提供航班':selection.location?`目前沒有${mode==='gate'?'登機門':'報到櫃台'} ${selection.location} 的航班資料`:`官方目前未提供${mode==='gate'?'登機門':'報到櫃台'}資料`;
  $('official').href=sourceUrl(source);$('official').textContent=`資料來源：高雄國際航空站 · ${BOARDS[source].label}`;
  // Do not replace an incoming shared selection before the first successful response.
  if(snapshot){requested={location:selection.location,airline:selection.airline,flight:selection.selected?flightKey(selection.selected):''};setUrl();}
  health();
}
async function refresh() {
  if(loading)return;
  clearTimeout(timer);loading=true;render();const run=generation,selected=source;
  const abort=new AbortController();controller=abort;const timeout=setTimeout(()=>abort.abort(),25000);
  try {
    const response=await fetch(isStatic?`./data/${selected}.json?t=${Math.floor(Date.now()/60000)}`:`./api/flights?source=${selected}`,{cache:'no-store',signal:abort.signal});
    const value=await response.json();if(run!==generation)return;
    if(!response.ok || !validSnapshot(value,selected))throw new Error('無法取得有效航班資料');
    if(!isStatic&&Number.isInteger(value.pollSeconds)&&value.pollSeconds>=30&&value.pollSeconds<=3600)pollSeconds=value.pollSeconds;
    if(snapshot && Date.parse(value.lastSuccess)<Date.parse(snapshot.lastSuccess))problem='收到較舊資料，保留上次成功資料。';
    else {snapshot=value;problem=typeof value.error==='string'?value.error:'';}
  } catch(error) {if(run!==generation)return;problem=abort.signal.aborted?'資料連線逾時。':'更新失敗，將自動重試。';}
  finally {clearTimeout(timeout);if(run===generation){loading=false;render();timer=setTimeout(refresh,pollSeconds*1000);}}
}
$('source').addEventListener('change',()=>{generation++;controller?.abort();clearTimeout(timer);source=$('source').value;snapshot=null;problem='';requested={};loading=false;const url=new URL(location.href);url.search='';url.searchParams.set('source',source);history.replaceState(null,'',url);void refresh();});
$('location').addEventListener('change',()=>{requested={location:$('location').value};render();});
$('airline').addEventListener('change',()=>{requested={location:selection.location,airline:$('airline').value};render();});
$('flight').addEventListener('change',()=>{requested={...requested,flight:$('flight').value};render();});
$('refresh').addEventListener('click',refresh);
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{problem='無法啟動全螢幕，可使用 F11。';health();}});
window.addEventListener('online',refresh);
window.addEventListener('offline',()=>{problem='瀏覽器已離線。';health();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
function tick(){const now=new Date();$('clock').textContent=clockFormat.format(now);$('date').textContent=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit'}).format(now)+' UTC+8';health();}
void refresh();tick();setInterval(tick,1000);
