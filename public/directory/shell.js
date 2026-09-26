import {scopedCatalogUrl,showCatalogScope} from '../profiles/novel-context.js?v=__WTF_ASSET_REVISION__';
export async function fetchDirectory(url,{signal,errorMessage='Your entries could not be loaded.'}={}){
 const response=await fetch(scopedCatalogUrl(url),{credentials:'same-origin',cache:'no-store',signal});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');
 const data=await response.json();if(!response.ok)throw new Error(data.error||errorMessage);showCatalogScope(data.scope);return data;
}

/** Owns directory controls, reads and replaceable items. Adapters own domain data and writes. */
export function initDirectoryShell({
 root=document.querySelector('[data-directory-shell]'),load,select=records=>records,renderItem,
 onData=()=>{},onReset=()=>{},isFiltered=()=>false,autoload=true
}){
 if(!root||typeof load!=='function'||typeof renderItem!=='function')throw new Error('A directory root, loader and item renderer are required.');
 const find=name=>root.querySelector('[data-directory-'+name+']');
 const search=find('search'),sort=find('sort'),view=find('view'),direction=find('direction'),clear=find('clear'),reset=find('reset');
 const list=find('list'),results=find('results'),count=find('count'),empty=find('empty'),error=find('error'),message=find('error-message'),retry=find('retry');
 const controls=[search,sort,view,direction].filter(Boolean),listeners=[],abort=new AbortController();
 let records=[],hasData=false,reversed=false,pending=null,queued=false,destroyed=false,itemCleanup=[];
 let loadError='',actionError='';
 const state=()=>({query:search.value,sort:sort?.value||'order',view:view?.value||'cards',reversed});
 const listen=(node,type,handler)=>{node?.addEventListener(type,handler);listeners.push(()=>node?.removeEventListener(type,handler));};
 function syncError(){
  message.textContent=[actionError,loadError].filter(Boolean).join(' ');error.hidden=!message.textContent;retry.hidden=!loadError;
  root.dataset.directoryState=message.textContent?'error':hasData?'ready':'loading';
 }
 function clearError({loadOnly=false}={}){loadError='';if(!loadOnly)actionError='';syncError();}
 function showError(reason,{retryable=false}={}){
  if(destroyed)return;
  if(retryable)loadError=reason?.message||String(reason);else actionError=reason?.message||String(reason);
  syncError();
 }
 function paint(){
  if(destroyed||!hasData)return;
  const filters=state(),matches=select(records,filters),cleanup=[],rows=[];
  try{
   for(const [index,record] of matches.entries()){
    const rendered=renderItem(record,filters,index),item=document.createElement('li');item.className='directory-item';
    if(rendered?.element){item.append(rendered.element);if(rendered.destroy)cleanup.push(()=>rendered.destroy());}
    else item.append(rendered);
    rows.push(item);
   }
  }catch(reason){cleanup.forEach(dispose=>dispose());throw reason;}
  itemCleanup.forEach(dispose=>dispose());itemCleanup=cleanup;list.replaceChildren(...rows);list.dataset.view=filters.view;
  const filtered=Boolean(filters.query.trim())||isFiltered(filters)||matches.length!==records.length;
  const noun=records.length===1?root.dataset.singular:root.dataset.plural;
  count.textContent=filtered?`${matches.length} of ${records.length} ${noun}`:records.length?`1–${records.length} of ${records.length} ${noun}`:`0 ${root.dataset.plural}`;
  clear.hidden=!search.value;empty.hidden=matches.length>0;list.hidden=!matches.length;
  find('empty-title').textContent=empty.dataset[filtered?'filteredTitle':'emptyTitle'];
  find('empty-description').textContent=empty.dataset[filtered?'filteredDescription':'emptyDescription'];
  reset.hidden=!filtered;
 }
 function render(){try{paint();}catch(reason){showError(reason);}}
 async function read(){
  let loaded=false;
  do{
   queued=false;
   try{
    const next=await load({signal:abort.signal});if(destroyed)return false;if(queued)continue;
    if(!Array.isArray(next))throw new Error('The directory returned an invalid list.');
    const previous=records,previousReady=hasData;records=next;hasData=true;
    try{paint();}catch(reason){records=previous;hasData=previousReady;throw reason;}
    onData(records);clearError({loadOnly:true});loaded=true;
   }catch(reason){
    loaded=false;
    if(!destroyed&&!queued){showError(reason,{retryable:true});if(!hasData){count.textContent='Unable to load '+root.dataset.plural;empty.hidden=true;}}
   }
  }while(queued&&!destroyed);
  return loaded&&!destroyed;
 }
 function refresh(){
  if(destroyed)return Promise.resolve(false);
  if(pending){queued=true;return pending;}
  clearError({loadOnly:true});retry.disabled=true;results.setAttribute('aria-busy','true');
  controls.forEach(control=>control.disabled=!hasData);root.dataset.directoryState=hasData?'refreshing':'loading';
  if(!hasData)count.textContent='Loading '+root.dataset.plural+'…';
  pending=Promise.resolve().then(read).finally(()=>{
   pending=null;if(destroyed)return;
   retry.disabled=false;controls.forEach(control=>control.disabled=!hasData);results.setAttribute('aria-busy','false');
  });return pending;
 }
 function resetSearch(all=false){search.value='';if(all)onReset();render();search.focus();}
 listen(search,'input',render);listen(sort,'change',render);listen(view,'change',render);
 listen(direction,'click',()=>{reversed=!reversed;direction.setAttribute('aria-pressed',String(reversed));const label=reversed?'Restore forward list order':'Reverse list order';direction.setAttribute('aria-label',label);direction.title=label;render();});
 listen(clear,'click',()=>resetSearch());listen(reset,'click',()=>resetSearch(true));listen(retry,'click',refresh);
 listen(window,'pageshow',event=>{if(event.persisted)refresh();});
 listen(window,'pagehide',event=>{if(!event.persisted)destroy();});
 function destroy(){
  if(destroyed)return;destroyed=true;queued=false;abort.abort();listeners.forEach(remove=>remove());itemCleanup.forEach(dispose=>dispose());itemCleanup=[];results.setAttribute('aria-busy','false');
 }
 if(autoload)refresh();
 return {root,refresh,render,showError,clearError,destroy,get records(){return records;},get state(){return state();}};
}
