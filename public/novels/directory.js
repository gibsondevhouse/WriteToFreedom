import {initDirectoryShell,fetchDirectory} from '../directory/shell.js?v=__WTF_ASSET_REVISION__';
import {bookCoverCard} from '../dashboard/components.js?v=__WTF_ASSET_REVISION__';

const root=document.querySelector('[data-directory-shell]');
const novel=root.id==='novels-directory',kind=novel?'novel':'series',plural=novel?'novels':'series';
const endpoint='/api/'+plural;
const title=record=>record.title||'Untitled '+kind;
const href=record=>'/'+plural+'/'+encodeURIComponent(record.id)+'/';
const status=record=>record.status?record.status[0].toUpperCase()+record.status.slice(1):'';
const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};

function listEntry(record){
 const link=node('a','novel-list-entry'),copy=node('span','novel-list-copy'),name=node('strong','',title(record));
 link.href=href(record);
 copy.append(name);
 const summary=(novel?record.synopsis:record.summary)||'';
 if(summary)copy.append(node('small','',summary));
 link.append(copy,node('span','novel-list-status',novel?status(record):'Series'));
 return link;
}

const directory=initDirectoryShell({
 root,
 async load(options){
  const response=await fetchDirectory(endpoint,options);
  const records=Array.isArray(response)?response:response[plural];
  if(!Array.isArray(records))throw new Error('Your '+plural+' could not be loaded.');
  return records;
 },
 select(records,{query,sort,reversed}){
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches=records.filter(record=>{
   const text=[record.title,record.synopsis,record.summary,record.status].filter(Boolean).join(' ').toLocaleLowerCase();
   return terms.every(term=>text.includes(term));
  });
  if(sort==='name')matches.sort((a,b)=>title(a).localeCompare(title(b)));
  return reversed?matches.reverse():matches;
 },
 renderItem(record,{view}){
  if(view==='list')return listEntry(record);
  const url=href(record);
  return bookCoverCard({id:record.id,name:title(record),label:novel?(status(record)||'Novel'):'Series',type:kind,href:url,image:record.coverUrl||'',summary:record.synopsis||record.summary||''},{menuItems:[{label:'Open profile',href:url},...(novel?[{label:'Write scenes',href:'/scenes/?novel='+encodeURIComponent(record.id)}]:[])]});
 }
});

const button=document.querySelector('#new-'+kind),dialog=document.querySelector('#create-'+kind+'-dialog'),form=document.querySelector('#create-'+kind+'-form');
const createError=document.querySelector('#create-'+kind+'-error');
let pendingId,creating=false;
button.addEventListener('click',()=>{dialog.showModal();form.elements.namedItem('title').focus();});
dialog.querySelector('[data-cancel-create]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{if(!creating){form.reset();pendingId=undefined;createError.hidden=true;createError.textContent='';}});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(creating||!form.reportValidity())return;
 const title=form.elements.namedItem('title').value.trim();
 if(!title){form.elements.namedItem('title').setCustomValidity('Enter a title.');form.reportValidity();return;}
 creating=true;pendingId??=crypto.randomUUID();
 const submit=form.querySelector('[type=submit]');submit.disabled=true;createError.hidden=true;
 try{
  const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id:pendingId,title})});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');
  let data=await response.json();if(!response.ok)throw new Error(data.error||'Could not create this '+kind+'.');
  const normalizedTitle=title.replace(/\s+/g,' ');
  if(data.title!==normalizedTitle){
   if(data.version!==1)throw new Error('This '+kind+' changed after it was created. Your title is still here; open its profile before changing the saved version.');
   const updated=await fetch(endpoint+'/'+data.id,{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({version:data.version,title:normalizedTitle})});
   if(!updated.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Your title is still here.');
   data=await updated.json();if(!updated.ok)throw new Error(data.error||'Could not save your revised title.');
  }
  location.assign(href(data));
 }catch(error){createError.textContent=error.message;createError.hidden=false;creating=false;submit.disabled=false;}
});
form.elements.namedItem('title').addEventListener('input',event=>event.target.setCustomValidity(''));
window.addEventListener('pageshow',event=>{if(event.persisted){creating=false;pendingId=undefined;form.querySelector('[type=submit]').disabled=false;}});
window.addEventListener('beforeunload',event=>{if(!creating&&dialog.open&&form.elements.namedItem('title').value.trim()){event.preventDefault();event.returnValue='';}});
