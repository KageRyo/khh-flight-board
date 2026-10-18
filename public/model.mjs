// 官方欄位 expectTime=表定；realTime=異動時間，已離站時為實際時間。
const clean = value => typeof value === 'string' ? value.trim() : '';
const time = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clean(value));
export function statusTone(status) {
  if (/取消|取消航班|Cancel/i.test(status)) return 'cancelled';
  if (/延誤|延遲|Delay/i.test(status)) return 'delayed';
  if (/最後|關閉|Final|Closed/i.test(status)) return 'final';
  if (/登機|Boarding/i.test(status)) return 'boarding';
  if (/離站|起飛|Departed/i.test(status)) return 'departed';
  return 'neutral';
}
function safeLogo(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.kia.gov.tw' && url.pathname.startsWith('/images/') ? url.href : '';
  } catch { return ''; }
}
export function normalizeFlights(data) {
  if (!Array.isArray(data)) throw new Error('官方回應不是航班清單');
  return data.map((row, index) => {
    if (!row || !clean(row.airLineNum) || !clean(row.goalAirportName) || !time(row.expectTime)) {
      throw new Error(`官方航班欄位格式異常（第 ${index + 1} 筆）`);
    }
    if (clean(row.realTime) && !time(row.realTime)) throw new Error('官方異動時間格式異常');
    const status = clean(row.airFlyStatus) || '尚未提供';
    const tone = statusTone(status);
    return {
      id: `${row.airLineNum}-${row.expectTime}-${index}`,
      number: clean(row.airLineNum), airline: clean(row.airLineName) || '航空公司未提供',
      airlineCode: clean(row.airLineCode), logo: safeLogo(row.airLineLogo),
      scheduled: clean(row.expectTime), updatedTime: clean(row.realTime) || '—',
      timeLabel: tone === 'departed' ? '實際' : '預計',
      destination: clean(row.goalAirportName), airport: clean(row.goalAirportCode),
      gate: clean(row.airBoardingGate) || '—', status, tone,
      cause: clean(row.airFlyDelayCause), aircraft: clean(row.airPlaneType),
      counter: [clean(row.checkInIsland), clean(row.checkInDeskRange)].filter(Boolean).join(' ')
    };
  }).sort((a, b) => a.scheduled.localeCompare(b.scheduled));
}
export function validSnapshot(value, source, now = Date.now()) {
  if (!value || value.source !== source || typeof value.lastSuccess !== 'string') return false;
  const stamp = Date.parse(value.lastSuccess);
  if (!Number.isFinite(stamp) || stamp > now + 60000) return false;
  return Array.isArray(value.flights) && value.flights.every(f =>
    f && typeof f.number === 'string' && typeof f.destination === 'string' && time(f.scheduled) &&
    ['airline','airlineCode','logo','updatedTime','timeLabel','airport','gate','status','tone','cause','aircraft','counter','id'].every(k => typeof f[k] === 'string'));
}
