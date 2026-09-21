import {initProfileViewport} from './viewport.js?v=profile-reading-1';
import {initDatePicker} from './date-picker.js?v=profile-reading-1';
export function resize(input){if(input.tagName==='TEXTAREA'&&input.getClientRects().length){input.style.height='auto';input.style.height=input.scrollHeight+2+'px';}}
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}

export function initProfileControls(form,markDirty,{nameField="name"}={}){
initDatePicker(form);
const pendingChoiceEditors=[],choiceValues=new Map();
function buildChoiceControl(control){
 const value=control.querySelector('input[type="hidden"]'),select=control.querySelector('[data-choice-select]'),list=control.querySelector('.choice-values');
 const custom=control.querySelector('.choice-custom'),input=control.querySelector('[data-choice-custom-input]'),multiple=control.dataset.multiple==='true';
 const key=control.dataset.choiceField;let current=value.value||'';choiceValues.set(key,current);
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
 if(section){const menu=section.querySelector('.field-menu');if(menu){menu.hidden=!expanded;if(!expanded)menu.open=false;}}
 if(expanded)region.querySelectorAll('textarea').forEach(resize);
}
function revealAncestors(target){
 const parents=[];for(let parent=target;parent&&parent!==form;parent=parent.parentElement)parents.unshift(parent);
 for(const parent of parents){
  if(parent.matches('.collapsible-region')){const button=form.querySelector('[data-collapse-target="'+parent.id+'"]');if(button)setExpanded(button,true);}
  if(parent.tagName==='DETAILS')parent.open=true;
 }
 resize(target);
}
form.querySelectorAll('[data-collapse-target]').forEach(button=>button.addEventListener('click',()=>setExpanded(button,button.getAttribute('aria-expanded')!=='true')));
form.querySelectorAll('.choice-control').forEach(buildChoiceControl);
function revealHash(){
 let anchor;try{anchor=decodeURIComponent(location.hash.slice(1));}catch{return;}
 const target=document.getElementById(anchor);
 if(!target)return;
 const button=target.querySelector('[data-collapse-target]');if(button)setExpanded(button,true);revealAncestors(target);
 requestAnimationFrame(()=>{
  const identity=target.closest('.infobox'),heading=target.matches('.profile-section')?target.querySelector('.section-header h2'):null;
  if(identity&&matchMedia('(min-width:651px)').matches)identity.scrollIntoView({block:'start',behavior:'instant'});
  (heading||target).scrollIntoView({block:identity?'nearest':'start',behavior:'instant'});
 });
}
window.addEventListener('hashchange',revealHash);revealHash();
function applyVisibility(){
 form.querySelectorAll('[data-visibility]').forEach(input=>{const field=form.querySelector('[data-profile-field="'+input.dataset.visibility+'"]');field.hidden=!input.checked;if(input.checked)field.querySelectorAll('textarea').forEach(resize);});
}
form.querySelectorAll('[data-visibility]').forEach(input=>input.addEventListener('change',applyVisibility));
form.querySelectorAll('[data-visibility-all]').forEach(button=>button.addEventListener('click',()=>{button.closest('.field-menu').querySelectorAll('[data-visibility]').forEach(input=>input.checked=button.dataset.visibilityAll==='show');applyVisibility();markDirty();}));
form.addEventListener('invalid',event=>{revealAncestors(event.target);const field=event.target.closest('[data-profile-field]');if(field?.hidden){const toggle=form.querySelector('[data-visibility="'+field.dataset.profileField+'"]');if(toggle){toggle.checked=true;applyVisibility();markDirty();}}resize(event.target);},true);
document.addEventListener('click',event=>{document.querySelectorAll('.field-menu[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.field-menu[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary').focus();});});

 document.querySelector('#edit-name').addEventListener('click',()=>{const input=form.elements.namedItem(nameField);revealAncestors(input);input.focus();});
 form.querySelectorAll('textarea').forEach(resize);
 window.addEventListener('resize',()=>form.querySelectorAll('textarea').forEach(resize));
 initProfileViewport(form);
 return {choiceValues,commitChoices:()=>pendingChoiceEditors.every(commit=>commit()),hiddenFields:()=>[...form.querySelectorAll('[data-visibility]:not(:checked)')].map(input=>input.dataset.visibility),revealAncestors};
}
