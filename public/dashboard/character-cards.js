import {attributeGroups,moralityIcons} from '../characters/attributes.js';

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function button(text,cls,action){const n=el('button',cls,text);n.type='button';n.addEventListener('click',action);return n;}
function initials(name){return name.replace(/^The /,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';}
function picture(record,cls){
 const frame=el('span',cls),mark=el('span','character-initials',initials(record.name));mark.setAttribute('aria-hidden','true');frame.append(mark);
 if(record.image){try{const url=new URL(record.image);if(url.protocol==='https:'&&!url.username&&!url.password){const img=el('img');img.src=url.href;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});frame.append(img);}}catch{}}
 return frame;
}
function icon(type){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',type==='notes'?'M4 4h16v12H9l-5 4V4Zm4 4h8M8 12h5':'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5M2 20v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 5v2');svg.append(path);return svg;
}
export function createCharacterCard(record,tone){
 const card=el('article','card story-character-card '+tone),profile=el('a','character-profile-link');profile.href=record.href;profile.setAttribute('aria-label','Open '+record.name+' profile');
 const art=picture(record,'character-card-art'),copy=el('div','character-card-copy');
 copy.append(el('p','character-role',record.roles.join(' · ')||record.storyRole||'Character'),el('h3','',record.name));
 if(record.title||record.summary)copy.append(el('p','character-summary',record.summary||record.title));
 profile.append(art,copy);
 const affiliation=record.affiliationCard,owner=el(affiliation.href?'a':'div','character-affiliation');if(affiliation.href)owner.href=affiliation.href;
 const ownerText=el('span','affiliation-copy');ownerText.append(el('span','affiliation-kind',affiliation.label),el('strong','',affiliation.name));owner.append(picture(affiliation,'affiliation-avatar'),ownerText);
 const actions=el('div','character-actions');
 const moral=button(moralityIcons[record.alignment]||'?', 'morality-action',()=>openCharacter(record,'attributes'));moral.title=record.alignment||'Moral alignment not set';moral.setAttribute('aria-label',`${record.name}: ${moral.title}. Open attributes`);
 const relations=button('', 'relationships-action',()=>openCharacter(record,'relationships'));relations.title='Relationships';relations.setAttribute('aria-label',`${record.relationships.length} relationships for ${record.name}`);
 const faces=el('span','relationship-faces');for(const person of record.relationships.slice(0,3))faces.append(picture(person,'relationship-avatar'));
 relations.append(record.relationships.length?faces:icon('relationships'),el('span','',String(record.relationships.length)));
 const notes=button('', 'mentions-action',()=>openCharacter(record,'mentions'));notes.title='Notes mentioning '+record.name;notes.setAttribute('aria-label',`${record.mentions.length} notes mentioning ${record.name}`);notes.append(icon('notes'),el('span','',String(record.mentions.length)));
 const more=button('More ›','character-more',()=>openCharacter(record,'attributes'));more.setAttribute('aria-label','More about '+record.name);more.setAttribute('aria-haspopup','dialog');
 actions.append(moral,relations,notes,more);card.append(profile,owner,actions);return card;
}

async function request(url,options={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load the character. Try again.');return data;
}
let activeDialog;
function openCharacter(record,initialTab){
 if(activeDialog)return;
 const opener=document.activeElement,dialog=el('dialog','character-detail-overlay');activeDialog=dialog;dialog.setAttribute('aria-labelledby','character-detail-title');
 const header=el('header','character-detail-header'),heading=el('div');heading.append(el('p','character-detail-eyebrow','Character details'));
 const title=el('h2','',record.name);title.id='character-detail-title';heading.append(title);
 const close=button('×','character-detail-close',()=>attemptClose());close.setAttribute('aria-label','Close character details');header.append(heading,close);
 const tabs=el('div','character-detail-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Character details');
 const panel=el('div','character-detail-panel');panel.setAttribute('role','tabpanel');panel.id='character-detail-panel';
 const notice=el('p','character-detail-notice');notice.setAttribute('role','status');
 const discard=el('div','character-discard');discard.hidden=true;discard.append(el('span','','Discard unsaved attribute changes?'),button('Keep editing','',()=>{discard.hidden=true;close.focus();}),button('Discard changes','',()=>dialog.close()));
 const footer=el('footer','character-detail-footer'),profile=el('a','detail-profile-link','Open full profile ↗');profile.href=record.href;
 const save=button('Save attributes','attribute-save',()=>saveAttributes());save.hidden=true;footer.append(profile,notice,save);
 const panels={},tabButtons={};let currentTab,loaded=false,loading=false,loadError='',documentData,draft={},dirty=false,saving=false,loadGeneration=0;
 function attemptClose(){if(saving)return;if(dirty){discard.hidden=true;discard.hidden=false;discard.querySelector('button').focus();}else dialog.close();}
 function status(text){notice.textContent=text;}
 function markDirty(){dirty=true;status('Unsaved changes');save.disabled=false;}
 function selectTab(key){
  currentTab=key;panel.replaceChildren();
  for(const [id,tab]of Object.entries(tabButtons)){tab.setAttribute('aria-selected',String(id===key));tab.tabIndex=id===key?0:-1;}
  panel.setAttribute('aria-labelledby','character-tab-'+key);
  save.hidden=key!=='attributes';save.disabled=!loaded||saving||!dirty;
  if(key==='attributes'){
   if(loaded){panel.append(panels.attributes);return;}
   const text=el('p','detail-empty',loadError||'Loading attributes…');panel.append(text);
   if(loadError)panel.append(button('Try again','detail-retry',()=>{loadError='';loadAttributes();}));
   else loadAttributes();
  }else if(key==='relationships')renderRelationships();else renderMentions();
 }
 const tabEntries=[['attributes','Attributes'],['relationships',`Relationships · ${record.relationships.length}`],['mentions',`Notes · ${record.mentions.length}`]];
 for(const [key,label]of tabEntries){const tab=button(label,'',()=>selectTab(key));tab.id='character-tab-'+key;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panel.id);tabButtons[key]=tab;tabs.append(tab);}
 tabs.addEventListener('keydown',event=>{
  const keys=tabEntries.map(([key])=>key),index=keys.indexOf(currentTab);let next;
  if(event.key==='ArrowRight')next=(index+1)%keys.length;if(event.key==='ArrowLeft')next=(index+keys.length-1)%keys.length;if(event.key==='Home')next=0;if(event.key==='End')next=keys.length-1;
  if(next!==undefined){event.preventDefault();selectTab(keys[next]);tabButtons[keys[next]].focus();}
 });
 async function loadAttributes(){
  if(loading)return;loading=true;const generation=++loadGeneration;
  try{
   const data=await request('/api/characters/'+encodeURIComponent(record.id));if(!dialog.open||generation!==loadGeneration)return;
   documentData=data;draft={...(data.attributeRatings||{})};loaded=true;panels.attributes=buildAttributes(data);if(currentTab==='attributes')selectTab('attributes');
  }catch(error){loadError=error.message;if(dialog.open&&currentTab==='attributes')selectTab('attributes');}
  finally{loading=false;}
 }
 function buildAttributes(data){
  const layout=el('div','attribute-layout'),identity=el('aside','attribute-identity');identity.append(picture({...record,image:data.portraitUrl},'attribute-portrait'),el('p','attribute-identity-name',data.name||'Untitled character'),el('p','attribute-identity-role',data.roles||data.storyRole||'Character'));
  const morality=el('p','attribute-alignment',(moralityIcons[data.alignment]||'?')+' '+(data.alignment||'Alignment not set'));identity.append(morality);
  const artwork=el('details','attribute-artwork'),summary=el('summary','','Card portrait');artwork.append(summary);
  const label=el('label','','Portrait image URL'),url=el('input');url.type='url';url.value=data.portraitUrl||'';url.placeholder='https://…';url.maxLength=2048;url.pattern='https://.*';url.id='attribute-portrait-url';label.htmlFor=url.id;artwork.append(label,url,el('p','','House and alliance images come from the linked faction profile; country images use its flag.'));url.addEventListener('input',markDirty);identity.append(artwork);
  const body=el('div','attribute-body');body.append(el('h3','','Attribute builder'),el('p','attribute-help','Rate each attribute from 0–99. Leave unknown attributes blank.'));
  const groups=el('div','attribute-groups');
  for(const group of attributeGroups){
   const section=el('section','attribute-group '+group.id);section.append(el('h4','',group.title));
   for(const [key,name]of group.fields){
    const row=el('div','attribute-row'),label=el('label','attribute-label',name),number=el('input','attribute-number'),slider=el('input','attribute-slider');
    number.id='rating-'+key;number.type='number';number.min='0';number.max='99';number.step='1';number.placeholder='—';number.value=draft[key]??'';number.setAttribute('aria-label',name+' rating');label.htmlFor=number.id;
    slider.type='range';slider.min='0';slider.max='99';slider.step='1';slider.value=draft[key]??0;slider.setAttribute('aria-label','Adjust '+name.toLowerCase());
    const reset=button('↺','attribute-reset',()=>{delete draft[key];number.value='';slider.value='0';paint();markDirty();});reset.title='Clear '+name.toLowerCase();reset.setAttribute('aria-label',reset.title);
    function paint(){const value=draft[key];row.dataset.unset=String(value===undefined);slider.style.setProperty('--rating',(value??0)/99*100+'%');slider.setAttribute('aria-valuetext',value===undefined?'Not rated':String(value)+' out of 99');}
    slider.addEventListener('input',()=>{draft[key]=Number(slider.value);number.value=slider.value;paint();markDirty();});
    number.addEventListener('input',()=>{if(number.value===''){delete draft[key];slider.value='0';}else if(number.validity.valid){draft[key]=Number(number.value);slider.value=number.value;}paint();markDirty();});
    paint();row.append(label,number,slider,reset);section.append(row);
   }
   groups.append(section);
  }
  body.append(groups);if(data.strength||data.flaw){const prose=el('div','attribute-prose');if(data.strength)prose.append(el('h4','','Strengths'),el('p','',data.strength));if(data.flaw)prose.append(el('h4','','Flaws'),el('p','',data.flaw));body.append(prose);}
  layout.append(identity,body);return layout;
 }
 async function saveAttributes(){
  if(!loaded||saving)return;
  for(const input of panels.attributes.querySelectorAll('input'))if(!input.reportValidity())return;
  saving=true;save.disabled=true;close.disabled=true;tabs.querySelectorAll('button').forEach(b=>b.disabled=true);panels.attributes.querySelectorAll('input,button').forEach(n=>n.disabled=true);status('Saving…');
  try{
   const updated=await request('/api/characters/'+encodeURIComponent(record.id),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({...documentData,attributeRatings:draft,portraitUrl:panels.attributes.querySelector('#attribute-portrait-url').value.trim()})});
   documentData=updated;dirty=false;record.attributeRatings={...updated.attributeRatings};record.image=updated.portraitUrl||'';status('Saved');
   document.dispatchEvent(new CustomEvent('character-card-updated',{detail:record}));
  }catch(error){status(error.message);}
  finally{saving=false;save.disabled=!dirty;close.disabled=false;tabs.querySelectorAll('button').forEach(b=>b.disabled=false);panels.attributes.querySelectorAll('input,button').forEach(n=>n.disabled=false);}
 }
 function renderRelationships(){
  if(!record.relationships.length){panel.append(el('p','detail-empty','No relationships recorded yet. Add connections on the character’s profile.'));return;}
  const list=el('ul','character-relationship-list');
  for(const person of record.relationships){const item=el('li'),link=el('a','relationship-person');link.href=person.href;link.append(picture(person,'relationship-detail-avatar'),el('strong','',person.name));item.append(link);
   for(const connection of person.connections){const direction=connection.direction==='incoming'?person.name+' → '+record.name:record.name+' → '+person.name;item.append(el('p','connection-type',connection.type),el('p','connection-direction',direction));if(connection.description)item.append(el('p','connection-notes',connection.description));}list.append(item);
  }panel.append(list);
 }
 function renderMentions(){
  panel.append(el('p','attribute-help','Mentions in existing profile text and relationship notes.'));
  if(!record.mentions.length){panel.append(el('p','detail-empty','No notes mentioning this character yet.'));return;}
  const list=el('ul','character-mention-list');for(const note of record.mentions){const item=el('li'),link=el('a','mention-source',note.source+' · '+note.label);link.href=note.href;item.append(link,el('p','',note.text));list.append(item);}panel.append(list);
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();attemptClose();});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)attemptClose();}});
 dialog.addEventListener('close',()=>{loadGeneration++;dialog.remove();activeDialog=null;document.body.classList.remove('character-overlay-open');if(opener?.isConnected)opener.focus();else [...document.querySelectorAll('#rail-characters .character-more')].find(button=>button.getAttribute('aria-label')==='More about '+record.name)?.focus();});
 const preventUnload=event=>{if(dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',preventUnload);dialog.addEventListener('close',()=>window.removeEventListener('beforeunload',preventUnload),{once:true});
 dialog.append(header,tabs,discard,panel,footer);document.body.append(dialog);document.body.classList.add('character-overlay-open');dialog.showModal();selectTab(initialTab);close.focus();
}
