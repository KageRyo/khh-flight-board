import { validSnapshot } from './model.mjs';
const $ = id => document.getElementById(id);
const palette = { TTW:'#a3670b', EVA:'#176d5b', CAL:'#38579b', CPA:'#16606b', HKE:'#744797', HVN:'#176e89', VJC:'#ab343f', CEB:'#637b18', AAR:'#894264', ABL:'#28578c', TWB:'#a43a51', THA:'#75468b', APJ:'#9b4386', UIA:'#277660', MDA:'#386792', AMU:'#397394', CXA:'#286da0', AXM:'#a93543', AIQ:'#a93543', JAL:'#aa3446', ANA:'#2c56a4', SJX:'#806348' };
let source = 'int', snapshot = null, problem = null, origin = '', loading = false;
let page = 0, rotating = true, pollSeconds = 60, timer, request, generation = 0;
let cacheWarning = '', renderedKey = '', lastRotation = Date.now();
const dateFormat = new Intl.DateTimeFormat('zh-TW', { timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Taipei', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
function capacity() { return (innerWidth >= 1280 ? 4 : innerWidth > 900 ? 3 : innerWidth > 520 ? 2 : 1) * (innerWidth <= 520 ? 4 : 3); }
function filtered() {
  const query = $('search').value.trim().toLocaleLowerCase();
  return (snapshot?.flights || []).filter(f => ($('filter').value === 'all' || f.tone !== 'departed') &&
    (!query || [f.number,f.destination,f.airport,f.airline].some(value => value.toLocaleLowerCase().includes(query))));
}
function element(tag, className, text) {
  const node = document.createElement(tag); if (className) node.className = className;
  if (text !== undefined) node.textContent = text; return node;
}
function card(flight) {
  const card = element('article', `card ${flight.tone}`);
  card.style.setProperty('--airline', palette[flight.airlineCode] || '#615181');
  const airline = element('div', 'airline');
  const identity = element('div', 'airline-identity');
  // 只允許官方圖片路徑；圖片斷線仍保留文字識別。
  if (/^https:\/\/www\.kia\.gov\.tw\/images\//.test(flight.logo)) {
    const logo = element('img', 'logo'); logo.src = flight.logo; logo.alt = ''; logo.loading = 'lazy';
    logo.addEventListener('error', () => logo.remove(), { once:true }); identity.append(logo);
  }
  identity.append(element('span', 'airline-name', flight.airline));
  airline.append(identity, element('span','airline-code',flight.airlineCode));
  const body = element('div','flight-body');
  const top = element('div','flight-top'); top.append(element('p','flight-number',flight.number),element('span','airport-code',flight.airport || 'KHH →'));
  const bottom = element('div','flight-bottom'), times = element('div','times');
  for (const [label,value,cls] of [['表定',flight.scheduled,''],[flight.timeLabel,flight.updatedTime,'updated']]) {
    const block = element('div',`time-item ${cls}`); block.append(element('small','',label),element('strong','',value)); times.append(block);
  }
  const gate = element('div','gate'); gate.append(element('small','','登機門 GATE'),element('strong','',flight.gate));
  bottom.append(times,gate); body.append(top,element('h2','destination',flight.destination),bottom);
  const status = element('div','card-status'); status.append(element('span','status-text',flight.status),element('span','counter',flight.counter ? `櫃台 ${flight.counter}` : flight.aircraft));
  card.append(airline,body,status);
  if (flight.cause) card.append(element('p','cause',flight.cause));
  return card;
}
function renderStatus() {
  const stamp = snapshot?.lastSuccess ? Date.parse(snapshot.lastSuccess) : null;
  const age = stamp === null ? 0 : Math.max(0,Math.floor((Date.now()-stamp)/1000));
  const stale = Boolean(problem || snapshot?.stale || (stamp !== null && age > pollSeconds*2));
  $('connection').textContent = loading ? '查詢中' : !snapshot ? '等待資料' : stale ? '快取資料' : '已取得官方資料';
  $('live-dot').classList.toggle('warning',stale || !snapshot);
  $('last-success').textContent = stamp === null ? '尚未成功' : dateFormat.format(new Date(stamp));
  if (stamp !== null) $('last-success').dateTime = snapshot.lastSuccess;
  $('age').textContent = stamp === null ? '' : `（${age < 60 ? `${age} 秒` : age < 3600 ? `${Math.floor(age/60)} 分鐘` : `${Math.floor(age/3600)} 小時`}前）`;
  const notices = [];
  if (problem) notices.push(problem);
  if (stale && snapshot) notices.push(`顯示${origin || '保留'}快取；航班可能已異動，請留意最後成功取得時間。`);
  if (snapshot?.storageWarning) notices.push(snapshot.storageWarning);
  if (cacheWarning) notices.push(cacheWarning);
  $('notice').hidden = !notices.length; $('notice').textContent = notices.join(' ');
  $('refresh').disabled = loading;
  $('poll-label').textContent = `每 ${pollSeconds} 秒查詢`;
}
function render() {
  const flights = filtered(), total = Math.max(1,Math.ceil(flights.length/capacity()));
  page = Math.min(Math.max(page,0),total-1);
  const key = `${source}|${page}|${capacity()}|${JSON.stringify(flights.slice(page*capacity(),(page+1)*capacity()))}`;
  if (key !== renderedKey) {
    $('board').replaceChildren(...flights.slice(page*capacity(),(page+1)*capacity()).map(card)); renderedKey = key;
  }
  $('board').hidden = !flights.length; $('empty').hidden = Boolean(flights.length);
  $('board').setAttribute('aria-busy',String(loading));
  $('count').textContent = flights.length;
  $('summary').textContent = `${source === 'int' ? '國際線' : '國內線'} · ${snapshot ? snapshot.flights.length + ' 班公開航班' : '等待官方回應'}`;
  $('page').textContent = `${String(page+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;
  $('previous').disabled = total <= 1; $('next').disabled = total <= 1;
  $('rotation-note').textContent = total > 1 ? `${rotating ? '每 18 秒自動翻頁' : '輪播已暫停'} · ${capacity()} 班 / 頁` : '彩色航班卡片 / 台灣時間';
  if (!flights.length) {
    $('empty-title').textContent = !snapshot ? loading ? '正在取得航班' : '暫時無法取得資料' : snapshot.flights.length ? '沒有符合條件的航班' : '官方目前未提供航班';
    $('empty-copy').textContent = !snapshot ? '將持續自動重試；尚無成功快取可顯示。' : snapshot.flights.length ? '請調整搜尋文字或切換為全部航班。' : '此為官方空清單，系統仍會定期重新查詢。';
  }
  renderStatus();
}
function restore() {
  try {
    const value = JSON.parse(localStorage.getItem(`khh-v1-${source}`));
    if (validSnapshot(value,source)) { snapshot = {...value,stale:true}; origin = '瀏覽器'; }
  } catch { /* 被封鎖或損壞的儲存區不阻止線上查詢。 */ }
}
async function refresh() {
  if (loading) return;
  clearTimeout(timer); loading = true; render();
  const run = generation, selectedSource = source;
  const controller = new AbortController(); request = controller;
  const timeout = setTimeout(() => controller.abort(),28000);
  try {
    const response = await fetch(`/api/flights?source=${selectedSource}`,{ cache:'no-store',signal:controller.signal });
    const value = await response.json();
    if (run !== generation) return;
    if (Number.isInteger(value.pollSeconds) && value.pollSeconds >= 30 && value.pollSeconds <= 3600) pollSeconds = value.pollSeconds;
    if (!validSnapshot(value,selectedSource)) throw new Error(value.error || '尚未取得有效的官方資料');
    if (!response.ok) throw new Error(value.error || `本機代理回應 HTTP ${response.status}`);
    if (snapshot && Date.parse(snapshot.lastSuccess) > Date.parse(value.lastSuccess)) {
      problem = '代理資料較舊，保留較新的瀏覽器快取';
    } else {
      snapshot = value; origin = value.stale ? '伺服器' : ''; problem = value.error || null;
      try { localStorage.setItem(`khh-v1-${source}`,JSON.stringify(snapshot)); cacheWarning = ''; }
      catch { cacheWarning = '瀏覽器無法儲存快取'; }
    }
  } catch (err) {
    if (run !== generation) return;
    problem = controller.signal.aborted ? '本機代理連線逾時' : `資料更新失敗：${err.message}`;
  } finally {
    clearTimeout(timeout);
    if (run === generation) { loading = false; render(); timer = setTimeout(refresh,pollSeconds*1000); }
  }
}
function selectSource(value) {
  if (value === source) return;
  generation++; request?.abort(); clearTimeout(timer);
  source = value; snapshot = null; problem = null; loading = false; page = 0; cacheWarning = ''; lastRotation = Date.now();
  for (const [id,key] of [['international','int'],['domestic','dom']]) {
    $(id).classList.toggle('selected',source === key); $(id).setAttribute('aria-pressed',String(source === key));
  }
  $('source-link').href = `https://www.kia.gov.tw/Announce/NewsArea/InstantSchedule_${source === 'int' ? 'INTDEP' : 'DOMDEP'}.json`;
  restore(); refresh();
}
function turn(delta) {
  const pages = Math.max(1,Math.ceil(filtered().length/capacity())); page = (page+delta+pages)%pages; lastRotation = Date.now(); render();
}
$('international').addEventListener('click',() => selectSource('int'));
$('domestic').addEventListener('click',() => selectSource('dom'));
$('refresh').addEventListener('click',refresh);
for (const id of ['search','filter']) $(id).addEventListener('input',() => { page = 0; lastRotation = Date.now(); render(); });
$('previous').addEventListener('click',() => turn(-1)); $('next').addEventListener('click',() => turn(1));
$('rotate').addEventListener('click',() => {
  rotating = !rotating; lastRotation = Date.now(); $('rotate').setAttribute('aria-pressed',String(rotating));
  $('rotate').textContent = rotating ? 'Ⅱ 暫停輪播' : '▶ 開始輪播'; render();
});
$('fullscreen').addEventListener('click',async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { cacheWarning = '無法進入全螢幕，可使用瀏覽器 F11'; renderStatus(); }
});
document.addEventListener('fullscreenchange',() => {
  const active = Boolean(document.fullscreenElement); $('fullscreen').setAttribute('aria-label',active ? '離開全螢幕' : '進入全螢幕');
  $('fullscreen').querySelector('span').textContent = active ? '離開全螢幕' : '全螢幕';
});
window.addEventListener('resize',render);
window.addEventListener('online',refresh);
window.addEventListener('offline',() => { problem = '瀏覽器已離線'; renderStatus(); });
document.addEventListener('visibilitychange',() => { if (!document.hidden) { lastRotation = Date.now(); refresh(); } });
function tick() {
  const now = new Date(); $('clock').textContent = clockFormat.format(now);
  $('date').textContent = new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',weekday:'long'}).format(now) + ' · UTC+8';
  renderStatus();
  if (rotating && !document.hidden && !['INPUT','SELECT'].includes(document.activeElement.tagName) && Date.now()-lastRotation >= 18000) turn(1);
}
restore(); refresh(); tick(); setInterval(tick,1000);
