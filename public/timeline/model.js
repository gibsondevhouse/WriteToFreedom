import {locationTemplates} from '../locations/template.js';
import {locationPaths,typePlurals} from '../locations/data.js';
// Timeline coordinates use astronomical years (0 = 1 BCE). Original date text is
// always retained; coarse dates are positioned at their midpoint, never invented days.
export const types={character:'Characters',faction:'Factions',lore:'Lore',...typePlurals};
export const kinds={origin:'Origins',birth:'Births',death:'Deaths',founded:'Foundings',settled:'Settlements',incorporated:'Charters',population:'Population records',formation:'Formations',discovery:'Discoveries',abandonment:'Abandonments',restoration:'Restorations'};
import {months,leapYear,daysInMonth,datePosition,yearLabel,parseStoryDate} from '../profiles/dates.js?v=date-picker-1';
export {leapYear,daysInMonth,datePosition,yearLabel,parseStoryDate} from '../profiles/dates.js?v=date-picker-1';
const fields={
 lore:[['originDate','origin','Origin / first appearance']],
 ...Object.fromEntries(Object.entries(locationTemplates).map(([type,template])=>[type,template.dates])),
 character:[['birthDate','birth','Born'],['deathDate','death','Died']],
 faction:[['founded','founded','Founded']],country:[['founded','founded','Established'],['populationDate','population','Population recorded']],
 city:[['settled','settled','First settled'],['incorporated','incorporated','Chartered'],['populationDate','population','Population recorded']]
};
const paths={...locationPaths,lore:'/lore/',character:'/characters/',faction:'/factions/'};
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
