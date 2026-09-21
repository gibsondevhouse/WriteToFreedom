// Timeline coordinates use astronomical years (0 = 1 BCE). Original date text is
// always retained; coarse dates are positioned at their midpoint, never invented days.
export const types={character:'Characters',faction:'Factions',country:'Countries',city:'Cities'};
export const kinds={birth:'Births',death:'Deaths',founded:'Foundings',settled:'Settlements',incorporated:'Charters',population:'Population records'};
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
export const leapYear=year=>year%4===0&&(year%100!==0||year%400===0);
export const daysInMonth=(year,month)=>[31,leapYear(year)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
export function datePosition(year,month,day){if(!month)return year+.5;let days=0;for(let m=1;m<month;m++)days+=daysInMonth(year,m);return year+(days+(day?day-1:daysInMonth(year,month)/2))/(leapYear(year)?366:365);}
export function yearLabel(year){return year<=0?`${1-year} BCE`:String(year);}
export function parseStoryDate(raw){
 if(typeof raw!=='string'||!raw.trim()||raw.length>160)return null;
 let text=raw.trim().replace(/\s+/g,' '),approximate=false;
 if(/^(?:c\.?|ca\.?|circa|about|approx\.?)\s+/i.test(text)){approximate=true;text=text.replace(/^(?:c\.?|ca\.?|circa|about|approx\.?)\s+/i,'');}
 let era='';const eraMatch=text.match(/\s+(BCE|BC|CE|AD)$/i);if(eraMatch){era=eraMatch[1].toUpperCase();text=text.slice(0,-eraMatch[0].length);}
 let year,month,day,match;
 if((match=text.match(/^(?:year\s+)?([+-]?\d{1,6})$/i)))year=Number(match[1]);
 else if((match=text.match(/^([+-]?\d{1,6})-(\d{2})(?:-(\d{2}))?$/))){year=Number(match[1]);month=Number(match[2]);day=match[3]===undefined?undefined:Number(match[3]);}
 else if((match=text.match(/^([a-z]+)\s+(?:(\d{1,2})(?:st|nd|rd|th)?,?\s+)?([+-]?\d{1,6})$/i))){if(!match[2]&&!era&&match[3].replace(/^[+-]/,'').length<3)return null;month=months.findIndex(m=>m.toLowerCase()===match[1].toLowerCase()||m.slice(0,3).toLowerCase()===match[1].toLowerCase())+1;day=match[2]===undefined?undefined:Number(match[2]);year=Number(match[3]);}
 else if((match=text.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+),?\s+([+-]?\d{1,6})$/i))){month=months.findIndex(m=>m.toLowerCase()===match[2].toLowerCase()||m.slice(0,3).toLowerCase()===match[2].toLowerCase())+1;day=Number(match[1]);year=Number(match[3]);}
 else return null;
 if(era&&year<=0)return null;
 if(era==='BC'||era==='BCE')year=1-year;
 if(!Number.isInteger(year)||Math.abs(year)>999999||month!==undefined&&(!month||month>12)||day!==undefined&&(!day||day>daysInMonth(year,month)))return null;
 return {year,month:month??null,day:day??null,precision:day?'day':month?'month':'year',approximate,position:datePosition(year,month,day),text:raw.trim()};
}
const fields={
 character:[['birthDate','birth','Born'],['deathDate','death','Died']],
 faction:[['founded','founded','Founded']],country:[['founded','founded','Established'],['populationDate','population','Population recorded']],
 city:[['settled','settled','First settled'],['incorporated','incorporated','Chartered'],['populationDate','population','Population recorded']]
};
const paths={character:'/characters/',faction:'/factions/',country:'/locations/countries/',city:'/locations/cities/'};
export function collectTimeline(catalogs){
 const events=[],unplaced=[],counts={};let undated=0;
 for(const [type,records] of Object.entries(catalogs)){
  counts[type]=records.length;
  for(const record of records){let hasDate=false;
   for(const [field,kind,label] of fields[type]){
    if(!record[field]?.trim()||kind==='population'&&!record.population?.trim())continue;
    hasDate=true;const date=parseStoryDate(record[field]),entry={id:`${type}:${record.id}:${field}`,entityId:`${type}:${record.id}`,name:record.name?.trim()||'Untitled '+type,type,kind,field,label:kind==='population'?`${label}: ${record.population}`:label,rawDate:record[field],href:paths[type]+encodeURIComponent(record.id)+'/#field-'+field};
    if(date)events.push({...entry,date});else unplaced.push(entry);
   }
   if(!hasDate)undated++;
  }
 }
 events.sort((a,b)=>a.date.position-b.date.position||a.id.localeCompare(b.id));
 return {events,unplaced,undated,counts};
}
export function filterEvents(events,{query='',types:selectedTypes=Object.keys(types),kinds:selectedKinds=Object.keys(kinds)}={}){
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return events.filter(e=>selectedTypes.includes(e.type)&&selectedKinds.includes(e.kind)&&terms.every(term=>`${e.name} ${e.label} ${e.rawDate}`.toLocaleLowerCase().includes(term)));
}
export function timelineRows(events){
 const rows=new Map();for(const event of events){if(!rows.has(event.entityId))rows.set(event.entityId,{id:event.entityId,name:event.name,type:event.type,events:[]});rows.get(event.entityId).events.push(event);}
 return [...rows.values()].sort((a,b)=>a.events[0].date.position-b.events[0].date.position||a.id.localeCompare(b.id));
}
export const minScale=.002,maxScale=60000;
export function zoomAt(view,factor,pixel){const scale=Math.min(maxScale,Math.max(minScale,view.scale*factor));return {...view,scale,start:view.start+pixel/view.scale-pixel/scale};}
export function fitView(events,width){if(!events.length)return {start:1,scale:120};const lo=events[0].date.position,hi=events.at(-1).date.position,span=Math.max(5,hi-lo+2);return {start:(lo+hi)/2-span/2,scale:Math.min(maxScale,Math.max(minScale,(width-100)/span))};}
export function rulerTicks(start,width,scale){
 const end=start+width/scale,result=[];
 if(scale>=50000){
  for(let year=Math.floor(start);year<=Math.floor(end);year++)for(let month=1;month<=12;month++)for(let day=1;day<=daysInMonth(year,month);day++){
   const value=datePosition(year,month,day);if(value>=start-1/scale&&value<=end)result.push({value,label:`${months[month-1].slice(0,3)} ${day}`,major:day===1,year:yearLabel(year)});
  }
 }else if(scale>=1000){
  const step=scale>=2400?1:3;
  for(let year=Math.floor(start);year<=Math.floor(end);year++)for(let month=1;month<=12;month+=step){const value=datePosition(year,month,1);if(value>=start-1/scale&&value<=end)result.push({value,label:months[month-1].slice(0,3),major:month===1,year:yearLabel(year)});}
 }else{
  const target=100/scale,power=10**Math.floor(Math.log10(Math.max(1,target))),step=[1,2,5,10].map(n=>n*power).find(n=>n>=target)||power*10;
  for(let year=Math.floor(start/step)*step;year<=end;year+=step)result.push({value:year,label:yearLabel(year),major:true});
 }
 return result;
}
