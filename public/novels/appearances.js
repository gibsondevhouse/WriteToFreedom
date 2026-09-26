import {announceWorkspaceChange} from '../profiles/workspace-events.js?v=__WTF_ASSET_REVISION__';

const relationLabels={appears_in:'Appears in',referenced_by:'Referenced by',linked:'Linked to'};
const node=(tag,text,className)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;};
const novelHref=id=>'/novels/'+encodeURIComponent(id)+'/';

/** Association drafts and revisions belong to this dialog, never profile-form. */
export function initNovelAppearances(){
 const source=document.querySelector('#novel-appearances-data');if(!source||source.dataset.initialized)return;
 source.dataset.initialized='true';
 const initial=JSON.parse(source.textContent),novels=new Map(initial.novels.map(novel=>[novel.id,novel]));
 const associations=new Map(initial.associations.map(association=>[association.id,association])),drafts=new Map();
 const dialog=document.querySelector('#novel-appearance-dialog'),form=document.querySelector('#novel-appearance-form'),fields=document.querySelector('#novel-appearance-fields');
 const picker=document.querySelector('#appearance-novel'),relation=document.querySelector('#appearance-relation'),prose=document.querySelector('#appearance-prose');
 const status=document.querySelector('#appearance-editor-status'),error=document.querySelector('#appearance-editor-error'),review=document.querySelector('#appearance-review-version'),preview=document.querySelector('#appearance-saved-preview'),savedText=document.querySelector('#appearance-saved-text'),unlink=document.querySelector('#appearance-unlink');
 const submit=form.querySelector('[type="submit"]'),close=form.querySelector('[data-close-appearance]');
 let editing=null,busy=false,opener=null;
 const defaultRelation=['lore','story_arc'].includes(initial.target.kind)?'referenced_by':'appears_in';
 const snapshot=()=>({id:editing.id,version:editing.version,novelId:picker.value,relationKind:relation.value,prose:prose.value});
 const differs=draft=>{const saved=associations.get(draft.id);return saved?draft.relationKind!==saved.relationKind||draft.prose!==saved.prose:!!draft.novelId||draft.relationKind!==defaultRelation||!!draft.prose;};
 function remember(){if(!editing)return;const draft=snapshot();if(differs(draft))drafts.set(editing.key,draft);else drafts.delete(editing.key);}
 function sorted(){return [...associations.values()].sort((a,b)=>String(novels.get(a.novelId)?.title||'').localeCompare(String(novels.get(b.novelId)?.title||''))||a.novelId.localeCompare(b.novelId));}
 function paint(){
  const section=document.querySelector('[data-novel-appearances]'),box=document.querySelector('[data-appearance-infobox]');if(!section||!box)return;
  const list=section.querySelector('[data-appearance-list]'),info=box.querySelector('[data-appearance-infobox-list]');list.replaceChildren();info.replaceChildren();
  for(const association of sorted()){
   const novel=novels.get(association.novelId);if(!novel)continue;
   const entry=node('section',undefined,'novel-appearance-entry');entry.id='appearance-'+novel.id;entry.dataset.appearanceId=association.id;
   const heading=node('h3'),label=node('span',relationLabels[association.relationKind]||'Linked to'),link=node('a',novel.title);link.href=novelHref(novel.id);heading.append(label,' ',link);
   const text=node('p',association.prose||'No details yet.','novel-appearance-prose'),button=node('button','Edit '+(association.relationKind==='appears_in'?'appearance':association.relationKind==='referenced_by'?'reference':'link details'),'quiet-button');button.type='button';button.dataset.editAppearance=association.id;
   entry.append(heading,text,button);list.append(entry);
   const item=node('li'),book=node('a',novel.title),caption=node('small',relationLabels[association.relationKind]||'Linked to');book.href=novelHref(novel.id);
   if(novel.seriesTitle){const series=node('a',novel.seriesTitle);series.href='/series/'+encodeURIComponent(novel.seriesId)+'/';caption.append(' · ',series);}
   item.append(book,caption);info.append(item);
  }
  if(!list.children.length)list.append(node('p','No novels linked yet.','section-note'));
  box.querySelector('[data-appearance-infobox-empty]').hidden=!!info.children.length;
 }
 function mount(){
  const content=document.querySelector('.profile-content'),identity=document.querySelector('.infobox');if(!content||!identity)return;
  let inserted=false;
  if(!document.querySelector('[data-novel-appearances]')){content.insertBefore(document.querySelector('#novel-appearances-template').content.cloneNode(true),content.querySelector('.profile-footer'));inserted=true;}
  if(!document.querySelector('[data-appearance-infobox]')){identity.append(document.querySelector('#novel-appearances-infobox-template').content.cloneNode(true));inserted=true;}
  if(inserted){paint();revealHash();}
 }
 function revealHash(){
  if(!location.hash.startsWith('#appearance-'))return;
  const target=document.getElementById(location.hash.slice(1));if(!target)return;
  for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
 }
 mount();
 // The Lore note React pilot creates its profile after module startup. Observe
 // only its root and mount our independent read-only nodes when it is ready.
 const pilot=document.querySelector('#lore-profile-root');
 if(pilot){const observer=new MutationObserver(mount);observer.observe(pilot,{childList:true,subtree:true});window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});}
 window.addEventListener('hashchange',revealHash);
 function open(id,trigger){
  if(busy)return;opener=trigger;
  const saved=id?associations.get(id):null;if(id&&!saved)return;
  const key=saved?.id||'new',draft=drafts.get(key)||saved||{id:crypto.randomUUID(),version:1,novelId:'',relationKind:defaultRelation,prose:''};
  editing={key,id:draft.id,version:draft.version,new:!saved};
  picker.replaceChildren();const blank=node('option','Choose a novel…');blank.value='';picker.append(blank);
  const linked=new Set([...associations.values()].map(item=>item.novelId));
  for(const novel of novels.values()){
   if(editing.new&&linked.has(novel.id))continue;
   const option=node('option',novel.title+(novel.status==='archived'?' (Archived)':''));option.value=novel.id;picker.append(option);
  }
  picker.value=draft.novelId;picker.disabled=!editing.new;relation.value=draft.relationKind;prose.value=draft.prose;
  document.querySelector('#novel-appearance-editor-title').textContent=editing.new?'Link a novel to '+initial.target.label:'Details for '+(novels.get(draft.novelId)?.title||'novel');
  status.textContent=drafts.has(key)?'Unsaved details restored.':editing.new?'':'Saved';error.hidden=true;review.hidden=true;preview.hidden=true;preview.open=false;unlink.hidden=editing.new;
  submit.disabled=editing.new&&picker.options.length===1;
  if(submit.disabled)status.textContent='All available novels are linked. Create another novel from My novels.';
  dialog.showModal();(editing.new?picker:prose).focus();
 }
 function message(text,failed=false){status.textContent=text;if(failed){error.textContent=text;error.hidden=false;}else error.hidden=true;}
 function setBusy(value){busy=value;fields.disabled=value;submit.disabled=value;close.disabled=value;unlink.disabled=value;review.disabled=value;}
 async function request(url,options){
  const response=await fetch(url,{credentials:'same-origin',...options});
  if(response.status===204)return null;
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Your draft is still here. Sign in before saving.');
  const data=await response.json();if(!response.ok){const failure=new Error(data.error||'Could not save these details.');failure.conflict=response.status===409;throw failure;}
  return data;
 }
 document.addEventListener('click',event=>{
  const edit=event.target.closest('[data-edit-appearance]'),link=event.target.closest('[data-link-appearance]');
  if(edit||link){event.preventDefault();open(edit?.dataset.editAppearance,event.target);}
 });
 form.addEventListener('input',()=>{remember();status.textContent='Unsaved details';});
 form.addEventListener('change',()=>{remember();status.textContent='Unsaved details';});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!editing||!form.reportValidity())return;
  const draft=snapshot();remember();setBusy(true);message('Saving details…');
  try{
   const base='/api/novels/'+encodeURIComponent(draft.novelId)+'/associations';
   const payload=editing.new?{id:draft.id,targetKind:initial.target.kind,targetId:initial.target.id,relationKind:draft.relationKind,prose:draft.prose}:{version:draft.version,relationKind:draft.relationKind,prose:draft.prose};
   const saved=await request(base+(editing.new?'':'/'+encodeURIComponent(draft.id)),{method:editing.new?'POST':'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
   drafts.delete(editing.key);associations.set(saved.id,saved);editing={key:saved.id,id:saved.id,version:saved.version,new:false};picker.disabled=true;unlink.hidden=false;relation.value=saved.relationKind;prose.value=saved.prose;
   review.hidden=true;preview.hidden=true;paint();message('Saved details');announceWorkspaceChange();
  }catch(failure){remember();message(failure.message+' Your details are still in this editor.',true);review.hidden=!failure.conflict;}
  finally{setBusy(false);}
 });
 review.addEventListener('click',async()=>{
  if(busy||!editing||editing.new)return;setBusy(true);message('Loading saved details…');
  try{
   const latest=await request('/api/novel-associations?'+new URLSearchParams({targetKind:initial.target.kind,targetId:initial.target.id}),{cache:'no-store'});
   const saved=latest.find(item=>item.id===editing.id);if(!saved)throw new Error('This link was removed in another tab. Your draft remains in the editor.');
   associations.set(saved.id,saved);editing.version=saved.version;paint();remember();savedText.textContent=(relationLabels[saved.relationKind]||'Linked to')+'\n\n'+(saved.prose||'No details yet.');preview.hidden=false;preview.open=true;review.hidden=true;
   message('The latest saved text is shown below. Your draft remains above. Save details to replace the saved text.');
  }catch(failure){message(failure.message,true);}
  finally{setBusy(false);}
 });
 unlink.addEventListener('click',async()=>{
  if(busy||!editing||editing.new)return;remember();setBusy(true);message('Unlinking novel…');
  try{
   await request('/api/novels/'+encodeURIComponent(picker.value)+'/associations/'+encodeURIComponent(editing.id),{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({version:editing.version})});
   associations.delete(editing.id);drafts.delete(editing.key);editing=null;paint();dialog.close();announceWorkspaceChange();
  }catch(failure){remember();message(failure.message+' Your details are still in this editor.',true);review.hidden=!failure.conflict;}
  finally{setBusy(false);}
 });
 close.addEventListener('click',()=>{if(!busy){remember();dialog.close();}});
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else remember();});
 dialog.addEventListener('close',()=>{remember();opener?.focus();});
 // Main article editors install their own document shortcut. Capture inside
 // our dialog so Cmd/Ctrl+S submits only the association form.
 document.addEventListener('keydown',event=>{
  if(!dialog.open)return;
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();event.stopImmediatePropagation();if(!busy)form.requestSubmit();}
 },true);
 window.addEventListener('beforeunload',event=>{remember();if(drafts.size){event.preventDefault();event.returnValue='';}});
}

if(typeof document!=='undefined')initNovelAppearances();
