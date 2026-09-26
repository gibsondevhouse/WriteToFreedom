import {initDirectoryShell,fetchDirectory} from '../directory/shell.js?v=__WTF_ASSET_REVISION__';
import {bookCoverCard,factionCard,locationCard,loreEntryCard,noteCard} from '../dashboard/components.js?v=__WTF_ASSET_REVISION__';
import {createCharacterCard} from '../components/character-card/card.js?v=__WTF_ASSET_REVISION__';
import {createProfileStoryCard} from '../components/story-card/profile-card.js?v=__WTF_ASSET_REVISION__';
import {createStoryCardFrame,createStoryCardAction} from '../components/story-card/card.js?v=__WTF_ASSET_REVISION__';
import {validateCollectionRules,smartKinds} from './rules.js?v=__WTF_ASSET_REVISION__';
import {typeLabels} from '../locations/data.js?v=__WTF_ASSET_REVISION__';
import {loreTypes} from '../lore/template.js?v=__WTF_ASSET_REVISION__';
import {announceWorkspaceChange,observeWorkspaceChanges} from '../profiles/workspace-events.js?v=__WTF_ASSET_REVISION__';

const initial=JSON.parse(document.querySelector('#collection-data').textContent),detail=Boolean(initial);
let collection=initial,ruleSummary='',draftOrder=[],savedOrder=[],orderDirty=false,orderBaseVersion=initial?.version;
let sources=[],mutationBusy=false,editDirty=false,editBaseVersion,editSession='',pendingCreateId;
const key=ref=>[ref.kind,ref.characterId||'',ref.id].join(':');
const ref=entry=>({kind:entry.kind,id:entry.id,...(entry.kind==='note'?{characterId:entry.characterId}:{})});
const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};
const kindLabel={character:'Character',faction:'Faction',location:'Location',lore:'Lore',story_arc:'Story arc',note:'Character note',novel:'Novel',series:'Series',chapter:'Chapter',scene:'Scene'};
const collectionUrl=id=>'/collections/'+encodeURIComponent(id)+'/';
const abort=new AbortController();
function setMutationBusy(value){
 mutationBusy=value;
 for(const control of document.querySelectorAll('#edit-collection,#add-collection-member,#save-collection-order,#delete-collection,#collection-edit-form [type=submit],#collection-member-form [type=submit]'))control.disabled=value;
 syncOrder();
}

async function mutate(path,method,body){
 const response=await fetch(path,{method,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:abort.signal});
 if(response.status===204)return null;
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Copy your changes before reloading to sign in again.');
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save this collection. Your draft is still here.');return data;
}
async function loadSources(){
 const data=await fetchDirectory('/api/library',{signal:abort.signal});
 if(!Array.isArray(data.entries))throw new Error('Your library returned an invalid list.');sources=data.entries;return sources;
}
function listEntry(record){
 const link=node('a','collection-list-entry'),copy=node('span','collection-list-copy');link.href=record.href;
 copy.append(node('strong','',record.name));if(record.summary)copy.append(node('small','',record.summary));
 link.append(copy,node('span','collection-list-kind',record.label||kindLabel[record.kind]||'Entry'));return link;
}
function entryCard(record){
 if(record.kind==='character')return createCharacterCard(record,{headingLevel:2,onAction:()=>location.assign(record.href)});
 if(record.kind==='faction')return factionCard(record);
 if(record.kind==='location')return locationCard(record);
 if(record.kind==='lore')return loreEntryCard(record);
 if(record.kind==='note')return noteCard({...record,contextual:true});
 if(['novel','series','collection'].includes(record.kind))return bookCoverCard(record,{menuItems:[{label:record.kind==='collection'?'Open collection':'Open profile',href:record.href},...(record.kind==='novel'?[{label:'Write scenes',href:'/scenes/?novel='+encodeURIComponent(record.id)}]:[])]});
 if(['chapter','scene'].includes(record.kind)){
  const context=node('a','affiliation-copy');context.href=record.href;
  context.append(node('span','affiliation-kind','Manuscript'),node('strong','',record.summary||'Open the writing workspace.'));
  return createStoryCardFrame(record,{headingLevel:2,eyebrow:record.label||kindLabel[record.kind],profileLabel:'Open '+record.name+' in the writing workspace',context:[context],actions:[createStoryCardAction({href:record.href,label:'Write scenes for '+record.name,title:'Write scenes',icon:'story',text:'Write scenes'})],menuItems:[{label:'Open writing workspace',href:record.href}],cardClass:'collection-profile-card'});
 }
 return createProfileStoryCard(record,{headingLevel:2,label:record.label||kindLabel[record.kind],contextText:record.summary||'Open this entry.',sections:[],cardClass:'collection-profile-card'});
}
function syncOrder(){
 const save=document.querySelector('#save-collection-order');
 if(save){save.hidden=!orderDirty;save.disabled=mutationBusy;}
 const summary=document.querySelector('#collection-rule-summary');
 if(summary)summary.textContent=ruleSummary+(orderDirty?' · Unsaved collection order.':'');
}
function moveEntry(entry,direction){
 if(mutationBusy)return;
 if(!orderDirty){draftOrder=directory.records.map(key);savedOrder=[...draftOrder];orderBaseVersion=collection.version;}
 const index=draftOrder.indexOf(key(entry)),next=index+direction;
 if(next<0||next>=draftOrder.length)return;
 [draftOrder[index],draftOrder[next]]=[draftOrder[next],draftOrder[index]];
 orderDirty=draftOrder.some((value,i)=>value!==savedOrder[i]);syncOrder();directory.render();
}
function manualControls(entry,state){
 const controls=node('div','collection-entry-controls'),remove=node('button','','Remove from collection');remove.type='button';
 remove.setAttribute('aria-label','Remove '+entry.name+' from collection');remove.disabled=mutationBusy;
 remove.addEventListener('click',async()=>{
  if(mutationBusy)return;setMutationBusy(true);remove.disabled=true;directory.clearError();const version=collection.version;
  try{
   const saved=await mutate('/api/collections/'+collection.id+'/members','DELETE',{version,ref:ref(entry)});
   collection=saved;
   if(orderDirty){draftOrder=draftOrder.filter(value=>value!==key(entry));savedOrder=savedOrder.filter(value=>value!==key(entry));if(orderBaseVersion===version)orderBaseVersion=saved.version;}
   announceWorkspaceChange();await directory.refresh();
  }catch(error){directory.showError(error);}
  finally{setMutationBusy(false);directory.render();}
 });
 controls.append(remove);
 const canOrder=!state.query.trim()&&state.sort==='order'&&!state.reversed;
 if(canOrder){
  const order=orderDirty?draftOrder:directory.records.map(key),index=order.indexOf(key(entry));
  for(const [label,delta] of [['earlier',-1],['later',1]]){
   const button=node('button','collection-move',delta<0?'↑':'↓');button.type='button';button.setAttribute('aria-label','Move '+entry.name+' '+label);
   button.disabled=mutationBusy||(delta<0?index===0:index===order.length-1);button.addEventListener('click',()=>moveEntry(entry,delta));controls.append(button);
  }
 }
 return controls;
}

const directory=initDirectoryShell({
 async load(options){
  if(!detail){const data=await fetchDirectory('/api/collections',options);return Array.isArray(data)?data:data.collections;}
  const [metadata,payload]=await Promise.all([fetchDirectory('/api/collections/'+initial.id,options),fetchDirectory('/api/collections/'+initial.id+'/entries',options)]);
  if(!Array.isArray(payload.entries))throw new Error('This collection returned an invalid list.');
  collection=metadata;ruleSummary=payload.ruleSummary||'';
  if(!orderDirty){draftOrder=payload.entries.map(key);savedOrder=[...draftOrder];orderBaseVersion=metadata.version;}
  syncOrder();return payload.entries;
 },
 select(records,{query,sort,reversed}){
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches=records.filter(record=>terms.every(term=>[record.name,record.summary,record.label,record.kind,record.type,record.parent].filter(Boolean).join(' ').toLocaleLowerCase().includes(term)));
  if(sort==='name')matches.sort((a,b)=>a.name.localeCompare(b.name));
  else if(detail&&orderDirty){const positions=new Map(draftOrder.map((value,index)=>[value,index]));matches.sort((a,b)=>(positions.get(key(a))??100000)-(positions.get(key(b))??100000));}
  return reversed?matches.reverse():matches;
 },
 renderItem(record,state){
  const display=detail?record:{...record,kind:'collection',label:record.kind==='smart'?'Smart collection':'Manual collection',href:collectionUrl(record.id),image:record.coverUrl||''};
  const wrapper=node('article','collection-entry');wrapper.dataset.libraryKey=detail?key(record):record.id;
  wrapper.append(state.view==='list'?listEntry(display):entryCard(display));
  if(detail&&collection.kind==='manual')wrapper.append(manualControls(record,state));return wrapper;
 }
});

document.querySelector('#save-collection-order')?.addEventListener('click',async()=>{
 if(mutationBusy||!orderDirty)return;setMutationBusy(true);directory.clearError();
 try{
  collection=await mutate('/api/collections/'+collection.id,'PUT',{version:orderBaseVersion,order:draftOrder});
  orderDirty=false;orderBaseVersion=collection.version;savedOrder=[...draftOrder];announceWorkspaceChange();await directory.refresh();
 }catch(error){directory.showError(error);}
 finally{setMutationBusy(false);directory.render();}
});

const editor=document.querySelector('#collection-editor'),editForm=document.querySelector('#collection-edit-form'),editError=document.querySelector('#collection-edit-error');
const ruleHost=document.querySelector('#collection-rule-rows'),ruleSection=document.querySelector('#collection-rule-editor'),ruleRows=[];
const ruleFields=[['entityType','Entry type'],['subtype','Location or Lore subtype'],['linkedNovel','Linked novel'],['series','Series through its novels'],['minNovelCount','Number of linked novels'],['unassigned','Unassigned to any novel']];
function selectControl(options,value,label){
 const select=node('select');select.setAttribute('aria-label',label);
 for(const [id,title] of options)select.append(new Option(title,id));
 if(value&&!options.some(([id])=>id===value))select.append(new Option('Existing selection: '+value,value));
 select.value=value||options[0]?.[0]||'';return select;
}
function readRule(source){
 const field=source.field.value;if(field==='unassigned')return {field};
 return {field,value:field==='minNovelCount'?Number(source.value.value):source.value.value,...(field==='subtype'?{kind:source.kind.value}:{})};
}
function ruleValue(source,rule){
 source.values.replaceChildren();source.value=null;source.kind=null;
 const field=source.field.value;
 if(field==='unassigned'){source.values.append(node('span','collection-rule-hint','Matches entries with no novel links.'));return;}
 if(field==='entityType')source.value=selectControl(smartKinds.map(kind=>[kind,kindLabel[kind]]),rule.value,'Entry type');
 else if(field==='subtype'){
  source.kind=selectControl([['location','Location'],['lore','Lore']],rule.kind||'location','Subtype family');
  const options=()=>Object.entries(source.kind.value==='location'?typeLabels:loreTypes).map(([id,label])=>[id,label]);
  source.value=selectControl(options(),rule.value,'Subtype');source.values.append(source.kind);
  source.kind.addEventListener('change',()=>{source.value.replaceChildren(...options().map(([id,label])=>new Option(label,id)));});
 }else if(field==='linkedNovel'||field==='series'){
  const kind=field==='linkedNovel'?'novel':'series';source.value=selectControl([['','Choose a '+kind+'…'],...sources.filter(entry=>entry.kind===kind).map(entry=>[entry.id,entry.name])],rule.value,kind==='novel'?'Linked novel':'Series');
 }else{
  source.value=node('input');source.value.type='number';source.value.min='0';source.value.max='1000';source.value.step='1';source.value.value=String(rule.value??2);source.value.setAttribute('aria-label','Minimum linked novel count');
 }
 source.values.append(source.value);
}
function addRule(rule={field:'entityType',value:'character'},dirty=true){
 const row=node('div','collection-rule-row'),field=selectControl(ruleFields,rule.field,'Criterion'),values=node('div','collection-rule-values'),remove=node('button','collection-rule-remove','Remove');
 remove.type='button';remove.setAttribute('aria-label','Remove criterion');const source={row,field,values,value:null,kind:null};ruleRows.push(source);
 row.append(field,values,remove);ruleHost.append(row);ruleValue(source,rule);
 field.addEventListener('change',()=>ruleValue(source,{field:field.value}));
 remove.addEventListener('click',()=>{ruleRows.splice(ruleRows.indexOf(source),1);row.remove();editDirty=true;});
 if(dirty)editDirty=true;
}
function showRuleEditor(){ruleSection.hidden=editForm.elements.namedItem('kind').value!=='smart';}
editForm.elements.namedItem('kind').addEventListener('change',()=>{showRuleEditor();if(!ruleRows.length)addRule();});
document.querySelector('#add-collection-rule').addEventListener('click',()=>{if(ruleRows.length>=8){editError.hidden=false;editError.textContent='Use at most eight criteria.';return;}addRule();});
editForm.addEventListener('input',()=>editDirty=true);editForm.addEventListener('change',()=>editDirty=true);
document.querySelector('#edit-collection').addEventListener('click',async()=>{
 const session=detail?collection.id:'new';
 try{await loadSources();}catch(error){editError.hidden=false;editError.textContent=error.message;}
 if(editSession!==session||!editDirty){
  editSession=session;editBaseVersion=collection?.version;editForm.elements.namedItem('name').value=collection?.name||'';editForm.elements.namedItem('summary').value=collection?.summary||'';editForm.elements.namedItem('coverUrl').value=collection?.coverUrl||'';
  const kind=editForm.elements.namedItem('kind');kind.value=collection?.kind||'manual';kind.disabled=detail||Boolean(pendingCreateId);
  editForm.elements.namedItem('ruleMode').value=collection?.rules?.mode||'all';ruleRows.length=0;ruleHost.replaceChildren();
  for(const rule of collection?.rules?.predicates||[{field:'entityType',value:'character'}])addRule(rule,false);
  showRuleEditor();editDirty=false;
 }
 document.querySelector('#collection-editor-title').textContent=detail?'Edit collection':'New collection';document.querySelector('#delete-collection').hidden=!detail;
 editor.showModal();editForm.elements.namedItem('name').focus();
});
document.querySelector('[data-close-collection]').addEventListener('click',()=>editor.close());
editForm.addEventListener('submit',async event=>{
 event.preventDefault();if(mutationBusy||!editForm.reportValidity())return;
 const kind=editForm.elements.namedItem('kind').value;
 const payload={name:editForm.elements.namedItem('name').value,summary:editForm.elements.namedItem('summary').value,coverUrl:editForm.elements.namedItem('coverUrl').value};
 try{if(kind==='smart')payload.rules=validateCollectionRules({version:1,mode:editForm.elements.namedItem('ruleMode').value,predicates:ruleRows.map(readRule)});}catch(error){editError.hidden=false;editError.textContent=error.message;return;}
 setMutationBusy(true);editError.hidden=true;
 try{
  let saved;
  if(detail)saved=await mutate('/api/collections/'+collection.id,'PUT',{...payload,version:editBaseVersion});
  else{
   pendingCreateId??=crypto.randomUUID();editForm.elements.namedItem('kind').disabled=true;
   saved=await mutate('/api/collections','POST',{...payload,id:pendingCreateId,kind});
   if(saved.name!==payload.name.trim()||saved.summary!==payload.summary||saved.coverUrl!==payload.coverUrl||kind==='smart'&&JSON.stringify(saved.rules)!==JSON.stringify(payload.rules)){
    if(saved.version!==1)throw new Error('This collection changed after it was created. Your draft is still here; open its saved version before editing it.');
    saved=await mutate('/api/collections/'+saved.id,'PUT',{...payload,version:saved.version});
   }
  }
  const priorVersion=editBaseVersion;collection=saved;editDirty=false;editBaseVersion=saved.version;editor.close();announceWorkspaceChange();
  if(!detail){location.assign(collectionUrl(saved.id));return;}
  if(orderDirty&&orderBaseVersion===priorVersion)orderBaseVersion=saved.version;
  document.querySelector('#collections-directory-title').textContent=saved.name;document.title=saved.name+' — Write to Freedom';
  let intro=document.querySelector('.directory-intro');if(!intro){intro=node('p','directory-intro');document.querySelector('.directory-heading').append(intro);}intro.textContent=saved.summary;await directory.refresh();
 }catch(error){editError.hidden=false;editError.textContent=error.message;}
 finally{setMutationBusy(false);directory.render();}
});
document.querySelector('#delete-collection').addEventListener('click',async()=>{
 if(mutationBusy||!collection||!confirm('Remove this collection? Its original entries will stay in your library.'))return;
 setMutationBusy(true);editError.hidden=true;
 try{await mutate('/api/collections/'+collection.id,'DELETE',{version:editBaseVersion});editDirty=false;orderDirty=false;location.assign('/collections/');}
 catch(error){editError.hidden=false;editError.textContent=error.message;setMutationBusy(false);}
});

const memberDialog=document.querySelector('#collection-member-picker'),memberForm=document.querySelector('#collection-member-form'),memberSelect=document.querySelector('#collection-member-target'),memberError=document.querySelector('#collection-member-error');
document.querySelector('#add-collection-member')?.addEventListener('click',async()=>{
 if(mutationBusy)return;memberError.hidden=true;memberSelect.replaceChildren(new Option('Loading your library…',''));memberSelect.disabled=true;memberDialog.showModal();
 try{
  await loadSources();const existing=new Set(directory.records.map(key));memberSelect.replaceChildren(new Option('Choose an entry…',''));
  const groups=new Map();for(const entry of sources.filter(entry=>!existing.has(key(entry)))){if(!groups.has(entry.kind)){const group=node('optgroup');group.label=kindLabel[entry.kind];groups.set(entry.kind,group);memberSelect.append(group);}groups.get(entry.kind).append(new Option(entry.name+(entry.parent?' · '+entry.parent:''),key(entry)));}
 }catch(error){memberError.hidden=false;memberError.textContent=error.message;}
 finally{memberSelect.disabled=false;if(memberDialog.open)memberSelect.focus();}
});
document.querySelector('[data-close-member]').addEventListener('click',()=>memberDialog.close());
memberForm.addEventListener('submit',async event=>{
 event.preventDefault();if(mutationBusy||!memberForm.reportValidity())return;
 const entry=sources.find(entry=>key(entry)===memberSelect.value);if(!entry){memberError.hidden=false;memberError.textContent='Choose an entry from your library.';return;}
 setMutationBusy(true);const version=collection.version;memberError.hidden=true;
 try{
  collection=await mutate('/api/collections/'+collection.id+'/members','POST',{version,ref:ref(entry)});
  if(orderDirty){if(!draftOrder.includes(key(entry)))draftOrder.push(key(entry));savedOrder.push(key(entry));if(orderBaseVersion===version)orderBaseVersion=collection.version;}
  memberDialog.close();announceWorkspaceChange();await directory.refresh();
 }catch(error){memberError.hidden=false;memberError.textContent=error.message;}
 finally{setMutationBusy(false);directory.render();}
});
window.addEventListener('beforeunload',event=>{if(editDirty||orderDirty){event.preventDefault();event.returnValue='';}});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'&&(editor.open||orderDirty)){event.preventDefault();if(editor.open)editForm.requestSubmit();else document.querySelector('#save-collection-order')?.click();}});
const stopWatching=observeWorkspaceChanges(()=>{if(!mutationBusy)directory.refresh();});
window.addEventListener('pagehide',event=>{if(!event.persisted){abort.abort();stopWatching();}});
