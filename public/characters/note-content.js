import {referenceKey} from './notes.js';
export const plainNoteText=content=>content.map(part=>part.text).join('');
export function noteContent(note,targets=[]){
 if(Array.isArray(note.content))return note.content;
 // Older notes stored connections separately. Place them in the text when edited.
 const parts=[{text:note.text||''}];
 for(const ref of note.links||[]){const target=targets.find(t=>referenceKey(t)===referenceKey(ref)),label=target?.label||'Unavailable item';let found=false;
  for(let i=0;i<parts.length;i++){const p=parts[i],at=p.ref?-1:p.text.indexOf(label);if(at<0)continue;parts.splice(i,1,...(at?[{text:p.text.slice(0,at)}]:[]),{text:label,ref},...(at+label.length<p.text.length?[{text:p.text.slice(at+label.length)}]:[]));found=true;break;}
  if(!found)parts.push({text:' '},{text:label,ref});
 }
 return parts;
}
export function contentReferences(content){return [...new Map(content.filter(p=>p.ref).map(p=>[referenceKey(p.ref),p.ref])).values()];}
