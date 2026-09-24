import {loreTypes,loreHref} from '../public/lore/template.js';
import {referenceKey} from '../public/characters/notes.js';
import {typeLabels,locationHref} from '../public/locations/data.js';
import {escape,renderSection} from './profile-components.js';
/** Project scoped catalogs into stable selectable references; note IDs retain their owning character ID. */
export function noteTargets(cast,factions,locations,lore=[]){
 return [
 ...lore.map(r=>({kind:'lore',id:r.id,label:r.name,group:'Lore',detail:loreTypes[r.type],href:loreHref(r)})),
 ...cast.map(c=>({kind:'character',id:c.id,label:c.name||'Untitled character',group:'Characters',href:'/characters/'+encodeURIComponent(c.id)+'/'})),
 ...locations.map(l=>({kind:'location',id:l.id,label:l.name,group:'Places',detail:typeLabels[l.type],href:locationHref(l)})),
 ...factions.map(f=>({kind:'faction',id:f.id,label:f.name||'Untitled faction',group:'Factions',href:'/factions/'+encodeURIComponent(f.id)+'/'})),
 ...cast.flatMap(c=>(c.notes||[]).map((n,i)=>({kind:'note',id:n.id,characterId:c.id,label:n.title||n.text.slice(0,80),group:n.type==='lore'?'Lore':'Notes',detail:(c.name||'Untitled character')+' · Note '+(i+1),href:'/characters/'+encodeURIComponent(c.id)+'/#note-'+n.id})))
 ];
}
/** Derive explicit backlinks only; textual name mentions are handled separately by characterMentions. */
export function connectedNotes(cast,target,lore=[]){
 const key=referenceKey(target);
 return [...lore.filter(r=>r.connections.some(c=>referenceKey(c.target)===key)).map(r=>({source:r.name,title:r.name,type:'lore-entry',text:r.connections.filter(c=>referenceKey(c.target)===key).map(c=>c.relationship).join(' · '),href:loreHref(r)})),...cast.flatMap(c=>(c.notes||[]).filter(n=>(n.links||[]).some(l=>referenceKey(l)===key)).map(n=>({source:c.name||'Untitled character',title:n.title||'',type:n.type||'detail',text:n.text,href:'/characters/'+encodeURIComponent(c.id)+'/#note-'+n.id})))];
}
/** Render already-scoped backlinks with escaped text using the shared section primitive. */
export function renderConnectedNotes(cast,target,record,lore=[]){
 const notes=connectedNotes(cast,target,lore);if(!notes.length)return '';
 return renderSection({id:'connected-notes',title:'Linked notes',fields:[]},`<ol class="profile-references">${notes.map(n=>`<li><a href="${escape(n.href)}">${escape(n.title||n.source)}</a>${n.title?' · '+escape(n.source):''}. ${escape(n.text)}</li>`).join('')}</ol>`,record);
}
/** Reject new unavailable/self-note links, while retaining existing unresolved references for compatibility. */
export function validateNoteConnections(notes,targets,currentNotes=[]){
 const keys=new Set(targets.map(referenceKey));
 for(const note of notes){
  if((note.links||[]).some(l=>l.kind==='note'&&l.id===note.id))throw new Error('Choose a different note to link.');
  const old=new Set((currentNotes.find(n=>n.id===note.id)?.links||[]).map(referenceKey));
  for(const link of note.links||[])if(!keys.has(referenceKey(link))&&!old.has(referenceKey(link)))throw new Error('Choose linked items from your world. A linked item may have been removed.');
 }
}
