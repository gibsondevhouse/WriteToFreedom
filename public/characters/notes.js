import {templateSections} from './template.js';
export const noteFields=templateSections.flatMap(s=>s.fields.filter(f=>f[2]==='textarea').map(f=>f[0]));
export const referenceKey=ref=>[ref.kind,ref.characterId||'',ref.id].join(':');
export const noteTypes=['detail','update','lore'];
export const noteMarker=index=>'['+(index+1)+']';
export function validateNotes(value,document){
 if(!Array.isArray(value)||value.length>100)throw new Error('Keep at most 100 notes on a character.');
 const seen=new Set();
 return value.map((note,index)=>{
  if(!note||typeof note.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(note.id)||seen.has(note.id)||!noteFields.includes(note.field)||typeof note.text!=='string'||!note.text.trim()||note.text.length>2000)throw new Error('Check the note text and its source field.');
  seen.add(note.id);const marker=noteMarker(index),source=document[note.field]||'';
  const position=Number.isInteger(note.position)&&note.position>=0&&source.slice(note.position,note.position+marker.length)===marker?note.position:null;
  const extra={};
  if(Object.hasOwn(note,'title')){if(typeof note.title!=='string'||note.title.length>120)throw new Error('Keep note titles under 120 characters.');extra.title=note.title.trim();}
  if(Object.hasOwn(note,'type')){if(!noteTypes.includes(note.type))throw new Error('Choose Detail, Update, or Lore.');extra.type=note.type;}
  if(Object.hasOwn(note,'tags')){if(!Array.isArray(note.tags)||note.tags.length>12||note.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>40))throw new Error('Use up to 12 tags, each under 40 characters.');extra.tags=[...new Set(note.tags.map(t=>t.trim().replace(/^#+/,'')).filter(Boolean))];}
  if(Object.hasOwn(note,'links')){
   if(!Array.isArray(note.links)||note.links.length>30)throw new Error('Use up to 30 linked items per note.');
   const linked=new Set();extra.links=note.links.map(link=>{
    if(!link||!['character','location','faction','note'].includes(link.kind)||typeof link.id!=='string'||!/^[a-z0-9-]{1,80}$/i.test(link.id)||(link.kind==='note'&&(typeof link.characterId!=='string'||!/^[a-z0-9-]{1,80}$/i.test(link.characterId))))throw new Error('Choose a valid linked item.');
    const clean={kind:link.kind,id:link.id,...(link.kind==='note'?{characterId:link.characterId}:{})};
    const key=referenceKey(clean);if(linked.has(key))throw new Error('A note cannot link to the same item twice.');linked.add(key);return clean;
   });
  }
  return {id:note.id,field:note.field,text:note.text.trim(),position,...extra};
 });
}
// Track a single text edit, including insertion, replacement, paste, and undo.
export function moveNoteAnchors(notes,field,before,after){
 if(before===after)return;
 let start=0;while(start<before.length&&start<after.length&&before[start]===after[start])start++;
 let end=before.length,nextEnd=after.length;
 while(end>start&&nextEnd>start&&before[end-1]===after[nextEnd-1]){end--;nextEnd--;}
 const delta=after.length-before.length;
 notes.forEach((note,index)=>{
  if(note.field!==field||note.position===null)return;
  const markerEnd=note.position+noteMarker(index).length;
  if(end<=note.position)note.position+=delta;
  else if(start<markerEnd)note.position=null;
 });
}
