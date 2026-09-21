import { fieldNames, nameFields, fullName } from './template.js?v=profile-controls-2';
const initial=JSON.parse(document.querySelector('#profile-data').textContent);
const id=initial.character.id,form=document.querySelector('#profile-form'),fields=document.querySelector('#editor-fields');
const status=document.querySelector('#save-status'),save=document.querySelector('#save-character'),error=document.querySelector('#editor-error');
let documentVersion=initial.character.version,cast=initial.cast,factions=initial.factions,dirty=false,saving=false;
const relationshipHost=document.querySelector('#relationship-fields');
let factionSelect,factionPanel,factionName,factionFeedback,createFactionButton,cancelFactionButton,previousFaction='',legacyAffiliation=initial.character.affiliation||'',creatingFaction=false,factionRequestId;
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function showError(message){error.textContent=message;error.hidden=false;}
async function request(url,options={}){const response=await fetch(url,{credentials:'same-origin',...options});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Keep a copy of your changes before reloading to sign in again.');const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save your character. Please try again.');return data;}
function resize(input){if(input.tagName==='TEXTAREA'&&input.getClientRects().length){input.style.height='auto';input.style.height=input.scrollHeight+2+'px';}}
function populateFactions(selected=''){
 factionSelect.replaceChildren();const empty=node('option','No faction selected');empty.value='';factionSelect.append(empty);
 [...factions].sort((a,b)=>a.name.localeCompare(b.name)).forEach(faction=>{const option=node('option',faction.name||'Untitled faction');option.value=faction.id;factionSelect.append(option);});
 if(!selected&&legacyAffiliation){const match=factions.find(f=>f.name===legacyAffiliation);if(match)selected=match.id;else{const legacy=node('option',legacyAffiliation+' (existing affiliation)');legacy.value='__legacy__';factionSelect.append(legacy);selected='__legacy__';}}
 const create=node('option','+ Create a faction…');create.value='__create__';factionSelect.append(create);
 factionSelect.value=selected;previousFaction=selected;
}
function buildFactionControl(field,input){
 factionSelect=input;factionPanel=node('div',undefined,'faction-create-panel');factionPanel.hidden=true;
 const label=node('label','Faction name');label.htmlFor='new-faction-name';factionName=node('input');factionName.type='text';factionName.id='new-faction-name';factionName.maxLength=160;factionName.autocomplete='off';
 createFactionButton=node('button','Create faction');createFactionButton.type='button';cancelFactionButton=node('button','Cancel');cancelFactionButton.type='button';
 const actions=node('div',undefined,'faction-actions');actions.append(createFactionButton,cancelFactionButton);
 factionFeedback=node('p',undefined,'field-hint');factionFeedback.setAttribute('role','status');
 factionPanel.append(label,factionName,actions);field.append(factionPanel,factionFeedback);
 const profileLink=node('a','Open faction →','faction-profile-link');field.append(profileLink);function updateFactionLink(){profileLink.hidden=!input.value||input.value.startsWith('__');profileLink.href='/factions/'+input.value+'/';}input.addEventListener('change',updateFactionLink);queueMicrotask(updateFactionLink);
 input.addEventListener('change',()=>{if(input.value==='__create__'){input.value=previousFaction;factionPanel.hidden=false;factionFeedback.textContent='';factionName.focus();}else{previousFaction=input.value;factionPanel.hidden=true;}updateFactionLink();});
 factionName.addEventListener('input',()=>{factionName.setCustomValidity('');factionRequestId=undefined;});
 factionName.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();createFactionButton.click();}});
 cancelFactionButton.addEventListener('click',()=>{factionPanel.hidden=true;factionName.value='';factionName.setCustomValidity('');factionSelect.focus();});
 createFactionButton.addEventListener('click',async()=>{
  if(creatingFaction)return;const name=factionName.value.trim();if(!name){factionName.setCustomValidity('Enter a faction name.');factionName.reportValidity();return;}
  factionName.setCustomValidity('');creatingFaction=true;createFactionButton.disabled=true;cancelFactionButton.disabled=true;save.disabled=true;factionName.disabled=true;factionSelect.disabled=true;factionFeedback.textContent='Creating faction…';factionRequestId??=crypto.randomUUID();
  try{const created=await request('/api/factions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:factionRequestId,name})});if(!factions.some(f=>f.id===created.id))factions.push(created);populateFactions(created.id);updateFactionLink();factionPanel.hidden=true;factionName.value='';factionRequestId=undefined;markDirty();factionFeedback.textContent='Faction ready. Save character to keep this affiliation.';factionSelect.focus();}
  catch(e){factionFeedback.textContent=e.message;}
  finally{creatingFaction=false;createFactionButton.disabled=false;cancelFactionButton.disabled=false;save.disabled=false;factionName.disabled=false;factionSelect.disabled=false;if(factionPanel.hidden)factionSelect.focus();else factionName.focus();}
 });
}

function addRelationship(value={targetId:'',type:'',description:''}){
 const row=node('div',undefined,'relationship-row');
 const target=node('select');target.dataset.key='targetId';target.required=true;const placeholder=node('option','Choose a character');placeholder.value='';target.append(placeholder);
 cast.filter(c=>c.id!==id).forEach(c=>{const option=node('option',c.name?.trim()||'Untitled character');option.value=c.id;target.append(option);});target.value=value.targetId;
 const type=node('input');type.type='text';type.dataset.key='type';type.maxLength=160;type.value=value.type;type.placeholder='e.g. Friend, sibling, rival';
 for(const [label,input] of [['Character',target],['Connection',type]]){const field=node('label',undefined,'editor-field');field.append(node('span',label),input);row.append(field);}
 const actions=node('div',undefined,'relationship-actions');
 const remove=node('button','×','remove-relationship');remove.type='button';remove.title='Remove relationship';remove.setAttribute('aria-label','Remove relationship');remove.addEventListener('click',()=>{row.remove();markDirty();document.querySelector('#add-relationship').focus();});
 const link=node('a','↗','relationship-profile-link');link.title='Open character profile';link.setAttribute('aria-label','Open related character profile');function updateLink(){link.hidden=!target.value;link.href='/characters/'+target.value+'/';}target.addEventListener('change',updateLink);updateLink();actions.append(link,remove);row.append(actions);
 const notes=node('details',undefined,'relationship-notes'),summary=node('summary'),caption=node('span',undefined,'relationship-preview');summary.append(node('span','Notes'),caption);notes.append(summary);
 const description=node('textarea');description.dataset.key='description';description.rows=2;description.maxLength=10000;description.value=value.description;description.setAttribute('aria-label','Relationship dynamic');description.placeholder='Describe their relationship…';
 function preview(){caption.textContent=description.value.trim()||'Add relationship details';}preview();description.addEventListener('input',preview);notes.append(description);notes.addEventListener('toggle',()=>{if(notes.open)resize(description);});row.append(notes);relationshipHost.append(row);
}
const pendingChoiceEditors=[],choiceValues=new Map();
function buildChoiceControl(control){
 const value=control.querySelector('input[type="hidden"]'),select=control.querySelector('[data-choice-select]'),list=control.querySelector('.choice-values');
 const custom=control.querySelector('.choice-custom'),input=control.querySelector('[data-choice-custom-input]'),multiple=control.dataset.multiple==='true';
 const key=control.dataset.choiceField;let current=initial.character[key]||'';choiceValues.set(key,current);
 let chosen=multiple?current.split(/\s*·\s*/).filter(Boolean):[];
 function storeChoice(text){current=text;choiceValues.set(key,text);value.value=text;}
 function paint(){
  if(!multiple){
   if(current&&![...select.options].some(option=>option.value===current)){const option=node('option',current);option.value=current;select.insertBefore(option,select.lastElementChild);}
   select.value=current;return;
  }
  list.replaceChildren();
  chosen.forEach((item,index)=>{const chip=node('span',undefined,'choice-chip'),label=node('span',item),remove=node('button','×');remove.type='button';remove.setAttribute('aria-label','Remove '+item);remove.addEventListener('click',()=>{chosen.splice(index,1);storeChoice(chosen.join(' · '));paint();markDirty();select.focus();});chip.append(label,remove);list.append(chip);});
  for(const option of select.options)option.disabled=chosen.includes(option.value);
  select.value='';
 }
 function choose(text){
  const next=multiple?[...chosen.filter(item=>item!==text),text].join(' · '):text;
  if(next.length>10000){input.setCustomValidity('Keep this field under 10,000 characters.');revealAncestors(input);input.reportValidity();return false;}
  if(multiple)chosen=chosen.includes(text)?chosen:[...chosen,text];
  storeChoice(multiple?chosen.join(' · '):text);paint();markDirty();return true;
 }
 function closeCustom(){custom.hidden=true;input.value='';input.setCustomValidity('');}
 function commitCustom(){const text=input.value.trim();if(!text)return true;if(!choose(text))return false;closeCustom();return true;}
 pendingChoiceEditors.push(commitCustom);
 select.addEventListener('change',()=>{
  if(select.value==='__custom__'){paint();custom.hidden=false;input.focus();return;}
  const selection=select.value;
  if(multiple&&!selection)return;
  choose(selection);closeCustom();
 });
 input.addEventListener('input',()=>input.setCustomValidity(''));
 input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();control.querySelector('[data-choice-add]').click();}if(event.key==='Escape'){event.preventDefault();closeCustom();select.focus();}});
 control.querySelector('[data-choice-add]').addEventListener('click',()=>{if(!input.value.trim()){input.setCustomValidity('Enter a value.');input.reportValidity();return;}if(commitCustom())select.focus();});
 control.querySelector('[data-choice-cancel]').addEventListener('click',()=>{closeCustom();select.focus();});
 paint();
}
function setExpanded(button,expanded){
 const region=document.getElementById(button.dataset.collapseTarget);
 button.setAttribute('aria-expanded',String(expanded));region.hidden=!expanded;
 const section=button.closest('.profile-section');
 if(section){const menu=section.querySelector('.field-menu');menu.hidden=!expanded;if(!expanded)menu.open=false;}
 if(expanded)region.querySelectorAll('textarea').forEach(resize);
}
function revealAncestors(target){
 let region=target.closest('.collapsible-region');
 while(region){const button=document.querySelector('[data-collapse-target="'+region.id+'"]');if(button)setExpanded(button,true);region=region.parentElement.closest('.collapsible-region');}
}
form.querySelectorAll('[data-collapse-target]').forEach(button=>button.addEventListener('click',()=>setExpanded(button,button.getAttribute('aria-expanded')!=='true')));
form.querySelectorAll('.choice-control').forEach(buildChoiceControl);
function revealHash(){
 let anchor;try{anchor=decodeURIComponent(location.hash.slice(1));}catch{return;}
 const target=document.getElementById(anchor);
 if(!target)return;
 const button=target.querySelector('[data-collapse-target]');if(button)setExpanded(button,true);revealAncestors(target);
}
window.addEventListener('hashchange',revealHash);revealHash();
function updateTitle(){const name=fullName(Object.fromEntries(nameFields.map(key=>[key,form.elements.namedItem(key).value])));document.querySelectorAll('[data-display-name]').forEach(n=>n.textContent=name||'Untitled character');document.title=(name||'Untitled character')+' — Write to Freedom';document.querySelector('#monogram').textContent=name.split(/\s+/).slice(0,2).map(n=>n[0]||'').join('').toUpperCase()||'?';}
function markDirty(){dirty=true;status.textContent='Unsaved changes';updateTitle();}
form.addEventListener('input',event=>{if(event.target===factionName)return;resize(event.target);markDirty();});
form.addEventListener('change',event=>{if(event.target===factionName)return;markDirty();});
buildFactionControl(document.querySelector('#field-factionId').parentElement,document.querySelector('#field-factionId'));
populateFactions(initial.character.factionId||'');
initial.character.relationships.forEach(addRelationship);
document.querySelector('#add-relationship').addEventListener('click',()=>{addRelationship();markDirty();relationshipHost.lastElementChild.querySelector('select').focus();});
document.querySelector('#edit-name').addEventListener('click',()=>{const firstName=document.querySelector('#field-firstName');revealAncestors(firstName);firstName.focus();});
document.querySelectorAll('textarea').forEach(resize);
window.addEventListener('resize',()=>document.querySelectorAll('textarea').forEach(resize));
form.addEventListener('submit',async event=>{
 event.preventDefault();if(saving||creatingFaction)return;if(!pendingChoiceEditors.every(commit=>commit())||!form.reportValidity())return;saving=true;save.disabled=true;error.hidden=true;status.textContent='Saving…';
 const payload=Object.fromEntries(fieldNames.map(key=>[key,choiceValues.has(key)?choiceValues.get(key):form.elements.namedItem(key).value]));payload.hiddenFields=[...form.querySelectorAll('[data-visibility]:not(:checked)')].map(input=>input.dataset.visibility);payload.version=documentVersion;payload.affiliation=factionSelect.value==='__legacy__'?legacyAffiliation:'';if(factionSelect.value==='__legacy__')payload.factionId='';
 payload.relationships=[...relationshipHost.children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-key]')].map(input=>[input.dataset.key,input.value])));
 fields.disabled=true;
 try{const updated=await request('/api/characters/'+id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});documentVersion=updated.version;dirty=false;status.textContent='Saved';updateTitle();}
 catch(e){showError(e.message);status.textContent='Not saved — your changes are still here';}
 finally{saving=false;save.disabled=false;fields.disabled=false;}
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='s'){event.preventDefault();if(!save.disabled)form.requestSubmit();}});

function applyVisibility(){
 form.querySelectorAll('[data-visibility]').forEach(input=>{const field=form.querySelector('[data-profile-field="'+input.dataset.visibility+'"]');field.hidden=!input.checked;if(input.checked)field.querySelectorAll('textarea').forEach(resize);});
}
form.querySelectorAll('[data-visibility]').forEach(input=>input.addEventListener('change',applyVisibility));
form.querySelectorAll('[data-visibility-all]').forEach(button=>button.addEventListener('click',()=>{button.closest('.field-menu').querySelectorAll('[data-visibility]').forEach(input=>input.checked=button.dataset.visibilityAll==='show');applyVisibility();markDirty();}));
form.addEventListener('invalid',event=>{revealAncestors(event.target);const field=event.target.closest('[data-profile-field]');if(field?.hidden){const toggle=form.querySelector('[data-visibility="'+field.dataset.profileField+'"]');if(toggle){toggle.checked=true;applyVisibility();markDirty();}}event.target.closest('.relationship-notes')?.setAttribute('open','');},true);
document.addEventListener('click',event=>{document.querySelectorAll('.field-menu[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.field-menu[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary').focus();});});
