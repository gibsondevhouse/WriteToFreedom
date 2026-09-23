import {createAttributeControls} from '../../characters/attribute-controls.js?v=section-attributes-1';
import {alignments} from '../../characters/template.js?v=character-cards-1';
import {createConnectionsMap} from './connections-map.js';

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function button(text,cls,action){const n=el('button',cls,text);n.type='button';n.addEventListener('click',action);return n;}
import {moralityIcons} from '../../characters/attributes.js?v=section-attributes-1';
async function request(url,options={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load the character. Try again.');return data;
}
let activeDialog;
export function openCharacter(record,view,onUpdate){
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
    const catalog=await request('/api/characters?view=cards');if(!dialog.open)return;
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
  const groups=createAttributeControls(draft,markDirty);
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
   onUpdate?.(record);
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
 dialog.addEventListener('close',()=>{dialog.remove();activeDialog=null;document.body.classList.remove('character-overlay-open');if(opener?.isConnected)opener.focus();else{const card=[...document.querySelectorAll('.story-character-card')].find(item=>item.querySelector('.character-profile-link')?.getAttribute('href')===record.href);card?.querySelector({attributes:'.character-more',morality:'.morality-action',relationships:'.relationships-action',mentions:'.mentions-action'}[view])?.focus();}});
 const preventUnload=event=>{if(dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',preventUnload);dialog.addEventListener('close',()=>window.removeEventListener('beforeunload',preventUnload),{once:true});
 dialog.append(header,discard,panel,footer);document.body.append(dialog);document.body.classList.add('character-overlay-open');dialog.showModal();if(view==='mentions')renderMentions();else load();close.focus();
}
