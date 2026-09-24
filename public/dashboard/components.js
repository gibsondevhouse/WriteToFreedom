// Shared presentation primitives for the home and Lore dashboards.
import {createLoreCard} from '../components/lore-card/card.js';
const tones=['clay','jade','blue','violet','gold'];
export function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
export function tone(record){const seed={claude:0,gpt:1,deepseek:2,gemini:3};return tones[seed[record.id]??[...record.id].reduce((a,c)=>a+c.charCodeAt(0),0)%tones.length];}
export function initial(record){return record.name.trim().charAt(0).toLocaleUpperCase()||'?';}
export function cover(record){const node=el('div','cover'),mark=el('span','monogram',initial(record));mark.setAttribute('aria-hidden','true');node.append(mark);if(record.image){try{const url=new URL(record.image);if(url.protocol==='https:'){const image=el('img');image.src=url.href;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>image.remove(),{once:true});node.append(image);}}catch{}}return node;}
export function cardLink(record,cls){const link=el('a',`card ${cls} ${tone(record)}`);link.href=record.href;return link;}
export function factionCard(record){
 const link=cardLink(record,'faction-card'),art=cover(record),body=el('div','card-copy');
 body.append(el('p','eyebrow',record.type||'Faction'),el('h3','',record.name));if(record.title)body.append(el('p','motto',record.title));
 const footer=el('div','card-footer');footer.append(el('span','',`${record.members} character${record.members===1?'':'s'}`),el('span','','Open faction ↗'));link.append(art,body,footer);return link;
}
export function locationCard(record){const link=cardLink(record,'location-card '+record.kind),body=el('div','card-copy');body.append(el('p','eyebrow',record.areaType||record.label),el('h3','',record.name));if(record.parent)body.append(el('p','meta',record.parent));else if(record.summary)body.append(el('p','meta',record.summary));link.append(cover(record),body);return link;}
/** Landscape artwork with a type badge and a separate, compact caption. */
export function artifactCard(record){
 const card=cardLink(record,'artifact-card'),art=cover(record),copy=el('div','artifact-card-copy');
 card.setAttribute('aria-label','Open '+(record.label||'artifact').toLowerCase()+': '+record.name);
 const badge=el('span','artifact-card-badge',record.label||'Artifact'),accent=el('span','artifact-card-accent');accent.setAttribute('aria-hidden','true');art.append(badge,accent);
 const count=Number(record.connectionCount)||0;
 const detail=record.summary?.trim()||(count?`${count} connection${count===1?'':'s'}`:record.label||'Artifact');
 const metadata=[record.pinned&&'Pinned',record.featured&&'Featured',detail].filter(Boolean).join(' · ');
 copy.append(el('h3','',record.name),el('p','artifact-card-meta',metadata));card.append(art,copy);return card;
}
/** Portrait artwork with the title and a quiet detail line below the cover. */
export function bookCoverCard(record){
 const card=cardLink(record,'book-cover-card'),copy=el('div','book-cover-copy');
 card.setAttribute('aria-label','Open '+(record.label||record.type).toLowerCase()+': '+record.name);
 const title=el('h3','',record.name);title.title=record.name;
 const detail=[record.label,record.pinned&&'Pinned',record.featured&&'Featured'].filter(Boolean).join(' · ');
 const metadata=el('p','book-cover-meta',detail);metadata.title=detail;
 copy.append(title,metadata);card.append(cover(record),copy);return card;
}
/** A collection's format takes precedence; mixed rails use the entry's type. */
export function loreEntryCard(record,{collection=''}={}){
 if(record.type==='note')return noteCard(record);
 if(collection==='books'||collection==='relics')return bookCoverCard(record);
 if(collection==='artifacts')return artifactCard(record);
 if(collection==='jewels'||collection==='species')return createLoreCard(record);
 if(record.type==='jewel'||record.type==='species')return createLoreCard(record);
 if(record.type==='book'||record.type==='relic')return bookCoverCard(record);
 if(record.type==='artifact'||record.collections?.includes('artifacts'))return artifactCard(record);
 const card=locationCard(record);card.classList.add('lore-entry-card');
 const body=card.querySelector('.card-copy');
 if(record.pinned)card.querySelector('.eyebrow').append(document.createTextNode(' · Pinned'));
 if(record.parent&&record.summary)body.append(el('p','lore-entry-summary',record.summary));
 if(record.connectionCount)body.append(el('p','meta',`${record.connectionCount} connection${record.connectionCount===1?'':'s'}`));
 return card;
}
const noteIconPaths={
 note:'M6 3h9l4 4v14H6Z M14 3v5h5 M9 12h7 M9 16h5',
 person:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2',
 bookmark:'M6 3h12v18l-6-4-6 4Z',
 read:'M4 4h16v13H10l-5 4v-4H4ZM8 8h8M8 12h5',
 link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
 more:'M12 5h.01M12 12h.01M12 19h.01'
};
function noteIcon(kind){
 const icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(icon.namespaceURI,'path');
 icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');path.setAttribute('d',noteIconPaths[kind]);icon.append(path);return icon;
}
/** Three independent regions: preview link, identity/menu, and note actions. */
export function noteCard(record){
 const card=el('article','card note-card '+tone(record)),main=el('a','note-card-main'),copy=el('div','note-card-copy');
 card.setAttribute('aria-label','Note: '+record.name);main.href=record.href;main.setAttribute('aria-label','Open note: '+record.name);
 const preview=el('div','note-card-preview'),kind=el('p','note-card-kind');
 kind.append(noteIcon('note'),el('span','',(record.label||'Note')+(record.pinned?' · Pinned':'')));
 const summary=record.summary?.trim();
 preview.append(kind,el('p','note-card-excerpt'+(summary?'':' note-card-empty'),summary||'Open this note to start writing.'));
 copy.append(preview,el('h3','note-card-title',record.name));
 main.append(cover(record),copy);
 const identity=el('div','note-card-identity'),source=el('a','note-card-source'),mark=el('span','note-card-source-mark'),context=el('div','note-card-context');
 source.href=record.contextual?record.href:'/lore/?collection=notes';source.setAttribute('aria-label',record.contextual?'View note in '+record.parent:'Open notes collection');
 mark.setAttribute('aria-hidden','true');
 if(record.parent)mark.textContent=initial({name:record.parent});else mark.append(noteIcon('person'));
 context.append(el('p','note-card-source-name',record.parent||'Your lore'));
 const updated=new Date(record.updatedAt);
 if(!record.contextual&&record.updatedAt&&!Number.isNaN(updated.valueOf())){
  const date=el('time','note-card-date',new Intl.DateTimeFormat(document.documentElement.lang||'en',{month:'long',day:'numeric',year:'numeric'}).format(updated));date.dateTime=updated.toISOString();date.title='Last updated';context.append(date);
 }else context.append(el('p','note-card-date',record.contextual?'Character note':'Note'));
 source.append(mark,context);
 const target=section=>record.contextual?record.href:record.href+'#'+section;
 const more=el('details','note-card-more'),trigger=el('summary','note-card-icon-action'),menu=el('nav','note-card-menu');
 trigger.setAttribute('aria-label','More actions for '+record.name);trigger.title='More actions';trigger.append(noteIcon('more'));menu.setAttribute('aria-label','Actions for '+record.name);
 for(const [label,href] of [['Open note',record.href],['Read notes',target('notes')],['Connections',target('connections')],...(!record.contextual?[['Pin and feature settings',target('identity-dashboard')]]:[])]){
  const link=el('a','',label);link.href=href;menu.append(link);
 }
 more.append(trigger,menu);more.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();more.open=false;trigger.focus();}});
 identity.append(source,more);
 const actions=el('div','note-card-actions'),left=el('div','note-card-action-links'),connections=Number(record.connectionCount)||0;
 actions.setAttribute('role','group');actions.setAttribute('aria-label','Note actions');
 const action=(icon,label,href)=>{const link=el('a','note-card-icon-action');link.href=href;link.setAttribute('aria-label',label+' for '+record.name);link.title=label;link.append(noteIcon(icon));return link;};
 const settings=action('bookmark',record.contextual?'Open character note':'Pin and feature settings',target('identity-dashboard'));
 if(record.pinned)settings.classList.add('is-pinned');
 left.append(settings,action('read','Read note',target('notes')));
 const related=el('a','note-card-connections');related.href=target('connections');related.setAttribute('aria-label',`${connections} connection${connections===1?'':'s'} for ${record.name}`);related.title='Connections';
 const badge=el('span','note-card-connection-badge');badge.append(noteIcon('link'));related.append(badge,el('span','',String(connections)));
 actions.append(left,related);card.append(main,identity,actions);return card;
}
export function eventCard(record){const link=cardLink({...record,id:record.entityId},'event-card'),date=el('p','event-date',record.rawDate);link.append(date,el('h3','',record.name),el('p','meta',record.label));if(!record.date)link.append(el('p','custom-date','Custom calendar · not placed'));return link;}

export function createRails({idPrefix=''}={}){
let cleanup=[],index=0;
function rail(title,records,render,href,emptyText='Nothing here yet.',{id:sectionId,emptyAction}={}){
 const slug=String(sectionId||title).toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
 const id=(idPrefix?idPrefix+'-':'')+'rail-'+slug+'-'+(++index),section=el('section','rail-section'),header=el('div','rail-header'),heading=el('div','rail-title'),label=el('h2','',title);label.id=id+'-title';section.setAttribute('aria-labelledby',label.id);heading.append(label,el('span','rail-count',String(title==='Open questions'?records.reduce((total,r)=>total+r.questionCount,0):records.length)));
 const actions=el('div','rail-actions');if(href){const all=el('a','view-all','View all');all.href=href;all.setAttribute('aria-label','View all '+title.toLowerCase());actions.append(all);}
 if(!records.length){
  const empty=el('div','empty-row rail-empty');empty.append(el('p','',emptyText));
  if(emptyAction){const button=el('button','workspace-action',emptyAction.label);button.type='button';button.addEventListener('click',emptyAction.onClick);empty.append(button);}
  header.append(heading,actions);section.append(header,empty);return section;
 }
 const list=el('ul','rail');list.id=id;
 const prev=el('button','rail-arrow','‹'),next=el('button','rail-arrow','›');for(const [button,dir]of [[prev,'Previous'],[next,'Next']]){button.type='button';button.setAttribute('aria-label',dir+' '+title.toLowerCase());button.setAttribute('aria-controls',id);actions.append(button);}
 records.forEach(record=>{const item=el('li');item.append(render(record));list.append(item);});header.append(heading,actions);section.append(header,list);
 let disposed=false;
 const update=()=>{if(disposed)return;prev.disabled=list.scrollLeft<2;next.disabled=list.scrollLeft+list.clientWidth>=list.scrollWidth-2;};
 const page=()=>{const step=list.firstElementChild.getBoundingClientRect().width+parseFloat(getComputedStyle(list).gap);return Math.max(1,Math.floor((list.clientWidth-48)/step))*step;};
 prev.addEventListener('click',()=>list.scrollBy({left:-page()}));next.addEventListener('click',()=>list.scrollBy({left:page()}));list.addEventListener('scroll',update,{passive:true});
 const observer=new ResizeObserver(update);observer.observe(list);const frame=requestAnimationFrame(update);cleanup.push(()=>{disposed=true;observer.disconnect();cancelAnimationFrame(frame);list.removeEventListener('scroll',update);});return section;
}
 return {rail,destroy(){cleanup.forEach(fn=>fn());cleanup=[];}};
}
