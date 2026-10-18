import { test } from 'node:test';
import assert from 'node:assert/strict';
const model = await import('../public/model.mjs').catch(() => ({}));
const row = {
  expectTime: '07:00', realTime: '07:20', airLineName: '台灣虎航', airLineCode: 'TTW',
  airLineLogo: 'https://www.kia.gov.tw/images/ALL-square/IT.png', airLineUrl: '',
  airLineNum: 'IT284', goalAirportCode: 'KIX', goalAirportName: '大阪/關西',
  airPlaneType: 'A320', airBoardingGate: '29', checkInIsland: 'D', checkInDeskRange: '12–0',
  airFlyStatus: '離站', airFlyDelayCause: ''
};
test('官方 expectTime 是表定，realTime 在離站時標為實際，保留原始狀態', () => {
  assert.equal(typeof model.normalizeFlights, 'function');
  const [flight] = model.normalizeFlights([row]);
  assert.equal(flight.scheduled, '07:00');
  assert.equal(flight.updatedTime, '07:20');
  assert.equal(flight.timeLabel, '實際');
  assert.equal(flight.status, '離站');
  assert.equal(flight.destination, '大阪/關西');
  assert.equal(flight.airlineCode, 'TTW');
});
test('時間差不自行推斷延誤，共掛航班與未知狀態原樣保留', () => {
  const [flight] = model.normalizeFlights([{ ...row, airLineNum: 'BR108 / NH5832', airFlyStatus: '異動中' }]);
  assert.equal(flight.number, 'BR108 / NH5832');
  assert.equal(flight.status, '異動中');
  assert.equal(flight.tone, 'neutral');
  assert.equal(flight.timeLabel, '預計');
});
test('缺少選填欄位不捏造時間、登機門或準點狀態，危險圖示 URL 不使用', () => {
  const [flight] = model.normalizeFlights([{ ...row, realTime: '', airBoardingGate: '', airFlyStatus: '', airLineLogo: 'javascript:alert(1)' }]);
  assert.equal(flight.updatedTime, '—');
  assert.equal(flight.gate, '—');
  assert.equal(flight.status, '尚未提供');
  assert.equal(flight.logo, '');
});
test('不接受 HTML、錯誤物件、壞時間及部分損壞清單，合法空清單可清除舊航班', () => {
  for (const data of [{ error: true }, '<html>', [row, {}], [{ ...row, expectTime: '25:60' }]]) {
    assert.throws(() => model.normalizeFlights(data));
  }
  assert.deepEqual(model.normalizeFlights([]), []);
});
test('依表定穩定排序，不刪除不同航空公司共掛資料', () => {
  const flights = model.normalizeFlights([{ ...row, expectTime: '23:50' }, { ...row, airLineNum: 'NH5832', expectTime: '00:05' }]);
  assert.equal(flights[0].number, 'NH5832');
  assert.equal(flights.length, 2);
});
test('瀏覽器快取驗證拒絕未來或無效成功時間與損壞航班', () => {
  assert.equal(typeof model.validSnapshot, 'function');
  const snapshot = { flights: model.normalizeFlights([row]), lastSuccess: '2026-10-18T01:00:00.000Z', source: 'int' };
  assert.equal(model.validSnapshot(snapshot, 'int', Date.parse('2026-10-18T02:00Z')), true);
  assert.equal(model.validSnapshot({ ...snapshot, lastSuccess: 'bad' }, 'int'), false);
  assert.equal(model.validSnapshot(snapshot, 'dom'), false);
  assert.equal(model.validSnapshot({ ...snapshot, flights: [{}] }, 'int'), false);
});
test('入境使用出發地 upAirport，不誤認為目的地；抵達時間標實際', () => {
  const arrival = { ...row, upAirportName:'曼谷/廊曼', upAirportCode:'DMK', airFlyStatus:'抵達' };
  delete arrival.goalAirportName; delete arrival.goalAirportCode;
  const [flight] = model.normalizeFlights([arrival], 'int-arr');
  assert.equal(flight.destination, '曼谷/廊曼');
  assert.equal(flight.airport, 'DMK');
  assert.equal(flight.timeLabel, '實際');
  assert.equal(flight.tone, 'arrived');
  assert.throws(() => model.normalizeFlights([row], 'int-arr'));
});
