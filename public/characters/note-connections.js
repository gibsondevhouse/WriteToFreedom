import {noteContent,contentReferences} from './note-content.js';
import {referenceKey,noteTypes} from './notes.js';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,click)=>{const b=node('button','note-action',text);b.type='button';b.addEventListener('click',click);return b;};
export function createNoteConnections(editor,body,initial,getNotes,richBody){
 let currentId=null,legacyTags=[];
 const title=node('input');title.id='note-title';title.maxLength=120;title.placeholder='Optional title';
 const type=node('select');type.id='note-type';for(const t of noteTypes)type.append(new Option(t[0].toUpperCase()+t.slice(1),t));
 const header=node('div','note-form-row');
 const field=(labelText,control)=>{const label=node('label','',labelText);label.htmlFor=control.id;const wrap=node('div');wrap.append(label,control);return wrap;};
 header.append(field('Title',title),field('Kind',type));editor.insertBefore(header,body.previousElementSibling);
 const host=node('div','note-connections'),caption=node('label','','Insert linked text');caption.htmlFor='note-link-search';
 const search=node('input');search.id='note-link-search';search.type='search';search.placeholder='Find characters, places, notes, lore…';search.autocomplete='off';
 const select=node('select');select.id='note-link-target';select.setAttribute('aria-label','Choose an item to link');
 const choices=node('div','note-link-choices'),feedback=node('p','note-link-feedback');feedback.setAttribute('role','status');
 const add=button('Insert',()=>{const target=targets().find(t=>referenceKey(t)===select.value);if(!target)return;const links=contentReferences(richBody.read());if(links.length>=30&&!links.some(l=>referenceKey(l)===referenceKey(target))){feedback.textContent='Use up to 30 linked items.';return;}if(body.value.length+target.label.length+1>2000){feedback.textContent='Keep notes under 2,000 characters.';return;}richBody.insert(target);feedback.textContent='';search.value='';render();});
 choices.append(select,add);host.append(caption,search,choices,feedback);body.after(host);
 function targets(){return [...(initial.noteTargets||[]).filter(t=>!(t.kind==='note'&&t.characterId===initial.character.id)),...getNotes().map((n,i)=>({kind:'note',id:n.id,characterId:initial.character.id,label:n.title||n.text.slice(0,80),group:n.type==='lore'?'Lore':'Notes',detail:(initial.character.name||'This character')+' · Note '+(i+1),href:'#note-'+n.id}))];}
 function render(){
  const all=targets(),query=search.value.trim().toLowerCase();
  const matches=all.filter(t=>!(t.kind==='note'&&t.characterId===initial.character.id&&t.id===currentId)&&[t.label,t.detail,t.group].join(' ').toLowerCase().includes(query));
  select.replaceChildren(new Option(matches.length?'Choose an item…':'No matching items',''));const groups=new Map();
  for(const t of matches){if(!groups.has(t.group)){const group=node('optgroup');group.label=t.group;groups.set(t.group,group);select.append(group);}groups.get(t.group).append(new Option(t.label+(t.detail?' — '+t.detail:''),referenceKey(t)));}
  add.disabled=true;
 }
 select.addEventListener('change',()=>add.disabled=!select.value);search.addEventListener('input',render);
 search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(select.options.length===2){select.selectedIndex=1;add.disabled=false;add.click();}else select.focus();}});
 function checkInsert(label){if(contentReferences(richBody.read()).length>=30)throw new Error('Use up to 30 linked items. Remove a link before creating another.');if(body.value.length+label.length+1>2000)throw new Error('Shorten the note before inserting another item; the limit is 2,000 characters.');}
 return {
  checkInsert,
  insertCreated(target){initial.noteTargets||=[];if(!initial.noteTargets.some(t=>referenceKey(t)===referenceKey(target)))initial.noteTargets.push(target);richBody.insert(target);search.value='';feedback.textContent='';render();},
  load(note){currentId=note?.id||null;title.value=note?.title||'';type.value=note?.type||'detail';legacyTags=note?.tags||[];richBody.load(noteContent(note||{text:''},targets()));search.value='';feedback.textContent='';render();},
  read(){const content=richBody.read();if(content.length>200){body.setCustomValidity('This note has too many separate text pieces. Shorten it before saving.');body.reportValidity();return null;}return {title:title.value.trim(),type:type.value,content,links:contentReferences(content),...(legacyTags.length?{tags:legacyTags}:{})};},
  renderText(note){const text=node('span','reference-text'),all=targets();for(const part of noteContent(note,all)){const target=part.ref&&all.find(t=>referenceKey(t)===referenceKey(part.ref));const child=node(target?'a':'span',target?'note-inline-link':'',part.text);if(target)child.href=target.href;text.append(child);}return text;},
  renderDetails(note){const detail=node('div','note-details');
   if(note.type&&note.type!=='detail')detail.append(node('span','note-kind',note.type));
   const incoming=[...(initial.noteBacklinks?.[note.id]||[]).filter(n=>!n.href.startsWith('/characters/'+initial.character.id+'/')), ...getNotes().filter(n=>(n.links||[]).some(l=>l.kind==='note'&&l.characterId===initial.character.id&&l.id===note.id)).map(n=>({href:'#note-'+n.id,title:n.title||n.text.slice(0,60),source:initial.character.name}))];
   if(incoming.length){const back=node('div','note-backlinks','Linked from ');incoming.forEach((n,i)=>{if(i)back.append(document.createTextNode(' · '));const a=node('a','',n.title||n.source);a.href=n.href;back.append(a);});detail.append(back);}
   return detail;
  }
 };
}
