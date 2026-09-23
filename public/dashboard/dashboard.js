import {createCharacterCard} from '../components/character-card/card.js?v=1';
import {createQuestionBanner} from './question-banner.js';
import {updateWorkspace} from './workspace.js?v=shared-1';
const rows=document.querySelector('#dashboard-rows'),status=document.querySelector('#load-status'),errorBox=document.querySelector('#load-error');
const tones=['clay','jade','blue','violet','gold'];
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function tone(record){const seed={claude:0,gpt:1,deepseek:2,gemini:3};return tones[seed[record.id]??[...record.id].reduce((a,c)=>a+c.charCodeAt(0),0)%tones.length];}
function initial(record){return record.name.trim().charAt(0).toLocaleUpperCase()||'?';}
function cover(record){const node=el('div','cover'),mark=el('span','monogram',initial(record));mark.setAttribute('aria-hidden','true');node.append(mark);if(record.image){try{const url=new URL(record.image);if(url.protocol==='https:'){const image=el('img');image.src=url.href;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>image.remove(),{once:true});node.append(image);}}catch{}}return node;}
function cardLink(record,cls){const link=el('a',`card ${cls} ${tone(record)}`);link.href=record.href;return link;}
function characterCard(record){return createCharacterCard(record);}
function factionCard(record){
 const link=cardLink(record,'faction-card'),art=cover(record),body=el('div','card-copy');
 body.append(el('p','eyebrow',record.type||'Faction'),el('h3','',record.name));if(record.title)body.append(el('p','motto',record.title));
 const footer=el('div','card-footer');footer.append(el('span','',`${record.members} character${record.members===1?'':'s'}`),el('span','','Open faction ↗'));link.append(art,body,footer);return link;
}
function locationCard(record){const link=cardLink(record,'location-card '+record.kind),body=el('div','card-copy');body.append(el('p','eyebrow',record.areaType||record.label),el('h3','',record.name));if(record.parent)body.append(el('p','meta',record.parent));else if(record.summary)body.append(el('p','meta',record.summary));link.append(cover(record),body);return link;}
function eventCard(record){const link=cardLink({...record,id:record.entityId},'event-card'),date=el('p','event-date',record.rawDate);link.append(date,el('h3','',record.name),el('p','meta',record.label));if(!record.date)link.append(el('p','custom-date','Custom calendar · not placed'));return link;}
let cleanup=[];
function rail(title,records,render,href,emptyText='Nothing here yet.'){
 const id='rail-'+title.toLowerCase().replaceAll(' ','-'),section=el('section','rail-section'),header=el('div','rail-header'),heading=el('div','rail-title'),label=el('h2','',title);label.id=id+'-title';section.setAttribute('aria-labelledby',label.id);heading.append(label,el('span','rail-count',String(title==='Open questions'?records.reduce((total,r)=>total+r.questionCount,0):records.length)));
 const actions=el('div','rail-actions');if(href){const all=el('a','view-all','View all');all.href=href;all.setAttribute('aria-label','View all '+title.toLowerCase());actions.append(all);}
 if(!records.length){header.append(heading,actions);section.append(header,el('p','empty-row',emptyText));return section;}
 const list=el('ul','rail');list.id=id;
 const prev=el('button','rail-arrow','‹'),next=el('button','rail-arrow','›');for(const [button,dir]of [[prev,'Previous'],[next,'Next']]){button.type='button';button.setAttribute('aria-label',dir+' '+title.toLowerCase());button.setAttribute('aria-controls',id);actions.append(button);}
 records.forEach(record=>{const item=el('li');item.append(render(record));list.append(item);});header.append(heading,actions);section.append(header,list);
 const update=()=>{prev.disabled=list.scrollLeft<2;next.disabled=list.scrollLeft+list.clientWidth>=list.scrollWidth-2;};
 const page=()=>{const step=list.firstElementChild.getBoundingClientRect().width+parseFloat(getComputedStyle(list).gap);return Math.max(1,Math.floor((list.clientWidth-48)/step))*step;};
 prev.addEventListener('click',()=>list.scrollBy({left:-page()}));next.addEventListener('click',()=>list.scrollBy({left:page()}));list.addEventListener('scroll',update,{passive:true});
 const observer=new ResizeObserver(update);observer.observe(list);cleanup.push(()=>observer.disconnect());requestAnimationFrame(update);return section;
}
function render(data){updateWorkspace(data);cleanup.forEach(fn=>fn());cleanup=[];const questions=createQuestionBanner(data.questions,{el,tone,initial});cleanup.push(questions.destroy);rows.replaceChildren(
 questions.element,
 rail('Characters',data.characters,characterCard,'/characters/','Your characters will appear here.'),
 rail('Factions',data.factions,factionCard,'/factions/','Your houses, families, and alliances will appear here.'),
 rail('Locations',data.locations,locationCard,'/locations/','Your places will appear here.'),
 rail('Through time',[...data.timeline.events,...data.timeline.unplaced],eventCard,'/timeline/','No dates yet. Add birth dates, founding dates, or other dates to your profiles to populate your timeline.')
 );}
let loading=false;
async function load(){if(loading)return;loading=true;errorBox.hidden=true;rows.setAttribute('aria-busy','true');
 try{const response=await fetch('/api/dashboard',{credentials:'same-origin',cache:'no-store'});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Reload the page to sign in again.');const data=await response.json();if(!response.ok)throw new Error(data.error||'Your dashboard could not be loaded.');render(data);status.hidden=true;}
 catch(error){status.hidden=true;errorBox.querySelector('p').textContent=error.message;errorBox.hidden=false;}finally{loading=false;rows.setAttribute('aria-busy','false');}
}
document.querySelector('#retry').addEventListener('click',load);window.addEventListener('pageshow',event=>{if(event.persisted)load();});load();
