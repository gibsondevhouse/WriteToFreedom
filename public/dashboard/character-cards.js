import {alignments} from '../characters/template.js?v=character-cards-1';
import {createConnectionsMap} from './connections-map.js';
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
 const moral=button(moralityIcons[record.alignment]||'?', 'morality-action',()=>openCharacter(record,'morality'));moral.title=record.alignment||'Moral alignment not set';moral.setAttribute('aria-label',`${record.name}: ${moral.title}. Choose moral alignment`);
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
function openCharacter(record,view){
 if(activeDialog)return;
 const opener=document.activeElement,dialog=el('dialog','character-detail-overlay '+view+'-overlay');activeDialog=dialog;dialog.setAttribute('aria-labelledby','character-detail-title');
 const labels={attributes:'Attributes',relationships:'Connections map',mentions:'Notes mentioning',morality:'Moral alignment'};
 const header=el('header','character-detail-header'),heading=el('div');heading.append(el('p','character-detail-eyebrow',labels[view]));
 const title=el('h2','',record.name);title.id='character-detail-title';heading.append(title);
 const close=button('×','character-detail-close',attemptClose);close.setAttribute('aria-label','Close '+labels[view].toLowerCase());header.append(heading,close);
 const panel=el('div','character-detail-panel'),notice=el('p','character-detail-notice');notice.setAttribute('role','status');
 const discard=el('div','character-discard');discard.hidden=true;discard.append(el('span','','Discard unsaved changes?'),button('Keep editing','',()=>{discard.hidden=true;close.focus();}),button('Discard changes','',()=>dialog.close()));
 const footer=el('footer','character-detail-footer');
 if(view!=='morality'){const profile=el('a','detail-profile-link','Open full profile ↗');profile.href=record.href;footer.append(profile);}
 const save=button(view==='morality'?'Save alignment':'Save attributes','attribute-save',saveChanges);save.hidden=!['attributes','morality'].includes(view);save.disabled=true;footer.append(notice,save);
 let documentData,draft={},alignment='',dirty=false,saving=false;
 function attemptClose(){if(saving)return;if(dirty){discard.hidden=false;discard.querySelector('button').focus();}else dialog.close();}
 function markDirty(){dirty=true;notice.textContent='Unsaved changes';save.disabled=false;}
 async function load(){
  panel.replaceChildren(el('p','detail-empty','Loading…'));save.disabled=true;
  try{
   if(view==='relationships'){
    const catalog=await request('/api/dashboard');if(!dialog.open)return;
    panel.replaceChildren(createConnectionsMap(catalog.characters,record.id));return;
   }
   documentData=await request('/api/characters/'+encodeURIComponent(record.id));if(!dialog.open)return;
   draft={...(documentData.attributeRatings||{})};alignment=documentData.alignment||'';
   panel.replaceChildren(view==='morality'?buildMorality():buildAttributes());
  }catch(error){if(!dialog.open)return;panel.replaceChildren(el('p','detail-empty',error.message),button('Try again','detail-retry',load));}
 }
 function buildMorality(){
  const choices=el('fieldset','morality-options'),legend=el('legend','shell-sr-only','Choose moral alignment');choices.append(legend);
  for(const choice of ['',...alignments]){
   const label=el('label','morality-option'),radio=el('input');radio.type='radio';radio.name='alignment';radio.value=choice;radio.checked=choice===alignment;
   const mark=el('span','morality-symbol',moralityIcons[choice]||'—');mark.setAttribute('aria-hidden','true');label.append(radio,mark,el('span','',choice||'Not set'));
   radio.addEventListener('change',()=>{alignment=choice;markDirty();});choices.append(label);
  }
  return choices;
 }
 function buildAttributes(){
  const layout=el('div','attribute-stack');
  const groups=el('div','attribute-groups');
  for(const group of attributeGroups){
   const section=el('section','attribute-group '+group.id);section.append(el('h3','',group.title));const grid=el('div','attribute-ring-grid');
   for(const [key,name]of group.fields){
    const row=el('div','attribute-dial'),label=el('label','attribute-label',name),number=el('input','attribute-number'),ring=el('div','attribute-ring');
    number.id='rating-'+key;number.type='number';number.min='0';number.max='99';number.step='1';number.placeholder='—';number.value=draft[key]??'';number.setAttribute('aria-label',name+' rating');label.htmlFor=number.id;
    const slider=el('input','attribute-adjust');slider.type='range';slider.min='0';slider.max='99';slider.step='1';slider.value=draft[key]??0;slider.setAttribute('aria-label','Adjust '+name.toLowerCase());
    function paint(){const value=draft[key];ring.style.setProperty('--rating',(value??0)/99*100+'%');row.dataset.unset=String(value===undefined);slider.setAttribute('aria-valuetext',value===undefined?'Not rated':value+' out of 99');}
    slider.addEventListener('input',()=>{draft[key]=Number(slider.value);number.value=slider.value;paint();markDirty();});
    number.addEventListener('input',()=>{if(number.value===''){delete draft[key];slider.value='0';}else if(number.validity.valid){draft[key]=Number(number.value);slider.value=number.value;}paint();markDirty();});
    ring.append(number);paint();row.append(ring,label,slider);grid.append(row);
   }
   section.append(grid);groups.append(section);
  }
  layout.append(groups);
  const artwork=el('details','attribute-artwork');artwork.append(el('summary','','Card portrait'));
  const label=el('label','','Portrait image URL'),url=el('input');url.id='attribute-portrait-url';url.type='url';url.value=documentData.portraitUrl||'';url.placeholder='https://…';url.maxLength=2048;url.pattern='https://.*';label.htmlFor=url.id;url.addEventListener('input',markDirty);artwork.append(label,url);layout.append(artwork);
  return layout;
 }
 async function saveChanges(){
  if(!documentData||saving)return;
  for(const input of panel.querySelectorAll('input'))if(!input.reportValidity())return;
  const updates=view==='morality'?{alignment}:{attributeRatings:draft,portraitUrl:panel.querySelector('#attribute-portrait-url').value.trim()};
  saving=true;save.disabled=true;close.disabled=true;panel.querySelectorAll('input,button').forEach(n=>n.disabled=true);notice.textContent='Saving…';
  try{
   const updated=await request('/api/characters/'+encodeURIComponent(record.id),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({...documentData,...updates})});
   documentData=updated;dirty=false;record.attributeRatings={...updated.attributeRatings};record.image=updated.portraitUrl||'';record.alignment=updated.alignment||'';notice.textContent='Saved';
   document.dispatchEvent(new CustomEvent('character-card-updated',{detail:record}));
   if(view==='morality')dialog.close();
  }catch(error){notice.textContent=error.message;}
  finally{saving=false;save.disabled=!dirty;close.disabled=false;panel.querySelectorAll('input,button').forEach(n=>n.disabled=false);}
 }
 function renderMentions(){
  if(!record.mentions.length){panel.append(el('p','detail-empty','No notes mentioning this character yet.'));return;}
  const list=el('ul','character-mention-list');
  for(const note of record.mentions){
   const item=el('li'),link=el('a','mention-entry');link.href=note.href;link.title=note.source+' · '+note.label+' — '+note.text;
   link.append(el('strong','mention-source',note.source+' · '+note.label),el('span','mention-excerpt',note.text.replace(/\s+/g,' ').trim()),el('span','mention-arrow','↗'));item.append(link);list.append(item);
  }
  panel.append(list);
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();attemptClose();});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)attemptClose();}});
 dialog.addEventListener('close',()=>{dialog.remove();activeDialog=null;document.body.classList.remove('character-overlay-open');if(opener?.isConnected)opener.focus();else{const card=[...document.querySelectorAll('#rail-characters > li')].find(item=>item.querySelector('.character-profile-link')?.getAttribute('href')===record.href);card?.querySelector({attributes:'.character-more',morality:'.morality-action',relationships:'.relationships-action',mentions:'.mentions-action'}[view])?.focus();}});
 const preventUnload=event=>{if(dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',preventUnload);dialog.addEventListener('close',()=>window.removeEventListener('beforeunload',preventUnload),{once:true});
 dialog.append(header,discard,panel,footer);document.body.append(dialog);document.body.classList.add('character-overlay-open');dialog.showModal();if(view==='mentions')renderMentions();else load();close.focus();
}
