export const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
export const leapYear=year=>year%4===0&&(year%100!==0||year%400===0);
export const daysInMonth=(year,month)=>[31,leapYear(year)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
export function datePosition(year,month,day){if(!month)return year+.5;let days=0;for(let m=1;m<month;m++)days+=daysInMonth(year,m);return year+(days+(day?day-1:daysInMonth(year,month)/2))/(leapYear(year)?366:365);}
export function yearLabel(year){return year<=0?`${1-year} BCE`:String(year);}
export function parseStoryDate(raw){
 if(typeof raw!=='string'||!raw.trim()||raw.length>160)return null;
 let text=raw.trim().replace(/\s+/g,' '),approximate=false;
 if(/^(?:c\.?|ca\.?|circa|about|approx\.?)\s+/i.test(text)){approximate=true;text=text.replace(/^(?:c\.?|ca\.?|circa|about|approx\.?)\s+/i,'');}
 let era='';const eraMatch=text.match(/\s+(BCE|BC|CE|AD)$/i);if(eraMatch){era=eraMatch[1].toUpperCase();text=text.slice(0,-eraMatch[0].length);}
 let year,month,day,quarter,half,match;
 if((match=text.match(/^(?:year\s+)?([+-]?\d{1,7})$/i)))year=Number(match[1]);
 else if((match=text.match(/^([+-]?\d{1,7})-([QH])(\d)$/i))){year=Number(match[1]);if(match[2].toUpperCase()==='Q')quarter=Number(match[3]);else half=Number(match[3]);}
 else if((match=text.match(/^([QH])(\d)\s+([+-]?\d{1,7})$/i))){year=Number(match[3]);if(match[1].toUpperCase()==='Q')quarter=Number(match[2]);else half=Number(match[2]);}
 else if((match=text.match(/^([+-]?\d{1,7})-(\d{2})(?:-(\d{2}))?$/))){year=Number(match[1]);month=Number(match[2]);day=match[3]===undefined?undefined:Number(match[3]);}
 else if((match=text.match(/^([a-z]+)\s+(?:(\d{1,2})(?:st|nd|rd|th)?,?\s+)?([+-]?\d{1,7})$/i))){if(!match[2]&&!era&&match[3].replace(/^[+-]/,'').length<3)return null;month=months.findIndex(m=>m.toLowerCase()===match[1].toLowerCase()||m.slice(0,3).toLowerCase()===match[1].toLowerCase())+1;day=match[2]===undefined?undefined:Number(match[2]);year=Number(match[3]);}
 else if((match=text.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+),?\s+([+-]?\d{1,7})$/i))){month=months.findIndex(m=>m.toLowerCase()===match[2].toLowerCase()||m.slice(0,3).toLowerCase()===match[2].toLowerCase())+1;day=Number(match[1]);year=Number(match[3]);}
 else return null;
 if(era&&year<=0)return null;
 if(era==='BC'||era==='BCE')year=1-year;
 if(!Number.isInteger(year)||Math.abs(year)>999999||month!==undefined&&(!month||month>12)||day!==undefined&&(!day||day>daysInMonth(year,month)))return null;
 if(quarter!==undefined&&(quarter<1||quarter>4)||half!==undefined&&(half<1||half>2))return null;
 const precision=day?'day':month?'month':quarter?'quarter':half?'half-year':'year';
 const firstMonth=month||(quarter?(quarter-1)*3+1:half?(half-1)*6+1:1);
 const start=datePosition(year,firstMonth,day||1);
 const nextMonth=firstMonth+(precision==='month'?1:precision==='quarter'?3:precision==='half-year'?6:12);
 const end=precision==='day'?start+1/(leapYear(year)?366:365):nextMonth>12?year+1:datePosition(year,nextMonth,1);
 return {year,month:month??null,day:day??null,quarter:quarter??null,half:half??null,precision,approximate,start,end,position:precision==='day'?start:(start+end)/2,text:raw.trim()};
}

export const precisionNames={day:'Day',month:'Month',quarter:'Quarter','half-year':'Half-year',year:'Year'};
export function formatStoryDate({year,month,day,quarter,half,precision='day',approximate=false}){
 if(!Number.isInteger(year)||Math.abs(year)>999999)throw new Error('Choose a supported year.');
 const displayYear=year<=0?1-year:year,suffix=year<=0?' BCE':'',prefix=approximate?'c. ':'';
 const padded=String(displayYear).padStart(4,'0'),pad=value=>String(value).padStart(2,'0');
 const value=precision==='year'?String(displayYear):precision==='month'?`${padded}-${pad(month)}`:precision==='quarter'?`${padded}-Q${quarter}`:precision==='half-year'?`${padded}-H${half}`:`${padded}-${pad(month)}-${pad(day)}`;
 const text=prefix+value+suffix;if(!parseStoryDate(text))throw new Error('Choose a valid date.');return text;
}
// Sunday = 0. Proleptic Gregorian arithmetic works for BCE and years 0–99.
export function weekday(year,month,day=1){
 const y=year-(month<3?1:0),era=Math.floor(y/400),yoe=y-era*400,m=month+(month>2?-3:9);
 const days=era*146097+yoe*365+Math.floor(yoe/4)-Math.floor(yoe/100)+Math.floor((153*m+2)/5)+day-1-719468;
 return ((days+4)%7+7)%7;
}
export function shiftMonth(year,month,delta){const value=year*12+month-1+delta,y=Math.floor(value/12);return {year:y,month:value-y*12+1};}
export function calendarCells(year,month){
 const start=weekday(year,month),previous=shiftMonth(year,month,-1),next=shiftMonth(year,month,1),length=daysInMonth(year,month),previousLength=daysInMonth(previous.year,previous.month);
 return Array.from({length:42},(_,index)=>{const day=index-start+1;return day<1?{...previous,day:previousLength+day,outside:true}:day>length?{...next,day:day-length,outside:true}:{year,month,day,outside:false};});
}
