// A feed's row index can change between updates; use the published flight and time.
export const flightKey = flight => JSON.stringify([flight.number, flight.scheduled]);
const known = value => typeof value === 'string' && value.trim() !== '' && value !== '—';
export const valuesFor = (flights, field) => [...new Set(flights.map(f => f[field]).filter(known))].sort((a,b) => a.localeCompare(b, 'zh-Hant', {numeric:true}));
function locationValue(value, mode) {
  if(!known(value))return '';
  const clean=value.trim();
  if(mode !== 'counter')return clean;
  if(clean === '0')return '';
  // Zero desk endpoints are missing values, not actual desk numbers.
  const range=clean.match(/^(?:(.*?)\s+)?(\d+|—)\s*[-–—]\s*(\d+|—)$/);
  if(!range)return clean;
  const island=range[1] || '';
  const start=range[2] === '0' ? '—' : range[2];
  const end=range[3] === '0' ? '—' : range[3];
  return start === '—' && end === '—' ? island : [island,`${start}–${end}`].filter(Boolean).join(' ');
}
export function selectDisplay(flights, mode, requested = {}) {
  const field = mode === 'counter' ? 'counter' : 'gate';
  const locations = valuesFor(flights.map(f=>({...f,[field]:locationValue(f[field],mode)})), field);
  const location = locationValue(requested.location,mode) || locations[0] || '';
  // A mounted screen must never silently become a different gate or counter.
  if(location && !locations.includes(location))locations.unshift(location);
  const atLocation = location ? flights.filter(f => locationValue(f[field],mode) === location) : [];
  const airlines = valuesFor(atLocation, 'airline');
  const airline = known(requested.airline) ? requested.airline : airlines[0] || '';
  if(airline && !airlines.includes(airline))airlines.unshift(airline);
  const matches = mode === 'counter' ? atLocation.filter(f => f.airline === airline) : atLocation;
  const selected = matches.find(f => flightKey(f) === requested.flight) || matches[0] || null;
  return { locations, location, airlines, airline, flights:matches, selected };
}
export function safeAirlineLogo(value) {
  try { const url = new URL(value); return url.origin === 'https://www.kia.gov.tw' && url.pathname.startsWith('/images/') ? url.href : ''; }
  catch { return ''; }
}
