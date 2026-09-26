import {initProfileEditor} from '../profiles/editor.js?v=__WTF_ASSET_REVISION__';
import {announceWorkspaceChange} from '../profiles/workspace-events.js?v=__WTF_ASSET_REVISION__';

const initial=JSON.parse(document.querySelector('#profile-data').textContent);
const novel=initial.kind==='novel';
const form=document.querySelector('#profile-form');
const validImageUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}};
let seriesVersion=initial.version,orderBusy=false;
let saveOrderDraft=async()=>{};

const editor=initProfileEditor({
 fieldNames:novel?['title','synopsis','status','coverUrl','seriesId','seriesOrder']:['title','summary','coverUrl'],
 endpoint:novel?'/api/novels':'/api/series',type:novel?'novel':'series',nameField:'title',
 imageFields:['coverUrl'],validImageUrl,
 readExtra(){if(orderBusy)throw new Error('Wait for the book order to finish saving.');return novel?{seriesOrder:Number(form.elements.namedItem('seriesOrder').value)}:{};},
 async onSaved(data){
  seriesVersion=data.version;
  const caption=document.querySelector('.novel-cover figcaption');if(caption)caption.textContent=data.title;
  await saveOrderDraft(true);
 }
});

if(novel){
 const picker=document.querySelector('#novel-link-target'),add=document.querySelector('#add-novel-association'),status=document.querySelector('#novel-association-status');
 const targets=new Map(initial.targets.map(target=>[target.kind+':'+target.id,target]));
 const linked=new Set(initial.associations.map(item=>item.targetKind+':'+item.targetId));
 const associationKeys=new Map(initial.associations.map(item=>[item.id,item.targetKind+':'+item.targetId]));
 const associationVersions=new Map(initial.associations.map(item=>[item.id,item.version]));
 let busy=false;
 function group(kind){return document.querySelector('[data-association-group="'+kind+'"]');}
 function message(value,error=false){status.textContent=value;status.dataset.error=String(error);}
 function addItem(association){
  const key=association.targetKind+':'+association.targetId,target=targets.get(key),container=group(association.targetKind);
  if(!container)return;
  const row=document.createElement('li'),link=document.createElement('a'),remove=document.createElement('button');
  row.dataset.associationId=association.id;
  if(target){link.href=target.href;link.textContent=target.label;row.append(link);}
  else row.append(document.createTextNode('Unavailable reference'));
  remove.type='button';remove.dataset.removeAssociation=association.id;
  remove.setAttribute('aria-label','Remove '+(target?.label||'reference')+' from this novel');remove.textContent='Remove';
  row.append(' ',remove);container.querySelector('ul').append(row);
  container.querySelector('[data-group-empty]')?.remove();
  linked.add(key);
  associationKeys.set(association.id,key);
  associationVersions.set(association.id,association.version);
 }
 picker.addEventListener('input',event=>event.stopPropagation());
 picker.addEventListener('change',event=>event.stopPropagation());
 add.addEventListener('click',async()=>{
  if(busy)return;
  const key=picker.value,target=targets.get(key);
  if(!target){message('Choose an existing entry.',true);picker.focus();return;}
  if(linked.has(key)){message('This entry is already linked to the novel.');return;}
  busy=true;add.disabled=true;message('Linking entry…');
  try{
   const relationKind=['lore','story_arc'].includes(target.kind)?'referenced_by':'appears_in';
   const response=await fetch('/api/novels/'+encodeURIComponent(initial.id)+'/associations',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),targetKind:target.kind,targetId:target.id,relationKind,prose:''})});
   if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');
   const association=await response.json();if(!response.ok)throw new Error(association.error||'Could not link this entry.');
   addItem(association);picker.value='';message('Entry linked.');announceWorkspaceChange();
  }catch(error){message(error.message,true);}
  finally{busy=false;add.disabled=false;}
 });
 form.addEventListener('click',async event=>{
  const button=event.target.closest('[data-remove-association]');if(!button||busy)return;
  const row=button.closest('[data-association-id]'),id=button.dataset.removeAssociation;
  busy=true;button.disabled=true;message('Removing link…');
  try{
   const response=await fetch('/api/novels/'+encodeURIComponent(initial.id)+'/associations/'+encodeURIComponent(id),{method:'DELETE',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({version:associationVersions.get(id)})});
   if(!response.ok){
    let detail;try{detail=await response.json();}catch{}
    throw new Error(detail?.error||'Could not remove this link.');
   }
   const key=associationKeys.get(id);if(key)linked.delete(key);associationKeys.delete(id);associationVersions.delete(id);
   const container=row.closest('[data-association-group]');row.remove();
   if(!container.querySelector('li')){const empty=document.createElement('p');empty.className='section-note';empty.dataset.groupEmpty='';empty.textContent='No entries linked yet.';container.append(empty);}
   message('Link removed.');announceWorkspaceChange();
  }catch(error){button.disabled=false;message(error.message,true);}
  finally{busy=false;}
 });
}

if(!novel&&initial.novelIds?.length>1){
 const list=document.querySelector('#series-books'),save=document.querySelector('#save-series-order'),status=document.querySelector('#series-order-status');
 const profileSave=document.querySelector('#save-character');
 let savedOrder=[...initial.novelIds],orderDirty=false;
 const order=()=>[...list.children].map(row=>row.dataset.seriesNovel);
 function updateOrderControls(){
  const rows=[...list.children];rows.forEach((row,index)=>{row.querySelector('[data-series-move=up]').disabled=orderBusy||index===0;row.querySelector('[data-series-move=down]').disabled=orderBusy||index===rows.length-1;});
  orderDirty=order().some((id,index)=>id!==savedOrder[index]);save.disabled=orderBusy||!orderDirty;
 }
 list.addEventListener('click',event=>{
  const button=event.target.closest('[data-series-move]');if(!button||orderBusy)return;
  const row=button.closest('[data-series-novel]');
  if(button.dataset.seriesMove==='up'&&row.previousElementSibling)list.insertBefore(row,row.previousElementSibling);
  else if(button.dataset.seriesMove==='down'&&row.nextElementSibling)list.insertBefore(row,row.nextElementSibling.nextSibling);
  updateOrderControls();status.textContent=orderDirty?'Unsaved book order.':'Book order is saved.';status.dataset.error='false';
  button.focus();
 });
 saveOrderDraft=async(fromProfile=false)=>{
  if(orderBusy||!orderDirty)return;
  orderBusy=true;updateOrderControls();profileSave.disabled=true;status.textContent='Saving book order…';status.dataset.error='false';
  try{
   const response=await fetch('/api/series/'+encodeURIComponent(initial.id)+'/order',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({version:seriesVersion,novelIds:order()})});
   if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Copy your changes before reloading to sign in again.');
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save the book order.');
   seriesVersion=data.series.version;editor.setVersion(seriesVersion);savedOrder=order();status.textContent='Book order is saved.';announceWorkspaceChange();
  }catch(error){status.textContent=error.message+' Your order is still here.';status.dataset.error='true';if(fromProfile)throw error;}
  finally{orderBusy=false;if(!fromProfile)profileSave.disabled=false;updateOrderControls();}
 };
 save.addEventListener('click',()=>saveOrderDraft());
 window.addEventListener('beforeunload',event=>{if(orderDirty){event.preventDefault();event.returnValue='';}});
}
