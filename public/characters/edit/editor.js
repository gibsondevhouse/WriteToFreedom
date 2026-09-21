import { templateSections, fieldNames, idPattern, nameFields, fullName, storyRoles, alignments } from '../template.js';
import { characters as seeds } from '../data.js';
const id=new URLSearchParams(location.search).get('id');
const form=document.querySelector('#character-form'),fields=document.querySelector('#editor-fields'),host=document.querySelector('#template-fields'),contents=document.querySelector('#editor-contents');
const status=document.querySelector('#save-status'),save=document.querySelector('#save-character'),error=document.querySelector('#editor-error'),retry=document.querySelector('#retry-load'),view=document.querySelector('#view-profile');
let documentVersion,cast=[],factions=[],dirty=false,saving=false,relationshipHost;
let factionSelect,factionPanel,factionName,factionFeedback,createFactionButton,cancelFactionButton,previousFaction='',legacyAffiliation='',creatingFaction=false,factionRequestId;
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function showError(message){error.textContent=message;error.hidden=false;}
async function request(url,options={}){const response=await fetch(url,{credentials:'same-origin',...options});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload this page to sign in again.');const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save your character. Please try again.');return data;}
for(const section of templateSections){
 const wrap=node('section',undefined,'template-section');wrap.id=section.id;wrap.append(node('h2',section.title));
 const li=node('li'),link=node('a',section.title);link.href='#'+section.id;li.append(link);contents.append(li);
 const grid=node('div',undefined,'field-grid');
 for(const [key,label,type] of section.fields){
  const field=node('div',undefined,'editor-field'+(nameFields.includes(key)?' name-part':''));
  const caption=node('label',label);caption.htmlFor='field-'+key;field.append(caption);
  const input=node(type==='textarea'?'textarea':['select','faction'].includes(type)?'select':'input');input.name=key;input.id='field-'+key;
  if(type==='input'||type==='textarea'){input.maxLength=nameFields.includes(key)?160:10000;if(type==='input'){input.type='text';input.autocomplete='off';}}
  if(type==='select'){const placeholder=node('option',key==='alignment'?'Select alignment':'Select story role');placeholder.value='';input.append(placeholder);(key==='alignment'?alignments:storyRoles).forEach(value=>{const option=node('option',value);option.value=value;input.append(option);});}
  field.append(input);
  if(nameFields.includes(key))field.append(node('small','Hyphens and spaces are welcome.','field-hint'));
  if(['tendencies','questions'].includes(key))field.append(node('small','Write one item per line.','field-hint'));
  if(type==='faction')buildFactionControl(field,input);
  grid.append(field);
 }
 wrap.append(grid);
 if(section.id==='relationships'){
  wrap.append(node('p','Connect this character to someone in your cast.','relationship-help'));relationshipHost=node('div');wrap.append(relationshipHost);const add=node('button','+ Add relationship');add.type='button';add.addEventListener('click',()=>{addRelationship();markDirty();relationshipHost.lastElementChild.querySelector('select').focus();});wrap.append(add);
 }
 host.append(wrap);
}

function populateFactions(selected=''){
 factionSelect.replaceChildren();const empty=node('option','No faction selected');empty.value='';factionSelect.append(empty);
 [...factions].sort((a,b)=>a.name.localeCompare(b.name)).forEach(faction=>{const option=node('option',faction.name);option.value=faction.id;factionSelect.append(option);});
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
 input.addEventListener('change',()=>{if(input.value==='__create__'){input.value=previousFaction;factionPanel.hidden=false;factionFeedback.textContent='';factionName.focus();}else{previousFaction=input.value;factionPanel.hidden=true;}});
 factionName.addEventListener('input',()=>{factionName.setCustomValidity('');factionRequestId=undefined;});
 factionName.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();createFactionButton.click();}});
 cancelFactionButton.addEventListener('click',()=>{factionPanel.hidden=true;factionName.value='';factionName.setCustomValidity('');factionSelect.focus();});
 createFactionButton.addEventListener('click',async()=>{
  if(creatingFaction)return;const name=factionName.value.trim();if(!name){factionName.setCustomValidity('Enter a faction name.');factionName.reportValidity();return;}
  factionName.setCustomValidity('');creatingFaction=true;createFactionButton.disabled=true;cancelFactionButton.disabled=true;save.disabled=true;factionName.disabled=true;factionSelect.disabled=true;factionFeedback.textContent='Creating faction…';factionRequestId??=crypto.randomUUID();
  try{const created=await request('/api/factions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:factionRequestId,name})});if(!factions.some(f=>f.id===created.id))factions.push(created);populateFactions(created.id);factionPanel.hidden=true;factionName.value='';factionRequestId=undefined;markDirty();factionFeedback.textContent='Faction ready. Save character to keep this affiliation.';factionSelect.focus();}
  catch(e){factionFeedback.textContent=e.message;}
  finally{creatingFaction=false;createFactionButton.disabled=false;cancelFactionButton.disabled=false;save.disabled=false;factionName.disabled=false;factionSelect.disabled=false;if(factionPanel.hidden)factionSelect.focus();else factionName.focus();}
 });
}

function addRelationship(value={targetId:'',type:'',description:''}){
 const row=node('div',undefined,'relationship-row');
 const target=node('select');target.dataset.key='targetId';target.required=true;const placeholder=node('option','Choose a character');placeholder.value='';target.append(placeholder);
 cast.filter(c=>c.id!==id).forEach(c=>{const option=node('option',c.name?.trim()||'Untitled character');option.value=c.id;target.append(option);});target.value=value.targetId;
 const type=node('input');type.type='text';type.dataset.key='type';type.maxLength=160;type.value=value.type;
 const description=node('textarea');description.dataset.key='description';description.maxLength=10000;description.value=value.description;
 for(const [label,input] of [['Character',target],['Connection',type],['Relationship dynamic',description]]){const field=node('label',undefined,'editor-field');field.append(node('span',label),input);row.append(field);}
 const remove=node('button','Remove relationship','remove-relationship');remove.type='button';remove.addEventListener('click',()=>{row.remove();markDirty();document.querySelector('#relationships>button').focus();});row.append(remove);relationshipHost.append(row);
}
function updateTitle(){const name=fullName(Object.fromEntries(nameFields.map(key=>[key,form.elements.namedItem(key).value])));document.querySelector('#editor-title').textContent=name||'New character';document.title=(name||'New character')+' — Write to Freedom';}
function markDirty(){dirty=true;status.textContent='Unsaved changes';updateTitle();}
form.addEventListener('input',markDirty);form.addEventListener('change',markDirty);
async function load(){
 retry.hidden=true;error.hidden=true;status.textContent='Loading character…';fields.disabled=true;save.disabled=true;
 if(!id||!idPattern.test(id)){showError('Choose New character from the character list to start a blank profile.');status.textContent='No character selected';return;}
 try{
  const [character,list,factionList]=await Promise.all([request('/api/characters/'+id),request('/api/characters'),request('/api/factions')]);cast=[...seeds,...list.characters];factions=factionList.factions;documentVersion=character.version;legacyAffiliation=character.affiliation||'';populateFactions(character.factionId||'');
  fieldNames.filter(key=>key!=='factionId').forEach(key=>{const control=form.elements.namedItem(key);const value=character[key]||'';if(control.tagName==='SELECT'&&value&&![...control.options].some(o=>o.value===value)){const option=node('option',value+' (existing)');option.value=value;control.append(option);}control.value=value;});relationshipHost.replaceChildren();character.relationships.forEach(addRelationship);
  fields.disabled=false;save.disabled=false;dirty=false;view.href='/characters/'+id+'/';view.hidden=false;status.textContent='Saved';updateTitle();if(!character.name)form.elements.namedItem('firstName').focus();
 }catch(e){showError(e.message);status.textContent='Unable to load character';retry.hidden=false;}
}
retry.addEventListener('click',load);
form.addEventListener('submit',async event=>{
 event.preventDefault();if(saving||creatingFaction||!form.reportValidity())return;saving=true;save.disabled=true;error.hidden=true;status.textContent='Saving…';
 const payload=Object.fromEntries(fieldNames.map(key=>[key,form.elements.namedItem(key).value]));payload.version=documentVersion;payload.affiliation=factionSelect.value==='__legacy__'?legacyAffiliation:'';if(factionSelect.value==='__legacy__')payload.factionId='';
 payload.relationships=[...relationshipHost.children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-key]')].map(input=>[input.dataset.key,input.value])));
 fields.disabled=true;
 try{const updated=await request('/api/characters/'+id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});documentVersion=updated.version;dirty=false;status.textContent='Saved';updateTitle();}
 catch(e){showError(e.message);status.textContent='Not saved — your changes are still here';}
 finally{saving=false;save.disabled=false;fields.disabled=false;}
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='s'){event.preventDefault();if(!save.disabled)form.requestSubmit();}});
load();
