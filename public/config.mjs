export const BOARDS = Object.freeze({
  int: { label:'國際出境', title:'國際線出境', english:'DEPARTURES', direction:'dep', international:true, airportLabel:'目的地', airportEnglish:'Destination', suffix:'INTDEP' },
  'int-arr': { label:'國際入境', title:'國際線入境', english:'ARRIVALS', direction:'arr', international:true, airportLabel:'來自地點', airportEnglish:'From', suffix:'INTARR' },
  dom: { label:'國內出境', title:'國內線離站', english:'DEPARTURES', direction:'dep', international:false, airportLabel:'目的地', airportEnglish:'Dest', suffix:'DOMDEP' },
  'dom-arr': { label:'國內入境', title:'國內線到站', english:'ARRIVALS', direction:'arr', international:false, airportLabel:'來自地點', airportEnglish:'From', suffix:'DOMARR' }
});
export const sourceUrl = source => `https://www.kia.gov.tw/Announce/NewsArea/InstantSchedule_${BOARDS[source].suffix}.json`;
export function layout(width, height, international, availableHeight = height * .7) {
  const panels = international && width >= 1000 ? 2 : 1;
  const rowHeight = Math.max(34, Math.min(110, height * .044));
  const headerHeight = height * (width < 1000 ? .05 : .06);
  const rowCount = Math.max(1, Math.min(18, Math.floor((availableHeight - headerHeight) / rowHeight)));
  return { panels, rowCount, capacity:panels*rowCount };
}
