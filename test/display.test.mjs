import test from 'node:test';
import assert from 'node:assert/strict';
import { flightKey, selectDisplay, safeAirlineLogo } from '../public/display-model.mjs';
const flights=[
  {id:'CI123-10:00-0',number:'CI123',scheduled:'10:00',gate:'25',counter:'B 01–06',airline:'中華航空'},
  {id:'CI125-12:00-1',number:'CI125',scheduled:'12:00',gate:'25',counter:'B 01–06',airline:'中華航空'},
  {id:'BR100-12:00-2',number:'BR100',scheduled:'12:00',gate:'26',counter:'B 01–06',airline:'長榮航空'},
  {id:'B7123-13:00-3',number:'B7123',scheduled:'13:00',gate:'—',counter:'',airline:'立榮航空'}
];
test('shared gate selection survives row reordering and changing source ids',()=>{
  const requested={location:'25',flight:flightKey(flights[1])};
  const updated=flights.toReversed().map((f,index)=>({...f,id:`changed-${index}`}));
  const result=selectDisplay(updated,'gate',requested);
  assert.equal(result.selected.number,'CI125');
  assert.deepEqual(result.flights.map(f=>f.number),['CI125','CI123']);
});
test('counter selection uses official assignment and separates airlines sharing it',()=>{
  const result=selectDisplay(flights,'counter',{location:'B 01–06',airline:'長榮航空'});
  assert.deepEqual(result.flights.map(f=>f.number),['BR100']);
  assert.deepEqual(result.locations,['B 01–06']);
  assert.equal(selectDisplay([flights[3]],'counter').selected,null);
});
test('mounted screens keep their location when assignments disappear; no phantom reassignment',()=>{
  const requested={location:'25',flight:flightKey(flights[1])};
  const changed=selectDisplay([flights[2]],'gate',requested);
  assert.equal(changed.selected,null);assert.equal(changed.location,'25');assert.ok(changed.locations.includes('25'));
  assert.equal(selectDisplay([flights[0]],'gate',requested).selected.number,'CI123');
  const counter=selectDisplay([flights[2]],'counter',{location:'A 01–04'});
  assert.equal(counter.location,'A 01–04');assert.equal(counter.selected,null);
  const empty=selectDisplay([],'gate',requested);
  assert.equal(empty.selected,null);assert.equal(empty.location,'25');assert.deepEqual(empty.flights,[]);
});
test('logo URLs from untrusted snapshots cannot navigate outside official image directory',()=>{
  for(const logo of ['javascript:alert(1)','https://www.kia.gov.tw.evil.test/images/logo.png','https://www.kia.gov.tw/images/../Announce/x','http://www.kia.gov.tw/images/logo.png'])assert.equal(safeAirlineLogo(logo),'');
  assert.equal(safeAirlineLogo('https://www.kia.gov.tw/images/logo.png'),'https://www.kia.gov.tw/images/logo.png');
});

test('counter screens retain an explicit airline when it disappears from a shared counter',()=>{
  const requested={location:'B 01–06',airline:'中華航空',flight:flightKey(flights[1])};
  const before=selectDisplay(flights,'counter',requested);
  assert.equal(before.selected.number,'CI125');
  const after=selectDisplay([flights[2]],'counter',requested);
  assert.equal(after.airline,'中華航空');
  assert.ok(after.airlines.includes('中華航空'));
  assert.equal(after.selected,null);
  assert.deepEqual(after.flights,[]);
});

test('zero desk placeholders never become counter assignments or persistent selections',()=>{
  const data=[
    {...flights[0],counter:'0–0'},
    {...flights[1],counter:'0-0'},
    {...flights[2],counter:'0—0'},
    {...flights[3],counter:'0'},
    {...flights[0],counter:'A 0–0'},
    {...flights[1],counter:'B 01–06'}
  ];
  const result=selectDisplay(data,'counter',{location:'0–0'});
  assert.deepEqual(result.locations,['A','B 01–06']);
  assert.equal(result.location,'A');
  assert.equal(result.selected.counter,'A 0–0');
  assert.deepEqual(result.flights.map(f=>f.counter),['A 0–0']);
  assert.equal(selectDisplay(data,'counter',{location:'A 0–0'}).location,'A');
  assert.equal(selectDisplay(data.slice(0,4),'counter',{location:'0-0'}).selected,null);
});

test('missing counter range endpoints remain explicitly unknown without invented desks',()=>{
  const data=['B 4–0','D 12–0','C 3–0','B 0–0','A 0–8'].map((counter,index)=>({...flights[0],number:`CI${index}`,counter}));
  const result=selectDisplay(data,'counter',{location:'B 4–0'});
  assert.deepEqual(result.locations,['A —–8','B','B 4–—','C 3–—','D 12–—']);
  assert.equal(result.location,'B 4–—');
  assert.deepEqual(result.flights.map(f=>f.counter),['B 4–0']);
  assert.equal(selectDisplay(data,'counter',{location:'B 4–—'}).selected.number,'CI0');
  assert.equal(selectDisplay(data,'counter',{location:'B'}).selected.number,'CI3');
});
