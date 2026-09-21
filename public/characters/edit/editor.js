import { templateSections, fieldNames, idPattern } from '../template.js';
import { characters as seeds } from '../data.js';
const id=new URLSearchParams(location.search).get('id');
const form=document.querySelector('#character-form'),fields=document.querySelector('#editor-fields'),host=document.querySelector('#template-fields'),contents=document.querySelector('#editor-contents');
const status=document.querySelector('#save-status'),save=document.querySelector('#save-character'),error=document.querySelector('#editor-error'),retry=document.querySelector('#retry-load'),view=document.querySelector('#view-profile');
let documentVersion,cast=[],dirty=false,saving=false,relationshipHost;
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function showError(message){error.textContent=message;error.hidden=false;}
async function request(url,options={}){const response=await fetch(url,{credentials:'same-origin',...options});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload this page to sign in again.');const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save your character. Please try again.');return data;}
for(const section of templateSections){
 const wrap=node('section',undefined,'template-section');wrap.id=section.id;wrap.append(node('h2',section.title));
 const li=node('li'),link=node('a',section.title);link.href='#'+section.id;li.append(link);contents.append(li);
 const grid=node('div',undefined,'field-grid');
 for(const [key,label,type] of section.fields){const field=node('label',undefined,'editor-field');field.append(node('span',label));const input=node(type==='textarea'?'textarea':'input');input.name=key;input.id='field-'+key;input.maxLength=key==='name'?160:10000;if(type!=='textarea')input.type='text';field.append(input);if(['tendencies','questions'].includes(key))field.append(node('small','Write one item per line.','field-hint'));grid.append(field);}
 wrap.append(grid);
 if(section.id==='relationships'){
  wrap.append(node('p','Connect this character to someone in your cast.','relationship-help'));relationshipHost=node('div');wrap.append(relationshipHost);const add=node('button','+ Add relationship');add.type='button';add.addEventListener('click',()=>{addRelationship();markDirty();relationshipHost.lastElementChild.querySelector('select').focus();});wrap.append(add);
 }
 host.append(wrap);
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
function updateTitle(){const name=form.elements.namedItem('name').value.trim();document.querySelector('#editor-title').textContent=name||'New character';document.title=(name||'New character')+' — Write to Freedom';}
function markDirty(){dirty=true;status.textContent='Unsaved changes';updateTitle();}
form.addEventListener('input',markDirty);form.addEventListener('change',markDirty);
async function load(){
 retry.hidden=true;error.hidden=true;status.textContent='Loading character…';fields.disabled=true;save.disabled=true;
 if(!id||!idPattern.test(id)){showError('Choose New character from the character list to start a blank profile.');status.textContent='No character selected';return;}
 try{
  const [character,list]=await Promise.all([request('/api/characters/'+id),request('/api/characters')]);cast=[...seeds,...list.characters];documentVersion=character.version;
  fieldNames.forEach(key=>{form.elements.namedItem(key).value=character[key]||'';});relationshipHost.replaceChildren();character.relationships.forEach(addRelationship);
  fields.disabled=false;save.disabled=false;dirty=false;view.href='/characters/'+id+'/';view.hidden=false;status.textContent='Saved';updateTitle();if(!character.name)form.elements.namedItem('name').focus();
 }catch(e){showError(e.message);status.textContent='Unable to load character';retry.hidden=false;}
}
retry.addEventListener('click',load);
form.addEventListener('submit',async event=>{
 event.preventDefault();if(saving||!form.reportValidity())return;saving=true;save.disabled=true;error.hidden=true;status.textContent='Saving…';
 const payload=Object.fromEntries(fieldNames.map(key=>[key,form.elements.namedItem(key).value]));payload.version=documentVersion;
 payload.relationships=[...relationshipHost.children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-key]')].map(input=>[input.dataset.key,input.value])));
 fields.disabled=true;
 try{const updated=await request('/api/characters/'+id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});documentVersion=updated.version;dirty=false;status.textContent='Saved';updateTitle();}
 catch(e){showError(e.message);status.textContent='Not saved — your changes are still here';}
 finally{saving=false;save.disabled=false;fields.disabled=false;}
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='s'){event.preventDefault();if(!save.disabled)form.requestSubmit();}});
load();
