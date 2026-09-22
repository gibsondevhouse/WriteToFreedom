import {initCharacterNotes} from './note-editor.js?v=1';
import {attributeGroups} from './attributes.js?v=section-attributes-1';
import {createAttributeControls} from './attribute-controls.js?v=section-attributes-1';
import {initProfileControls,resize} from '../profiles/controls.js?v=worlds-1';
import { fieldNames, nameFields, fullName } from './template.js?v=character-cards-1';
const initial=JSON.parse(document.querySelector('#profile-data').textContent);
const id=initial.character.id,form=document.querySelector('#profile-form'),fields=document.querySelector('#editor-fields');
const status=document.querySelector('#save-status'),save=document.querySelector('#save-character'),error=document.querySelector('#editor-error');
let documentVersion=initial.character.version,cast=initial.cast,factions=initial.factions,dirty=false,saving=false;
const relationshipHost=document.querySelector('#relationship-fields');
const nationalityContinents={...(initial.character.nationalityContinents||{})};
const attributeRatings={...(initial.character.attributeRatings||{})};
let factionSelect,factionPanel,factionName,factionFeedback,createFactionButton,cancelFactionButton,previousFaction='',legacyAffiliation=initial.character.affiliation||'',creatingFaction=false,factionRequestId;
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function showError(message){error.textContent=message;error.hidden=false;}
async function request(url,options={}){const response=await fetch(url,{credentials:'same-origin',...options});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Keep a copy of your changes before reloading to sign in again.');const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save your character. Please try again.');return data;}
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
for(const sectionId of new Set(attributeGroups.map(group=>group.sectionId))){
 const groups=attributeGroups.filter(group=>group.sectionId===sectionId);
 document.querySelector('#'+sectionId+'-body').append(createAttributeControls(attributeRatings,markDirty,groups));
}
const controls=initProfileControls(form,markDirty,{nameField:'firstName',nationalityContinents}),choiceValues=controls.choiceValues;
const noteEditor=initCharacterNotes(form,initial.character.notes||[],markDirty,controls);
function updateTitle(){const name=fullName(Object.fromEntries(nameFields.map(key=>[key,form.elements.namedItem(key).value])));document.querySelectorAll('[data-display-name]').forEach(n=>n.textContent=name||'Untitled character');document.title=(name||'Untitled character')+' — Write to Freedom';document.querySelector('#monogram').textContent=name.split(/\s+/).slice(0,2).map(n=>n[0]||'').join('').toUpperCase()||'?';}
function markDirty(){dirty=true;status.textContent='Unsaved changes';updateTitle();}
form.addEventListener('input',event=>{if(event.target===factionName)return;resize(event.target);markDirty();});
form.addEventListener('change',event=>{if(event.target===factionName)return;markDirty();});
buildFactionControl(document.querySelector('#field-factionId').parentElement,document.querySelector('#field-factionId'));
populateFactions(initial.character.factionId||'');
initial.character.relationships.forEach(addRelationship);
document.querySelector('#add-relationship').addEventListener('click',()=>{addRelationship();markDirty();relationshipHost.lastElementChild.querySelector('select').focus();});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(saving||creatingFaction||!noteEditor.readyToSave())return;if(!controls.commitChoices()||!form.reportValidity())return;saving=true;save.disabled=true;error.hidden=true;status.textContent='Saving…';
 const payload=Object.fromEntries(fieldNames.map(key=>[key,choiceValues.has(key)?choiceValues.get(key):form.elements.namedItem(key).value]));payload.notes=noteEditor.notes;payload.nationalityContinents={...nationalityContinents};payload.attributeRatings={...attributeRatings};payload.hiddenFields=controls.hiddenFields();payload.version=documentVersion;payload.affiliation=factionSelect.value==='__legacy__'?legacyAffiliation:'';if(factionSelect.value==='__legacy__')payload.factionId='';
 payload.relationships=[...relationshipHost.children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-key]')].map(input=>[input.dataset.key,input.value])));
 fields.disabled=true;
 try{const updated=await request('/api/characters/'+id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});documentVersion=updated.version;dirty=false;status.textContent='Saved';updateTitle();}
 catch(e){showError(e.message);status.textContent='Not saved — your changes are still here';}
 finally{saving=false;save.disabled=false;fields.disabled=false;}
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='s'){event.preventDefault();if(!save.disabled)form.requestSubmit();}});
