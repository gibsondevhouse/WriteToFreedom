import {initDirectoryShell,fetchDirectory} from '../directory/shell.js?v=1';
import {locationHref,ancestors,selectLocations,typeLabels,typePlurals,locationTypes,parentTypes,requiresParent,parentChoices} from './data.js?v=location-profiles-1';
const root=document.querySelector('[data-directory-shell]'),search=root.querySelector('[data-directory-search]');
const dialog=document.querySelector('#new-location-dialog'),form=document.querySelector('#new-location-form'),fields=document.querySelector('#location-fields'),type=document.querySelector('#location-type'),name=document.querySelector('#location-name'),parent=document.querySelector('#location-parent'),parentField=document.querySelector('#parent-field'),parentHint=document.querySelector('#parent-hint'),createError=document.querySelector('#create-error'),save=document.querySelector('#save-location'),cancel=document.querySelector('#cancel-location');
const newButton=document.querySelector('#new-location'),areaType=document.querySelector('#area-type'),areaTypeField=document.querySelector('#area-type-field');
const requestedType=new URLSearchParams(location.search).get('type');
let filter=locationTypes.includes(requestedType)?requestedType:'',loading=true,catalogReady=false,opening=false,saving=false,pendingId,editing=null;
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
async function api(options={}){const response=await fetch('/api/locations',{credentials:'same-origin',...options});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load locations.');return data;}
const filters=document.querySelector('.type-filters');
for(const kind of locationTypes){const button=node('button','',typePlurals[kind]);button.type='button';button.dataset.type=kind;filters.append(button);type.append(new Option(typeLabels[kind],kind));}
function syncFilters(){filters.querySelectorAll('[data-type]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.type===filter)));}
syncFilters();
const href=locationHref;
const directory=initDirectoryShell({
 root,
 async load(options){
  loading=true;newButton.disabled=true;
  try{return (await fetchDirectory('/api/locations',options)).locations;}
  finally{loading=false;newButton.disabled=!catalogReady||opening;}
 },
 select:(records,{query,sort,reversed})=>selectLocations(records,query,filter,sort,reversed),
 isFiltered:()=>Boolean(filter),
 onReset(){filter='';syncFilters();},
 onData(){catalogReady=true;newButton.disabled=opening;revealHash();},
 renderItem(location,state,index){
  const records=directory.records,row=node('article','location-row');row.id='location-'+location.id;
  const avatar=node('span','avatar '+location.type,location.name.replace(/^The /,'').split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase());avatar.setAttribute('aria-hidden','true');
  const info=node('div','location-info'),heading=node('h2','',`${index+1}. ${location.name}`);heading.tabIndex=-1;
  {heading.textContent='';const link=node('a','',`${index+1}. ${location.name}`);link.href=href(location);heading.append(link);}
  info.append(node('span','location-type',typeLabels[location.type]+(location.areaType?' · '+location.areaType:'')),heading);
  const path=node('p','location-path'),parents=ancestors(location,records);
  parents.forEach((p,i)=>{if(i)path.append(node('span','','›'));const link=node('a','',p.name);link.href=href(p);path.append(link);});if(parents.length)info.append(path);
  if(location.type!=='landmark'){
   const children=records.filter(r=>r.parentId===location.id);
   const summary=locationTypes.map(kind=>{const n=children.filter(r=>r.type===kind).length;return n?`${n} ${n===1?typeLabels[kind].toLowerCase():typePlurals[kind].toLowerCase()}`:'';}).filter(Boolean).join(' · ');
   info.append(node('p','location-children',summary||'No locations within it yet'));

  }
  if(location.linkedNotes?.length){const details=node('details','location-linked-notes'),summary=node('summary','',location.linkedNotes.length+' linked '+(location.linkedNotes.length===1?'note':'notes')),notes=node('ul');
   for(const note of location.linkedNotes){const li=node('li'),link=node('a','',note.title||note.text);link.href=note.href;link.title=note.text;li.append(link,node('small','',note.source));notes.append(li);}details.append(summary,notes);info.append(details);}
  row.append(avatar,info);
  {const edit=node('a','edit-location','Edit');edit.href=href(location);edit.setAttribute('aria-label','Edit '+location.name);row.append(edit);}
  return row;
 }
});
function revealHash(){
 if(!location.hash.startsWith('#location-'))return;
 filter='';search.value='';syncFilters();directory.render();
 const target=document.getElementById(location.hash.slice(1));target?.scrollIntoView({block:'center'});target?.querySelector('h2')?.focus({preventScroll:true});
}
function populateParent(selected=''){
 const allowed=parentTypes[type.value]||[],required=requiresParent(type.value);
 parentField.hidden=!allowed.length;parent.required=required;parent.disabled=parentField.hidden;
 areaTypeField.hidden=type.value!=='area';areaType.disabled=areaTypeField.hidden;areaType.required=!areaTypeField.hidden;
 document.querySelector('#parent-label').textContent=type.value==='city'?'Country':'Belongs to';
 parent.replaceChildren(new Option(required?'Choose a parent location':'No parent location',''));
 const options=parentChoices(type.value,directory.records,editing?.id).sort((a,b)=>a.name.localeCompare(b.name));
 options.forEach(r=>{const path=ancestors(r,directory.records).map(p=>p.name).join(' › ');parent.append(new Option(r.name+(path?' — '+path:''),r.id));});parent.value=selected;
 const kinds=allowed.map(kind=>typeLabels[kind].toLowerCase()).join(' or ');
 parentHint.textContent=required?(options.length?'Choose a '+kinds+'.':'Add a '+kinds+' first.'):'Optionally place it within a '+kinds+'.';

}
async function openEditor(record=null){
 if(loading||saving||opening)return;
 opening=true;newButton.disabled=true;directory.clearError();
 try{
  if(!await directory.refresh())return;
  if(record){record=directory.records.find(r=>r.id===record.id);if(!record)throw new Error('This location is no longer available.');}
  editing=record?{...record}:null;form.reset();name.setCustomValidity('');pendingId=undefined;createError.hidden=true;type.disabled=!!editing;
  type.value=record?.type||filter||'country';name.value=record?.name||'';areaType.value=record?.areaType||'Neighborhood';populateParent(record?.parentId||'');
  document.querySelector('#dialog-title').textContent=record?'Edit '+typeLabels[record.type].toLowerCase():'New location';save.textContent=record?'Save changes':'Add location';dialog.showModal();name.focus();
 }catch(error){directory.showError(error);}
 finally{opening=false;newButton.disabled=!catalogReady;}
}
newButton.addEventListener('click',()=>openEditor());
type.addEventListener('change',()=>populateParent());form.addEventListener('input',()=>{name.setCustomValidity('');pendingId=undefined;});
cancel.addEventListener('click',()=>dialog.close());dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
form.addEventListener('submit',async event=>{event.preventDefault();if(saving)return;if(!name.value.trim()){name.setCustomValidity('Enter a location name.');name.reportValidity();return;}if(!form.reportValidity())return;
 pendingId??=crypto.randomUUID();const payload={id:editing?.id||pendingId,name:name.value,type:type.value,parentId:parent.disabled?null:(parent.value||null),...(type.value==='area'?{areaType:areaType.value}:{}),...(editing?{version:editing.version}:{})};saving=true;fields.disabled=true;save.disabled=true;cancel.disabled=true;save.textContent='Saving…';createError.hidden=true;
 try{
  const saved=await api({method:editing?'PUT':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  location.assign(href(saved));return;
 }catch(e){createError.textContent=e.message;createError.hidden=false;}
 finally{saving=false;fields.disabled=false;type.disabled=!!editing;parent.disabled=!(parentTypes[type.value]||[]).length;areaType.disabled=type.value!=='area';save.disabled=false;cancel.disabled=false;save.textContent=editing?'Save changes':'Add location';}
});

filters.querySelectorAll('[data-type]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.type;syncFilters();directory.render();}));
root.querySelector('[data-directory-list]').addEventListener('click',event=>{const link=event.target.closest('a[href^="#location-"]');if(link){event.preventDefault();history.replaceState(null,'',link.getAttribute('href'));revealHash();}});
window.addEventListener('hashchange',revealHash);
window.addEventListener('pageshow',event=>{if(event.persisted){dialog.close();pendingId=undefined;opening=false;newButton.disabled=!catalogReady;}});
