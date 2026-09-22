import {plainNoteText} from './note-content.js';
export function createInlineNoteEditor(){
 const element=document.createElement('div');element.id='note-text';element.className='inline-note-editor';element.contentEditable='true';element.setAttribute('role','textbox');element.setAttribute('aria-multiline','true');element.setAttribute('aria-labelledby','note-text-label');element.dataset.placeholder='Add a detail, update, or piece of lore…';
 const error=document.createElement('p');error.className='note-input-error';error.id='note-input-error';error.setAttribute('role','alert');error.hidden=true;element.setAttribute('aria-describedby',error.id);
 let selection=null,counter=0;const tokens=new Map();
 function pill(part){const span=document.createElement('span');span.className='inline-note-pill';span.contentEditable='false';span.dataset.noteToken=String(++counter);span.textContent=part.text;tokens.set(span.dataset.noteToken,part.ref);return span;}
 function read(){const parts=[];const append=text=>{if(!text)return;const last=parts.at(-1);if(last&&!last.ref)last.text+=text;else parts.push({text});};
  function visit(n){if(n.nodeType===3){append(n.textContent);return;}if(n.nodeType!==1)return;const ref=tokens.get(n.dataset.noteToken);if(ref){parts.push({text:n.textContent,ref:{...ref}});return;}if(n.tagName==='BR'){append('\n');return;}const block=['DIV','P','LI'].includes(n.tagName);if(block&&parts.length&&!parts.at(-1).text.endsWith('\n'))append('\n');n.childNodes.forEach(visit);}
  element.childNodes.forEach(visit);return parts;
 }
 function remember(){const s=window.getSelection();if(s?.rangeCount&&element.contains(s.anchorNode)&&element.contains(s.focusNode))selection=s.getRangeAt(0).cloneRange();}
 document.addEventListener('selectionchange',remember);
 function restore(){element.focus();const s=window.getSelection();if(!selection||!element.contains(selection.commonAncestorContainer)){selection=document.createRange();selection.selectNodeContents(element);selection.collapse(false);}s.removeAllRanges();s.addRange(selection);}
 function insertNodes(nodes){restore();const holder=document.createElement('div');nodes.forEach(n=>holder.append(n));
  // Native insertion retains the browser's text-edit undo history. HTML here is generated from safe DOM nodes only.
  if(!document.execCommand('insertHTML',false,holder.innerHTML)){const range=window.getSelection().getRangeAt(0);range.deleteContents();const fragment=document.createDocumentFragment();while(holder.firstChild)fragment.append(holder.firstChild);const last=fragment.lastChild;range.insertNode(fragment);range.setStartAfter(last);range.collapse(true);window.getSelection().removeAllRanges();window.getSelection().addRange(range);element.dispatchEvent(new Event('input',{bubbles:true}));}
  remember();
 }
 element.addEventListener('paste',e=>{e.preventDefault();insertNodes([document.createTextNode(e.clipboardData.getData('text/plain'))]);});
 element.addEventListener('drop',e=>e.preventDefault());
 element.addEventListener('input',()=>{element.setCustomValidity('');element.dataset.empty=String(!element.textContent&& !element.querySelector('.inline-note-pill'));});
 element.setCustomValidity=message=>{error.textContent=message;error.hidden=!message;element.setAttribute('aria-invalid',String(!!message));};
 element.reportValidity=()=>{if(!error.hidden)element.focus();return error.hidden;};
 Object.defineProperty(element,'value',{get:()=>plainNoteText(read()),set:text=>load([{text}])});
 function load(content){tokens.clear();selection=null;element.replaceChildren(...content.map(p=>p.ref?pill(p):document.createTextNode(p.text)));element.dataset.empty=String(!element.textContent);element.setCustomValidity('');}
 return {element,error,read,load,insert(target){const ref={kind:target.kind,id:target.id,...(target.kind==='note'?{characterId:target.characterId}:{})};insertNodes([pill({text:target.label,ref}),document.createTextNode(' ')]);},focus:()=>element.focus()};
}
