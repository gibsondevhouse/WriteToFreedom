import {ancestors,selectLocations,typeLabels,typePlurals,locationTypes,parentTypes,requiresParent,parentChoices} from './data.js?v=worlds-1';
const list=document.querySelector('#location-list'),search=document.querySelector('#location-search'),sort=document.querySelector('#sort-order'),direction=document.querySelector('#sort-direction'),clear=document.querySelector('#clear-search'),count=document.querySelector('#result-count'),empty=document.querySelector('#empty-state'),error=document.querySelector('#storage-error');
const dialog=document.querySelector('#new-location-dialog'),form=document.querySelector('#new-location-form'),fields=document.querySelector('#location-fields'),type=document.querySelector('#location-type'),name=document.querySelector('#location-name'),parent=document.querySelector('#location-parent'),parentField=document.querySelector('#parent-field'),parentHint=document.querySelector('#parent-hint'),createError=document.querySelector('#create-error'),save=document.querySelector('#save-location'),cancel=document.querySelector('#cancel-location');
const newButton=document.querySelector('#new-location'),retry=document.querySelector('#retry-load'),areaType=document.querySelector('#area-type'),areaTypeField=document.querySelector('#area-type-field');
const requestedType=new URLSearchParams(location.search).get('type');
let records=[],filter=locationTypes.includes(requestedType)?requestedType:'',reversed=false,loading=true,saving=false,pendingId,editing=null;
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
async function api(options={}){const response=await fetch('/api/locations',{credentials:'same-origin',...options});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load locations.');return data;}
const filters=document.querySelector('.type-filters');
for(const kind of locationTypes){const button=node('button','',typePlurals[kind]);button.type='button';button.dataset.type=kind;button.setAttribute('aria-pressed','false');filters.append(button);type.append(new Option(typeLabels[kind],kind));}
function href(place){return ['country','city'].includes(place.type)?'/locations/'+(place.type==='country'?'countries':'cities')+'/'+place.id+'/':'#location-'+place.id;}
function render(){
 const matches=selectLocations(records,search.value,filter,sort.value,reversed);
 list.replaceChildren(...matches.map((location,index)=>{
  const row=node('li','location-row');row.id='location-'+location.id;
  const avatar=node('span','avatar '+location.type,location.name.replace(/^The /,'').split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase());avatar.setAttribute('aria-hidden','true');
  const info=node('div','location-info'),heading=node('h2','',`${index+1}. ${location.name}`);heading.tabIndex=-1;
  if(['country','city'].includes(location.type)){heading.textContent='';const link=node('a','',`${index+1}. ${location.name}`);link.href=href(location);heading.append(link);}
  info.append(node('span','location-type',typeLabels[location.type]+(location.areaType?' · '+location.areaType:'')),heading);
  const path=node('p','location-path'),parents=ancestors(location,records);
  parents.forEach((p,i)=>{if(i)path.append(node('span','','›'));const link=node('a','',p.name);link.href=href(p);path.append(link);});if(parents.length)info.append(path);
  if(location.type!=='landmark'){
   const children=records.filter(r=>r.parentId===location.id);
   const summary=locationTypes.map(kind=>{const n=children.filter(r=>r.type===kind).length;return n?`${n} ${n===1?typeLabels[kind].toLowerCase():typePlurals[kind].toLowerCase()}`:'';}).filter(Boolean).join(' · ');
   info.append(node('p','location-children',summary||'No locations within it yet'));

  }
  row.append(avatar,info);
  if(!['country','city'].includes(location.type)){const edit=node('button','edit-location','Edit');edit.type='button';edit.setAttribute('aria-label','Edit '+location.name);edit.addEventListener('click',()=>openEditor(location));row.append(edit);}
  return row;
 }));
 count.textContent=search.value.trim()||filter?`${matches.length} of ${records.length} locations`:records.length?`1–${records.length} of ${records.length} locations`:'0 locations';clear.hidden=!search.value;empty.hidden=matches.length>0;list.hidden=!matches.length;
 document.querySelectorAll('[data-type]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.type===filter)));
}
function revealHash(){if(!location.hash.startsWith('#location-'))return;filter='';search.value='';render();const target=document.getElementById(location.hash.slice(1));target?.scrollIntoView({block:'center'});target?.querySelector('h2')?.focus({preventScroll:true});}
async function load(){loading=true;newButton.disabled=true;retry.hidden=true;error.hidden=true;count.textContent='Loading locations…';try{records=(await api()).locations;render();newButton.disabled=false;revealHash();}catch(e){error.textContent=e.message;error.hidden=false;count.textContent='Unable to load locations';retry.hidden=false;}finally{loading=false;}}
function populateParent(selected=''){
 const allowed=parentTypes[type.value]||[],required=requiresParent(type.value);
 parentField.hidden=!allowed.length;parent.required=required;parent.disabled=parentField.hidden;
 areaTypeField.hidden=type.value!=='area';areaType.disabled=areaTypeField.hidden;areaType.required=!areaTypeField.hidden;
 document.querySelector('#parent-label').textContent=type.value==='city'?'Country':'Belongs to';
 parent.replaceChildren(new Option(required?'Choose a parent location':'No parent location',''));
 const options=parentChoices(type.value,records,editing?.id).sort((a,b)=>a.name.localeCompare(b.name));
 options.forEach(r=>{const path=ancestors(r,records).map(p=>p.name).join(' › ');parent.append(new Option(r.name+(path?' — '+path:''),r.id));});parent.value=selected;
 const kinds=allowed.map(kind=>typeLabels[kind].toLowerCase()).join(' or ');
 parentHint.textContent=required?(options.length?'Choose a '+kinds+'.':'Add a '+kinds+' first.'):'Optionally place it within a '+kinds+'.';

}
async function openEditor(record=null){
 if(loading||saving)return;
 loading=true;newButton.disabled=true;error.hidden=true;
 try{records=(await api()).locations;if(record){record=records.find(r=>r.id===record.id);if(!record)throw new Error('This location is no longer available.');}render();}
 catch(e){error.textContent=e.message;error.hidden=false;return;}
 finally{loading=false;newButton.disabled=false;}
editing=record?{...record}:null;form.reset();name.setCustomValidity('');pendingId=undefined;createError.hidden=true;type.disabled=!!editing;
 type.value=record?.type||filter||'country';name.value=record?.name||'';areaType.value=record?.areaType||'Neighborhood';populateParent(record?.parentId||'');
 document.querySelector('#dialog-title').textContent=record?'Edit '+typeLabels[record.type].toLowerCase():'New location';save.textContent=record?'Save changes':'Add location';dialog.showModal();name.focus();
}
retry.addEventListener('click',load);newButton.addEventListener('click',()=>openEditor());
type.addEventListener('change',()=>populateParent());form.addEventListener('input',()=>{name.setCustomValidity('');pendingId=undefined;});
cancel.addEventListener('click',()=>dialog.close());dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
form.addEventListener('submit',async event=>{event.preventDefault();if(saving)return;if(!name.value.trim()){name.setCustomValidity('Enter a location name.');name.reportValidity();return;}if(!form.reportValidity())return;
 pendingId??=crypto.randomUUID();const payload={id:editing?.id||pendingId,name:name.value,type:type.value,parentId:parent.disabled?null:(parent.value||null),...(type.value==='area'?{areaType:areaType.value}:{}),...(editing?{version:editing.version}:{})};saving=true;fields.disabled=true;save.disabled=true;cancel.disabled=true;save.textContent='Saving…';createError.hidden=true;
 try{
  const saved=await api({method:editing?'PUT':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  if(['country','city'].includes(saved.type)){location.assign(href(saved));return;}
  const index=records.findIndex(r=>r.id===saved.id);if(index<0)records.push(saved);else records[index]=saved;
  filter='';search.value='';render();dialog.close();count.textContent=saved.name+(editing?' updated. ':' added. ')+records.length+' locations.';document.getElementById('location-'+saved.id)?.querySelector('h2').focus();
 }catch(e){createError.textContent=e.message;createError.hidden=false;}
 finally{saving=false;fields.disabled=false;type.disabled=!!editing;parent.disabled=!(parentTypes[type.value]||[]).length;areaType.disabled=type.value!=='area';save.disabled=false;cancel.disabled=false;save.textContent=editing?'Save changes':'Add location';}
});
search.addEventListener('input',render);sort.addEventListener('change',render);direction.addEventListener('click',()=>{reversed=!reversed;direction.setAttribute('aria-pressed',String(reversed));direction.setAttribute('aria-label',reversed?'Restore forward list order':'Reverse list order');render();});
document.querySelectorAll('[data-type]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.type;render();}));
clear.addEventListener('click',()=>{search.value='';render();search.focus();});document.querySelector('#reset-search').addEventListener('click',()=>{search.value='';filter='';render();search.focus();});
list.addEventListener('click',event=>{const link=event.target.closest('a[href^="#location-"]');if(link){event.preventDefault();history.replaceState(null,'',link.getAttribute('href'));revealHash();}});
window.addEventListener('hashchange',revealHash);window.addEventListener('pageshow',event=>{if(event.persisted)load();});load();
