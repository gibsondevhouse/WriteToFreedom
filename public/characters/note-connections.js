import {referenceKey,noteTypes} from './notes.js';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,click)=>{const b=node('button','note-action',text);b.type='button';b.addEventListener('click',click);return b;};
export function createNoteConnections(editor,body,initial,getNotes){
 let links=[],currentId=null;
 const title=node('input');title.id='note-title';title.maxLength=120;title.placeholder='Optional title';
 const type=node('select');type.id='note-type';for(const t of noteTypes)type.append(new Option(t[0].toUpperCase()+t.slice(1),t));
 const header=node('div','note-form-row');
 const field=(labelText,control)=>{const label=node('label','',labelText);label.htmlFor=control.id;const wrap=node('div');wrap.append(label,control);return wrap;};
 header.append(field('Title',title),field('Kind',type));editor.insertBefore(header,body.previousElementSibling);
 const host=node('div','note-connections'),caption=node('label','','Connected to');caption.htmlFor='note-link-search';
 const search=node('input');search.id='note-link-search';search.type='search';search.placeholder='Find characters, places, notes, lore…';search.autocomplete='off';
 const select=node('select');select.id='note-link-target';select.setAttribute('aria-label','Choose an item to link');
 const choices=node('div','note-link-choices'),chosen=node('div','note-chips'),feedback=node('p','note-link-feedback');feedback.setAttribute('role','status');
 const add=button('Link',()=>{const target=targets().find(t=>referenceKey(t)===select.value);if(!target)return;if(links.length>=30){feedback.textContent='Use up to 30 linked items.';return;}links.push({kind:target.kind,id:target.id,...(target.kind==='note'?{characterId:target.characterId}:{})});feedback.textContent=target.label+' linked.';search.value='';render();search.focus();});
 choices.append(select,add);host.append(caption,search,choices,chosen,feedback);
 const tags=node('input');tags.id='note-tags';tags.placeholder='e.g. secret, first encounter';tags.maxLength=500;
 const tagField=field('Tags · separated by commas',tags);host.append(tagField);body.after(host);
 function targets(){return [...(initial.noteTargets||[]).filter(t=>!(t.kind==='note'&&t.characterId===initial.character.id)),...getNotes().map((n,i)=>({kind:'note',id:n.id,characterId:initial.character.id,label:n.title||n.text.slice(0,80),group:n.type==='lore'?'Lore':'Notes',detail:(initial.character.name||'This character')+' · Note '+(i+1),href:'#note-'+n.id}))];}
 function render(){
  chosen.replaceChildren();const all=targets();
  for(const link of links){const target=all.find(t=>referenceKey(t)===referenceKey(link));const chip=node('span','note-chip',target?.label||'Unavailable item');const remove=button('×',()=>{links=links.filter(l=>l!==link);render();search.focus();});remove.setAttribute('aria-label','Unlink '+(target?.label||'item'));chip.append(remove);chosen.append(chip);}
  const query=search.value.trim().toLowerCase(),selected=new Set(links.map(referenceKey));
  const matches=all.filter(t=>!(t.kind==='note'&&t.characterId===initial.character.id&&t.id===currentId)&&!selected.has(referenceKey(t))&&[t.label,t.detail,t.group].join(' ').toLowerCase().includes(query));
  select.replaceChildren(new Option(matches.length?'Choose an item…':'No matching items',''));const groups=new Map();
  for(const t of matches){if(!groups.has(t.group)){const group=node('optgroup');group.label=t.group;groups.set(t.group,group);select.append(group);}groups.get(t.group).append(new Option(t.label+(t.detail?' — '+t.detail:''),referenceKey(t)));}
  add.disabled=true;
 }
 select.addEventListener('change',()=>add.disabled=!select.value);search.addEventListener('input',render);
 search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(select.options.length===2){select.selectedIndex=1;add.disabled=false;add.click();}else select.focus();}});
 tags.addEventListener('input',()=>tags.setCustomValidity(''));
 tags.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();body.focus();}});
 return {
  load(note){currentId=note?.id||null;title.value=note?.title||'';type.value=note?.type||'detail';links=(note?.links||[]).map(l=>({...l}));tags.value=(note?.tags||[]).join(', ');tags.setCustomValidity('');search.value='';feedback.textContent='';render();},
  read(){const values=[...new Set(tags.value.split(',').map(t=>t.trim().replace(/^#+/,'')).filter(Boolean))];if(values.length>12||values.some(t=>t.length>40)){tags.setCustomValidity('Use up to 12 tags, each under 40 characters.');tags.reportValidity();return null;}return {title:title.value.trim(),type:type.value,links:links.map(l=>({...l})),tags:values};},
  renderDetails(note){const detail=node('div','note-details');
   if(note.type&&note.type!=='detail')detail.append(node('span','note-kind',note.type));
   const all=targets();for(const link of note.links||[]){const target=all.find(t=>referenceKey(t)===referenceKey(link));const chip=node(target?'a':'span','note-chip',target?.label||'Unavailable item');if(target){chip.href=target.href;chip.title=target.group+(target.detail?' · '+target.detail:'');}detail.append(chip);}
   for(const tag of note.tags||[])detail.append(node('span','note-tag','#'+tag));
   const incoming=[...(initial.noteBacklinks?.[note.id]||[]).filter(n=>!n.href.startsWith('/characters/'+initial.character.id+'/')), ...getNotes().filter(n=>(n.links||[]).some(l=>l.kind==='note'&&l.characterId===initial.character.id&&l.id===note.id)).map(n=>({href:'#note-'+n.id,title:n.title||n.text.slice(0,60),source:initial.character.name}))];
   if(incoming.length){const back=node('div','note-backlinks','Linked from ');incoming.forEach((n,i)=>{if(i)back.append(document.createTextNode(' · '));const a=node('a','',n.title||n.source);a.href=n.href;back.append(a);});detail.append(back);}
   return detail;
  }
 };
}
