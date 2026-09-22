import {attributeGroups} from './attributes.js?v=section-attributes-1';

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}

// Mutates the supplied ratings draft; an empty numeric input leaves an attribute unrated.
export function createAttributeControls(draft,markDirty,selectedGroups=attributeGroups){
  const groups=el('div','attribute-groups');
  for(const group of selectedGroups){
   const section=el('section','attribute-group '+group.id);section.append(el('h3','',group.title));const grid=el('div','attribute-ring-grid');
   for(const [key,name]of group.fields){
    const row=el('div','attribute-dial'),label=el('label','attribute-label',name),number=el('input','attribute-number'),ring=el('div','attribute-ring');
    number.id='rating-'+key;number.type='number';number.min='0';number.max='99';number.step='1';number.placeholder='—';number.value=draft[key]??'';number.setAttribute('aria-label',name+' rating');label.htmlFor=number.id;
    const slider=el('input','attribute-adjust');slider.type='range';slider.min='0';slider.max='99';slider.step='1';slider.value=draft[key]??0;slider.setAttribute('aria-label','Adjust '+name.toLowerCase());
    function paint(){const value=draft[key];ring.style.setProperty('--rating',(value??0)/99*100+'%');row.dataset.unset=String(value===undefined);slider.setAttribute('aria-valuetext',value===undefined?'Not rated':value+' out of 99');}
    slider.addEventListener('input',()=>{draft[key]=Number(slider.value);number.value=slider.value;paint();markDirty();});
    number.addEventListener('input',()=>{if(number.value===''){delete draft[key];slider.value='0';}else if(number.validity.valid){draft[key]=Number(number.value);slider.value=number.value;}paint();markDirty();});
    ring.append(number);paint();row.append(ring,label,slider);grid.append(row);
   }
   section.append(grid);groups.append(section);
  }
  return groups;
}
