import {locationTypes,typeLabels,parentChoices,parentTypes,requiresParent,areaTypes} from '../locations/data.js?v=worlds-1';
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function createNoteItemButton(initial,connections,addNote){
 const launch=node('button','＋ Create new item','note-action create-note-item');launch.type='button';
 const dialog=node('dialog',undefined,'note-composer note-item-composer');dialog.setAttribute('aria-labelledby','note-item-title');
 const form=node('form'),heading=node('h2','Create new item');heading.id='note-item-title';
 const fields=node('fieldset'),type=node('select'),name=node('input'),parent=node('select'),area=node('select'),text=node('textarea');
 type.id='note-item-type';name.id='note-item-name';parent.id='note-item-parent';area.id='note-item-area';text.id='note-item-text';
 name.required=true;name.maxLength=160;name.autocomplete='off';text.maxLength=2000;text.rows=3;
 const field=(caption,input)=>{const wrap=node('div',undefined,'note-item-field'),label=node('label',caption);label.htmlFor=input.id;wrap.append(label,input);return wrap;};
 for(const [value,label] of [['character','Character'],['faction','Faction'],['note','Note'],['lore','Lore entry']])type.append(new Option(label,value));
 const places=node('optgroup');places.label='Places';for(const value of locationTypes)places.append(new Option(typeLabels[value],value));type.append(places);
 for(const value of areaTypes)area.append(new Option(value,value));
 const parentField=field('Belongs to',parent),areaField=field('Area type',area),textField=field('Note',text);
 fields.append(field('Item type',type),field('Name / title',name),parentField,areaField,textField);
 const hint=node('p','','note-context'),error=node('p','','note-input-error');error.setAttribute('role','alert');error.hidden=true;
 const actions=node('div',undefined,'note-composer-actions'),back=node('button','Cancel','note-action'),save=node('button','Create and insert','note-submit');back.type='button';save.type='submit';actions.append(back,save);
 form.append(heading,fields,hint,error,actions);dialog.append(form);document.body.append(dialog);
 let saving=false,requestId=null;
 function configure(){const kind=type.value,isNote=['note','lore'].includes(kind),isPlace=locationTypes.includes(kind);
  textField.hidden=!isNote;text.disabled=!isNote;text.required=isNote;name.maxLength=isNote?120:160;
  areaField.hidden=kind!=='area';area.disabled=areaField.hidden;
  parentField.hidden=!isPlace||!parentTypes[kind]?.length;parent.disabled=parentField.hidden;parent.required=isPlace&&requiresParent(kind);
  parent.replaceChildren(new Option(parent.required?'Choose a parent location…':'No parent location',''));
  if(isPlace)for(const place of parentChoices(kind,initial.locations||[]).sort((a,b)=>a.name.localeCompare(b.name)))parent.append(new Option(place.name,place.id));
  hint.textContent=isNote?'This entry saves with your profile changes.':'Creates an item in your world and inserts its link here.';
  if(parent.required&&parent.options.length===1)hint.textContent='Create a '+parentTypes[kind].map(t=>typeLabels[t].toLowerCase()).join(' or ')+' first, then add this location.';
 }
 launch.addEventListener('click',()=>{form.reset();requestId=null;error.hidden=true;name.setCustomValidity('');text.setCustomValidity('');configure();dialog.showModal();name.focus();});
 type.addEventListener('change',()=>{requestId=null;configure();});
 name.addEventListener('input',()=>name.setCustomValidity(''));text.addEventListener('input',()=>text.setCustomValidity(''));
 back.addEventListener('click',()=>dialog.close());dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
 async function api(path,payload){const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Keep this note open and try again after signing in.');const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not create this item. Your note is still here.');return result;}
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(saving)return;const label=name.value.trim();if(!label){name.setCustomValidity('Enter a name or title.');name.reportValidity();return;}
  const kind=type.value,isNote=['note','lore'].includes(kind);if(isNote&&!text.value.trim()){text.setCustomValidity('Enter the note or lore detail.');text.reportValidity();return;}
  if(!form.reportValidity())return;error.hidden=true;
  try{connections.checkInsert(label);}catch(e){error.textContent=e.message;error.hidden=false;return;}
  saving=true;fields.disabled=true;back.disabled=true;save.disabled=true;save.textContent='Creating…';requestId??=crypto.randomUUID();
  let target;
  try{
   if(isNote){target=addNote({id:requestId,title:label,text:text.value.trim(),type:kind==='lore'?'lore':'detail'});}
   else if(kind==='character'){const created=await api('/api/characters',{id:requestId,name:label});target={kind:'character',id:created.id,label:created.name,group:'Characters',href:'/characters/'+created.id+'/'};if(!initial.cast.some(c=>c.id===created.id))initial.cast.push({id:created.id,name:created.name});}
   else if(kind==='faction'){const created=await api('/api/factions',{id:requestId,name:label});target={kind:'faction',id:created.id,label:created.name,group:'Factions',href:'/factions/'+created.id+'/'};if(!initial.factions.some(f=>f.id===created.id))initial.factions.push(created);}
   else {const created=await api('/api/locations',{id:requestId,name:label,type:kind,parentId:parent.disabled?null:parent.value||null,...(kind==='area'?{areaType:area.value}:{})});initial.locations||=[];if(!initial.locations.some(l=>l.id===created.id))initial.locations.push(created);target={kind:'location',id:created.id,label:created.name,group:'Places',detail:typeLabels[created.type],href:['country','city'].includes(created.type)?'/locations/'+(created.type==='country'?'countries':'cities')+'/'+created.id+'/':'/locations/#location-'+created.id};}
  }catch(e){error.textContent=e.message;error.hidden=false;}
  finally{saving=false;fields.disabled=false;back.disabled=false;save.disabled=false;save.textContent='Create and insert';}
  if(target){dialog.close();connections.insertCreated(target);}
 });
 return launch;
}
