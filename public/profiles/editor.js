import {locationHref} from '../locations/data.js';
import {initProfileControls,resize} from './controls.js?v=profile-reading-1';
import {announceWorkspaceChange} from './workspace-events.js?v=__WTF_ASSET_REVISION__';

// Entity adapters supply only their field names, endpoint, and image constraints.
/**
 * Page-lifetime save controller for faction, location and Lore profile adapters.
 * Assumes one shared profile form and all configured fields/preview hooks exist.
 * Holds dirty/saving/version state, commits choices, PUTs the allowlisted fields
 * and hiddenFields, and retains drafts on failure. Installs Ctrl/Cmd+S and an
 * unload warning; returns no teardown/controller. Character saving is separate.
 * @param {object} config fieldNames, endpoint, type, optional imageFields/validImageUrl, readExtra() and onSaved(data).
 * @returns {void}
 */
export function initProfileEditor({fieldNames,endpoint,type,imageFields=[],validImageUrl=()=>false,onSaved=()=>{},readExtra=()=>({})}){
 const form=document.querySelector('#profile-form'),fields=document.querySelector('#editor-fields'),save=document.querySelector('#save-character'),status=document.querySelector('#save-status'),error=document.querySelector('#editor-error');
 let version=Number(form.dataset.version),dirty=false,saving=false;
 function update(){
  const name=form.elements.namedItem('name').value.trim()||'Untitled '+type;
  document.querySelectorAll('[data-display-name]').forEach(n=>n.textContent=name);document.title=name+' — Write to Freedom';
  const official=document.querySelector('#official-heading');if(official)official.textContent=form.elements.namedItem('officialName').value.trim()||name;
  const monogram=document.querySelector('#monogram');if(monogram)monogram.textContent=name.replace(/^The /,'').split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
  document.querySelectorAll('.person-link').forEach(link=>{const value=form.elements.namedItem(link.dataset.for).value;link.hidden=!value;link.href='/characters/'+value+'/';});
 }
 function markDirty(){dirty=true;status.textContent='Unsaved changes';update();}
 const initial=JSON.parse(document.querySelector('#profile-data').textContent);
 const controls=initProfileControls(form,markDirty,{choiceSelections:initial.choiceSelections});
 form.addEventListener('input',event=>{resize(event.target);markDirty();});form.addEventListener('change',markDirty);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(saving||!controls.commitChoices()||!form.reportValidity())return;
  let extra;try{extra=readExtra();}catch(e){error.hidden=false;error.textContent=e.message;return;}
  const selections=controls.choiceSelections();
  const payload={...Object.fromEntries(fieldNames.map(key=>[key,controls.choiceValues.has(key)?controls.choiceValues.get(key):form.elements.namedItem(key).value])),...extra,...(Object.keys(selections).length?{choiceSelections:selections}:{}),hiddenFields:controls.hiddenFields(),schemaVersion:initial.schemaVersion??1,version};
  saving=true;fields.disabled=true;save.disabled=true;error.hidden=true;status.textContent='Saving…';
  try{
   const response=await fetch(endpoint+'/'+form.dataset.id,{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
   if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Copy your changes before reloading to sign in again.');
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save. Please try again.');
   version=data.version;dirty=false;form.elements.namedItem('name').value=data.name;update();
   const country=form.elements.namedItem('parentId');if(country)document.querySelectorAll('[data-country-link]').forEach(link=>{link.href=locationHref({type:'country',id:data.parentId});link.textContent=country.selectedOptions[0]?.textContent||'Country';});
   status.textContent='Saved';
   announceWorkspaceChange();
   onSaved(data);
  }catch(e){error.hidden=false;error.textContent=e.message;status.textContent='Not saved — your changes are still here';}
  finally{saving=false;fields.disabled=false;save.disabled=false;}
 });
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='s'){event.preventDefault();if(!saving)form.requestSubmit();}});
 function updateImages(){for(const key of imageFields){const img=form.querySelector('[data-image="'+key+'"]'),value=form.elements.namedItem(key).value.trim(),feedback=form.querySelector('[data-image-error="'+key+'"]');feedback.hidden=true;if(value&&validImageUrl(value)){if(img.getAttribute('src')!==value)img.src=value;img.hidden=false;}else{img.hidden=true;img.removeAttribute('src');}}}
 for(const key of imageFields){const img=form.querySelector('[data-image="'+key+'"]');const failed=()=>{img.hidden=true;form.querySelector('[data-image-error="'+key+'"]') .hidden=false;};img.addEventListener('error',failed);if(img.getAttribute('src')&&img.complete&&!img.naturalWidth)failed();}
 form.addEventListener('change',event=>{if(imageFields.includes(event.target.name))updateImages();});
}
