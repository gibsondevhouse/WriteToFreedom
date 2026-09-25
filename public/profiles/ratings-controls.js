function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}

/** Build reusable 0–99 profile rating dials and mutate the supplied draft. */
export function createRatingControls(draft,markDirty,groups,{profile=true,idPrefix=profile?'profile-rating-':'rating-'}={}){
 const host=el('div',(profile?'profile-rating-groups ':'')+'attribute-groups'),sync=[];
 for(const group of groups){
  const section=el('section',(profile?'profile-rating-group ':'')+'attribute-group '+group.id),grid=el('div','attribute-ring-grid');section.append(el('h3','',group.title));
  for(const [key,labelText] of group.fields){
   const row=el('div','attribute-dial'),label=el('label','attribute-label',labelText),number=el('input','attribute-number'),ring=el('div','attribute-ring'),slider=el('input','attribute-adjust');
   number.id=idPrefix+key;number.name=idPrefix+key;number.autocomplete='off';number.type='number';number.min='0';number.max='99';number.step='1';number.placeholder='—';number.value=draft[key]??'';number.setAttribute('aria-label',labelText+' rating');label.htmlFor=number.id;
   slider.name=idPrefix+key+'-adjust';slider.autocomplete='off';slider.type='range';slider.min='0';slider.max='99';slider.step='1';slider.value=draft[key]??0;slider.setAttribute('aria-label','Adjust '+labelText.toLowerCase());
   const paint=()=>{const value=draft[key];ring.style.setProperty('--rating',(value??0)/99*100+'%');row.dataset.unset=String(value===undefined);slider.setAttribute('aria-valuetext',value===undefined?'Not rated':value+' out of 99');};
   slider.addEventListener('input',()=>{draft[key]=Number(slider.value);number.value=slider.value;paint();markDirty();});
   number.addEventListener('input',()=>{if(number.value===''){delete draft[key];slider.value='0';}else if(number.validity.valid){draft[key]=Number(number.value);slider.value=number.value;}paint();markDirty();});
   const syncFromDraft=()=>{number.value=draft[key]??'';slider.value=draft[key]??0;paint();};sync.push(syncFromDraft);
   ring.append(number);syncFromDraft();row.append(ring,label,slider);grid.append(row);
  }
  section.append(grid);host.append(section);
 }
 host.syncFromDraft=()=>sync.forEach(update=>update());return host;
}

/** Mount each rating group inside its related profile section and return a save payload reader. */
export function initProfileRatings(record,groups){
 const draft={...(record.profileRatings||{})},form=document.querySelector('#profile-form');
 const markDirty=()=>form.dispatchEvent(new Event('change',{bubbles:true}));
 const bySection=new Map();for(const group of groups){const list=bySection.get(group.sectionId)||[];list.push(group);bySection.set(group.sectionId,list);}
 const controls=[];
 for(const [sectionId,sectionGroups] of bySection){const host=document.querySelector(`[data-profile-ratings="${sectionId}"]`);if(!host)continue;const control=createRatingControls(draft,markDirty,sectionGroups);host.append(control);controls.push(control);}
 window.addEventListener('pageshow',()=>controls.forEach(control=>control.syncFromDraft()));
 return ()=>({profileRatings:{...draft}});
}
