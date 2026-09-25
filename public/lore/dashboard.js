import {el,loreEntryCard} from '../dashboard/components.js?v=__WTF_ASSET_REVISION__';
import {initDashboardShell} from '../dashboard/shell.js?v=__WTF_ASSET_REVISION__';
import {loreTypes,loreCollections,primaryCollection,loreHref} from './template.js?v=__WTF_ASSET_REVISION__';
import {announceWorkspaceChange} from '../profiles/workspace-events.js?v=__WTF_ASSET_REVISION__';

const $=selector=>document.querySelector(selector);
const search=$('#lore-search'),dialog=$('#new-lore-dialog'),form=$('#new-lore-form');
const type=$('#lore-entry-type'),name=$('#lore-entry-name'),quick=$('#quick-note-text'),capture=$('#quick-note-panel');
let data=null,saving=false,requestId=null,noteId=null;
const currentCollection=()=>{
 const value=new URLSearchParams(location.search).get('collection');
 return Object.hasOwn(loreCollections,value)?value:'';
};
let collection=currentCollection();
for(const [value,label] of Object.entries(loreTypes))type.append(new Option(label,value));

const collectionCopy={
 notes:'Gather ideas, rumors, and fragments of your world.',
 artifacts:'Give the objects in your story a history and a purpose.',
 relics:'Explore what your world preserves, reveres, or fears.',
 books:'Fill your world with records, stories, and forbidden knowledge.',
 jewels:'Keep track of treasures and the meaning they carry.',
 species:'Discover the life that inhabits your world.'
};
const collectionType=id=>Object.keys(primaryCollection).find(type=>primaryCollection[type]===id)||'note';
const createAction=id=>({label:'New '+loreTypes[collectionType(id)].toLowerCase(),onClick:()=>openNewEntry(collectionType(id))});
async function api(options={}){
 const response=await fetch('/api/lore',{credentials:'same-origin',cache:'no-store',...options});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Reload to sign in again. Keep a copy of any unsaved notes.');
 const body=await response.json();
 if(!response.ok)throw new Error(body.error||'Your lore could not be loaded.');
 return body;
}
function setCapture(open,focus=true){
 capture.hidden=!open;$('#toggle-note').setAttribute('aria-expanded',String(open));
 if(focus)(open?quick:$('#toggle-note')).focus();
}
function openNewEntry(preferredType=collectionType(collection)){
 if(saving)return;
 form.reset();requestId=null;type.value=preferredType;
 $('#new-lore-error').hidden=true;name.setCustomValidity('');dialog.showModal();name.focus();
}
function setCollection(value){
 collection=value;
 history.pushState(null,'',value?'/lore/?collection='+value:'/lore/');
 dashboard.render();
}
function collectionRail(view,options,id){
 const section=view.rail({...options,card:record=>loreEntryCard(record,{collection:id})});
 if(id==='books'||id==='relics')section.classList.add('book-cover-shelf');
 return section;
}
function render(data,view){
 const query=search.value.trim().toLocaleLowerCase(),terms=query.split(/\s+/).filter(Boolean);
 const entries=[...data.entries,...data.notes].sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||b.updatedAt.localeCompare(a.updatedAt));
 $('#clear-lore').hidden=!(collection||query);
 if(collection||query){
  const title=collection?loreCollections[collection]:'Search results';
  const matches=entries.filter(r=>(!collection||r.collections.includes(collection))&&terms.every(term=>[r.name,r.summary,r.searchText,r.tags,r.label,r.parent,...r.collections].join(' ').toLocaleLowerCase().includes(term)));
  collectionRail(view,{id:'results',title,records:matches,emptyText:query?'No matches. Try another name or keyword.':collectionCopy[collection],emptyAction:!query?createAction(collection):undefined},collection);
  $('#lore-result-status').textContent=`${matches.length} ${matches.length===1?'entry':'entries'} in ${title.toLowerCase()}.`;
  return;
 }
 $('#lore-result-status').textContent='';
 view.questions(data.questions,{emptyState:{
  title:'Your world has more to reveal.',
  description:'Add open questions to a lore entry. Its mysteries and unfinished ideas will appear here.',
  action:{label:'Create an entry ↗',onClick:()=>openNewEntry()}
 }});
 const featured=data.entries.filter(r=>r.featured);
 view.rail({id:'featured',title:'Featured lore',records:featured,card:loreEntryCard,hideWhenEmpty:true});
 for(const id of ['species','notes','artifacts','relics','books','jewels']){
  const title=loreCollections[id];
  const section=collectionRail(view,{id,title,records:entries.filter(record=>record.collections.includes(id)),href:'/lore/?collection='+id,emptyText:collectionCopy[id],emptyAction:createAction(id)},id);
  section.querySelector('.view-all').addEventListener('click',event=>{
   if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();setCollection(id);search.focus();
  });
 }
}
function updateSaving(){
 for(const control of [quick,$('#new-lore'),$('#toggle-note'),$('#save-note')])control.disabled=saving||!data;
 $('#save-note').textContent=saving?'Saving…':'Save note';
}
const dashboard=initDashboardShell({
 endpoint:'/api/lore',render,
 onData(next){data=next;search.disabled=false;updateSaving();}
});
search.addEventListener('input',()=>dashboard.render());
$('#clear-lore').addEventListener('click',()=>{search.value='';setCollection('');search.focus();});
window.addEventListener('popstate',()=>{collection=currentCollection();dashboard.render();});
$('#new-lore').addEventListener('click',()=>openNewEntry());
$('#toggle-note').addEventListener('click',()=>setCapture(capture.hidden));
$('#cancel-lore').addEventListener('click',()=>dialog.close());
dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
name.addEventListener('input',()=>{name.setCustomValidity('');requestId=null;});
type.addEventListener('change',()=>requestId=null);
form.addEventListener('submit',async event=>{
 event.preventDefault();if(saving)return;
 if(!name.value.trim()){name.setCustomValidity('Enter a name.');name.reportValidity();return;}
 saving=true;updateSaving();$('#new-lore-fields').disabled=true;$('#create-lore').disabled=true;$('#cancel-lore').disabled=true;$('#new-lore-error').hidden=true;
 requestId??=crypto.randomUUID();
 try{const record=await api({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:requestId,type:type.value,name:name.value})});location.assign(loreHref(record));}
 catch(e){$('#new-lore-error').textContent=e.message;$('#new-lore-error').hidden=false;}
 finally{saving=false;updateSaving();$('#new-lore-fields').disabled=false;$('#create-lore').disabled=false;$('#cancel-lore').disabled=false;}
});
quick.addEventListener('input',()=>{quick.setCustomValidity('');noteId=null;});
$('#quick-note').addEventListener('submit',async event=>{
 event.preventDefault();if(saving)return;
 const text=quick.value.trim();if(!text){quick.setCustomValidity('Write a note first.');quick.reportValidity();return;}
 saving=true;updateSaving();$('#capture-error').hidden=true;$('#capture-status').hidden=true;noteId??=crypto.randomUUID();
 try{
  const record=await api({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:noteId,type:'note',name:text.split('\n')[0].slice(0,100),body:text,summary:text.slice(0,180)})});
  quick.value='';noteId=null;announceWorkspaceChange();
  const status=$('#capture-status'),link=el('a','','Open note →');link.href=loreHref(record);
  status.replaceChildren(document.createTextNode('Note saved.'),link);status.hidden=false;
  setCapture(false,false);await dashboard.refresh();
 }
 catch(e){$('#capture-error').textContent=e.message;$('#capture-error').hidden=false;}
 finally{saving=false;updateSaving();if(capture.hidden)$('#toggle-note').focus();}
});
window.addEventListener('beforeunload',event=>{if(quick.value.trim()){event.preventDefault();event.returnValue='';}});
