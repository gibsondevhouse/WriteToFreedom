import {ancestors,selectLocations,typeLabels} from './data.js';
const list=document.querySelector('#location-list'),search=document.querySelector('#location-search'),sort=document.querySelector('#sort-order'),direction=document.querySelector('#sort-direction'),clear=document.querySelector('#clear-search'),count=document.querySelector('#result-count'),empty=document.querySelector('#empty-state'),error=document.querySelector('#storage-error');
const dialog=document.querySelector('#new-location-dialog'),form=document.querySelector('#new-location-form'),fields=document.querySelector('#location-fields'),type=document.querySelector('#location-type'),name=document.querySelector('#location-name'),parent=document.querySelector('#location-parent'),parentField=document.querySelector('#parent-field'),parentHint=document.querySelector('#parent-hint'),createError=document.querySelector('#create-error'),save=document.querySelector('#save-location'),cancel=document.querySelector('#cancel-location');
const newButton=document.querySelector('#new-location'),retry=document.querySelector('#retry-load');
let records=[],filter='',reversed=false,loading=true,saving=false,pendingId;
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
async function api(options={}){const response=await fetch('/api/locations',{credentials:'same-origin',...options});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load locations.');return data;}
function plural(n,singular,plural){return `${n} ${n===1?singular:plural}`;}
function render(){
 const matches=selectLocations(records,search.value,filter,sort.value,reversed);
 list.replaceChildren(...matches.map((location,index)=>{
  const row=node('li','location-row');row.id='location-'+location.id;
  const avatar=node('span','avatar '+location.type,location.name.replace(/^The /,'').split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase());avatar.setAttribute('aria-hidden','true');
  const info=node('div','location-info'),heading=node('h2','',`${index+1}. ${location.name}`);heading.tabIndex=-1;
  info.append(node('span','location-type',typeLabels[location.type]),heading);
  const path=node('p','location-path'),parents=ancestors(location,records);
  parents.forEach((p,i)=>{if(i)path.append(node('span','','›'));path.append(document.createTextNode(p.name));});if(parents.length)info.append(path);
  if(location.type!=='landmark'){
   const descendants=records.filter(r=>ancestors(r,records).some(a=>a.id===location.id)),cities=descendants.filter(r=>r.type==='city').length,landmarks=descendants.filter(r=>r.type==='landmark').length;
   info.append(node('p','location-children',location.type==='country'?plural(cities,'city','cities')+' · '+plural(landmarks,'landmark','landmarks'):plural(landmarks,'landmark','landmarks')));
  }
  row.append(avatar,info);return row;
 }));
 count.textContent=search.value.trim()||filter?`${matches.length} of ${records.length} locations`:records.length?`1–${records.length} of ${records.length} locations`:'0 locations';clear.hidden=!search.value;empty.hidden=matches.length>0;list.hidden=!matches.length;
 document.querySelectorAll('[data-type]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.type===filter)));
}
async function load(){loading=true;newButton.disabled=true;retry.hidden=true;error.hidden=true;count.textContent='Loading locations…';try{records=(await api()).locations;render();newButton.disabled=false;}catch(e){error.textContent=e.message;error.hidden=false;count.textContent='Unable to load locations';retry.hidden=false;}finally{loading=false;}}
function populateParent(){
 const expected=type.value==='landmark'?'city':'country';parentField.hidden=type.value==='country';parent.required=!parentField.hidden;parent.disabled=parentField.hidden;
 document.querySelector('#parent-label').textContent=typeLabels[expected];parent.replaceChildren(new Option(`Choose a ${expected}`,''));
 const options=records.filter(r=>r.type===expected).sort((a,b)=>a.name.localeCompare(b.name));options.forEach(r=>{const path=ancestors(r,records).map(p=>p.name).join(' › ');parent.append(new Option(r.name+(path?' — '+path:''),r.id));});
 parentHint.textContent=options.length?(type.value==='landmark'?'The country is inherited from the selected city.':'Every city belongs to one country.'):`Add a ${expected} first, then return to add this ${type.value}.`;
}
retry.addEventListener('click',load);
newButton.addEventListener('click',()=>{if(loading)return;form.reset();pendingId=undefined;createError.hidden=true;type.value=filter||'country';populateParent();dialog.showModal();name.focus();});
type.addEventListener('change',populateParent);form.addEventListener('input',()=>{name.setCustomValidity('');pendingId=undefined;});
cancel.addEventListener('click',()=>dialog.close());dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
form.addEventListener('submit',async event=>{event.preventDefault();if(saving)return;if(!name.value.trim()){name.setCustomValidity('Enter a location name.');name.reportValidity();return;}if(!form.reportValidity())return;
 pendingId??=crypto.randomUUID();const payload={id:pendingId,name:name.value,type:type.value,parentId:type.value==='country'?null:parent.value};saving=true;fields.disabled=true;save.disabled=true;cancel.disabled=true;save.textContent='Adding…';createError.hidden=true;
 try{const created=await api({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!records.some(r=>r.id===created.id))records.push(created);filter='';search.value='';render();dialog.close();count.textContent=created.name+' added. '+records.length+' locations.';document.getElementById('location-'+created.id)?.querySelector('h2').focus();}
 catch(e){createError.textContent=e.message;createError.hidden=false;}
 finally{saving=false;fields.disabled=false;parent.disabled=type.value==='country';save.disabled=false;cancel.disabled=false;save.textContent='Add location';}
});
search.addEventListener('input',render);sort.addEventListener('change',render);direction.addEventListener('click',()=>{reversed=!reversed;direction.setAttribute('aria-pressed',String(reversed));direction.setAttribute('aria-label',reversed?'Restore forward list order':'Reverse list order');render();});
document.querySelectorAll('[data-type]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.type;render();}));
function reset(){search.value='';filter='';render();search.focus();}clear.addEventListener('click',()=>{search.value='';render();search.focus();});document.querySelector('#reset-search').addEventListener('click',reset);window.addEventListener('pageshow',event=>{if(event.persisted)load();});load();
