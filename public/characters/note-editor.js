import {createNoteItemButton} from './create-note-item.js';
import {createInlineNoteEditor} from './inline-note-editor.js';
import {createNoteConnections} from './note-connections.js';
import {noteFields,noteMarker,moveNoteAnchors} from './notes.js';
import {resize} from '../profiles/controls.js?v=worlds-1';

export function initCharacterNotes(form,initial,markDirty,controls,profileData){
 const notes=initial.map(note=>({...note})),own=document.querySelector('#authored-notes'),mentions=document.querySelector('#mentioned-notes'),empty=document.querySelector('#notes-empty');
 const previous=new Map(noteFields.map(field=>[field,form.elements.namedItem(field)?.value||'']));
 let armed=null,pending=null,editing=null,opener=null;
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const action=(text,handler,cls='note-action')=>{const b=make('button',cls,text);b.type='button';b.addEventListener('click',handler);return b;};
 const dialog=make('dialog','note-composer');dialog.setAttribute('aria-labelledby','note-composer-title');
 const editor=make('form'),heading=make('h2','','Create a note');heading.id='note-composer-title';
 const context=make('p','note-context'),label=make('label','','Note');label.id='note-text-label';
 const richBody=createInlineNoteEditor(),input=richBody.element;
 const buttons=make('div','note-composer-actions');
 const cancel=action('Cancel',()=>dialog.close()),submit=make('button','note-submit','Add note');submit.type='submit';
 buttons.append(cancel,submit);editor.append(heading,context,label,input,richBody.error,buttons);dialog.append(editor);document.body.append(dialog);
 const connections=createNoteConnections(editor,input,profileData,()=>notes,richBody);
 buttons.prepend(createNoteItemButton(profileData,connections,value=>{
  if(notes.length>=(editing?100:99))throw new Error('This profile has no room for another note. Remove one before creating another.');
  const note={...value,field:editing?.field||pending.field,position:null,content:[{text:value.text}],links:[]};
  notes.push(note);render();markDirty();
  return {kind:'note',id:note.id,characterId:profileData.character.id,label:note.title,group:note.type==='lore'?'Lore':'Notes',href:'#note-'+note.id};
 }));
 function fieldInput(field){return form.elements.namedItem(field);}
 function revealSource(source){controls.revealAncestors(source);const field=source.closest('[data-profile-field]');if(field?.hidden){const toggle=form.querySelector('[data-visibility="'+source.name+'"]');if(toggle){toggle.checked=true;toggle.dispatchEvent(new Event('change',{bubbles:true}));}}resize(source);}
 function jump(note){const source=fieldInput(note.field);revealSource(source);source.focus();const position=note.position??0;source.setSelectionRange(position,position+(note.position===null?0:noteMarker(notes.indexOf(note)).length));source.scrollIntoView({block:'center',behavior:'smooth'});}
 function stopPlacement(){if(!armed)return;armed.section.classList.remove('placing-note');armed.bar.remove();armed=null;}
 function arm(section,existing=null){
  stopPlacement();if(!existing&&notes.length>=100){alert('This character already has 100 notes. Remove a note before adding another.');return;}
  const toggle=section.querySelector('[data-collapse-target]');if(toggle?.getAttribute('aria-expanded')==='false')toggle.click();
  section.querySelector('.field-menu').open=false;
  const bar=make('div','note-placement');bar.setAttribute('role','status');
  bar.append(make('span','','Place the cursor in this section’s text and press Enter. Esc cancels.'),action('Cancel',()=>stopPlacement()));
  section.querySelector('.collapsible-region').prepend(bar);section.classList.add('placing-note');armed={section,bar,existing};
  const sources=[...section.querySelectorAll('textarea[name]')].filter(n=>noteFields.includes(n.name));
  const first=sources.find(n=>!n.closest('[data-profile-field]')?.hidden)||sources[0];
  if(first){revealSource(first);first.focus();}
 }
 function writeField(field,value){const source=fieldInput(field);moveNoteAnchors(notes,field,source.value,value);source.value=value;previous.set(field,value);resize(source);}
 function showComposer(note=null){editing=note;heading.textContent=note?'Edit note':'Create a note';submit.textContent=note?'Update note':'Add note';connections.load(note);input.setCustomValidity('');const source=fieldInput(note?.field||pending.field);context.textContent=source.getAttribute('aria-label');dialog.showModal();input.focus();}
 function render(){
  own.replaceChildren();own.hidden=!notes.length;mentions.start=notes.length+1;empty.hidden=!!(notes.length||mentions.children.length);
  notes.forEach((note,index)=>{
   const li=make('li');li.id='note-'+note.id;li.tabIndex=-1;
   const back=action('↑',()=>jump(note),'reference-backlink');back.setAttribute('aria-label','Return to note '+(index+1)+' in the text');
   const tools=make('span','authored-note-actions');
   tools.append(action('Edit',()=>{opener=document.activeElement;showComposer(note);}),action('Remove',()=>removeNote(note)));
   if(note.position===null)tools.append(action('Place in text',()=>arm(fieldInput(note.field).closest('.profile-section'),note)));
   li.append(back,document.createTextNode(' '));if(note.title)li.append(make('strong','note-title',note.title),document.createTextNode('. '));li.append(connections.renderText(note),tools,connections.renderDetails(note));own.append(li);
  });
  form.querySelectorAll('.field-note-links').forEach(n=>n.remove());
  for(const field of noteFields){const matches=notes.filter(n=>n.field===field);if(!matches.length)continue;
   const source=fieldInput(field),links=make('div','field-note-links');links.append(make('span','','Notes '));
   for(const note of matches){const button=action(noteMarker(notes.indexOf(note)),()=>{const list=document.querySelector('#notes');const toggle=list.querySelector('[data-collapse-target]');if(toggle.getAttribute('aria-expanded')==='false')toggle.click();const target=document.getElementById('note-'+note.id);target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:'smooth'});});button.setAttribute('aria-label','Read note '+(notes.indexOf(note)+1));links.append(button);}
   source.after(links);
  }
 }
 function removeNote(note){
  const index=notes.indexOf(note),source=fieldInput(note.field),marker=noteMarker(index);
  if(note.position!==null&&source.value.slice(note.position,note.position+marker.length)===marker)writeField(note.field,source.value.slice(0,note.position)+source.value.slice(note.position+marker.length));
  notes.splice(index,1);
  // Replace later markers from the end of each field so their anchors stay exact.
  for(const field of noteFields){const source=fieldInput(field);let text=source.value;
   const changes=notes.map((n,i)=>({note:n,index:i})).filter(c=>c.note.field===field&&c.note.position!==null&&c.index>=index).sort((a,b)=>b.note.position-a.note.position);
   for(const {note:n,index:i}of changes){const old=noteMarker(i+1),next=noteMarker(i),at=n.position;if(text.slice(at,at+old.length)!==old){n.position=null;continue;}text=text.slice(0,at)+next+text.slice(at+old.length);for(const other of notes)if(other.field===field&&other.position!==null&&other.position>at)other.position+=next.length-old.length;}
   source.value=text;previous.set(field,text);resize(source);
  }
  render();markDirty();document.querySelector('#notes .collapse-toggle').focus();
 }
 form.querySelectorAll('[data-create-note]').forEach(button=>button.addEventListener('click',()=>{opener=button;arm(button.closest('.profile-section'));}));
 form.addEventListener('keydown',event=>{
  if(!armed)return;
  if(event.key==='Escape'){event.preventDefault();stopPlacement();return;}
  if(event.key!=='Enter'||event.isComposing||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const source=event.target;
  if(!source.matches('textarea[name]')||!noteFields.includes(source.name)||!armed.section.contains(source))return;
  event.preventDefault();event.stopPropagation();
  pending={field:source.name,position:source.selectionStart};opener=source;
  const existing=armed.existing;stopPlacement();
  if(existing){const marker=noteMarker(notes.indexOf(existing));if(source.value.length+marker.length>10000){pending=null;return;}const at=pending.position;writeField(source.name,source.value.slice(0,at)+marker+source.value.slice(at));existing.field=source.name;existing.position=at;pending=null;render();markDirty();}
  else showComposer();
 },true);
 form.addEventListener('input',event=>{const source=event.target;if(!noteFields.includes(source.name))return;moveNoteAnchors(notes,source.name,previous.get(source.name)||'',source.value);previous.set(source.name,source.value);render();});
 input.addEventListener('input',()=>input.setCustomValidity(''));
 editor.addEventListener('submit',event=>{
  event.preventDefault();if(input.value.length>2000){input.setCustomValidity('Keep notes under 2,000 characters.');input.reportValidity();return;}if(!input.value.trim()){input.setCustomValidity('Enter your note.');input.reportValidity();return;}
  const metadata=connections.read();if(!metadata)return;
  if(editing)Object.assign(editing,{text:input.value.trim(),...metadata});
  else{const source=fieldInput(pending.field),marker=noteMarker(notes.length);if(source.value.length+marker.length>10000){input.setCustomValidity('The source field is full. Shorten it before adding a note marker.');input.reportValidity();return;}
   const at=pending.position;writeField(pending.field,source.value.slice(0,at)+marker+source.value.slice(at));notes.push({id:crypto.randomUUID(),field:pending.field,position:at,text:input.value.trim(),...metadata});
  }
  render();markDirty();dialog.close();
 });
 dialog.addEventListener('close',()=>{pending=null;editing=null;if(opener?.isConnected)opener.focus();});
 render();
 return {notes,readyToSave(){if(dialog.open){input.focus();return false;}stopPlacement();return true;}};
}
