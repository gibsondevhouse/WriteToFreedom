import {referenceKey} from '../../characters/notes.js?v=__WTF_ASSET_REVISION__';
import {createAttributeControls} from '../../characters/attribute-controls.js?v=__WTF_ASSET_REVISION__';
import {alignments} from '../../characters/template.js?v=__WTF_ASSET_REVISION__';
import {createConnectionsMap} from './connections-map.js?v=__WTF_ASSET_REVISION__';
import {moralityIcons} from '../../characters/attributes.js?v=__WTF_ASSET_REVISION__';
import {createDateControl,initDatePicker} from '../../profiles/date-picker.js?v=__WTF_ASSET_REVISION__';
import {announceWorkspaceChange} from '../../profiles/workspace-events.js?v=__WTF_ASSET_REVISION__';
import {bindNumericText} from '../../characters/numeric-text.js?v=__WTF_ASSET_REVISION__';

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function button(text,cls,action){const n=el('button',cls,text);n.type='button';n.addEventListener('click',action);return n;}
function clean(value){return String(value??'').replace(/\s+/g,' ').trim();}
function initials(value){const words=clean(value).split(' ').filter(Boolean);return (words.length>1?words[0][0]+words.at(-1)[0]:words[0]?.slice(0,2)||'?').toUpperCase();}
function excerpt(value,limit=380){
 const text=clean(value);if(text.length<=limit)return text;
 const clipped=text.slice(0,limit+1),breakAt=clipped.lastIndexOf(' ');
 return clipped.slice(0,breakAt>limit*.72?breakAt:limit).trimEnd()+'…';
}
async function request(url,options={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load the character. Try again.');return data;
}

const detailTabs=[['about','About'],['ratings','Ratings'],['mentions','Mentions']];
let activeDialog;

/**
 * Open one module-wide character dialog. The attributes action is the shared
 * More preview: About opens first, Ratings owns the existing editable controls,
 * and Mentions is reserved for its later design. Other card actions keep their
 * dedicated views. Editable views fetch a fresh document before a versioned PUT.
 * @param {object} record Rich card record; updated in place after a successful save.
 * @param {string} view morality, attributes, connection, relationships, or mentions.
 * @param {Function} [onUpdate] Receives updated card state after persistence.
 * @returns {void}
 */
export function openCharacter(record,view,onUpdate){
 if(activeDialog)return;
 const opener=document.activeElement;
 const dialog=el('dialog','character-detail-overlay '+view+'-overlay');
 activeDialog=dialog;
 dialog.setAttribute('aria-labelledby','character-detail-title');

 const labels={attributes:'Character details',relationships:'Connections map',mentions:'Notes mentioning',morality:'Moral alignment',connection:'Featured item'};
 const header=el('header','character-detail-header'),heading=el('div');
 heading.append(el('p','character-detail-eyebrow',labels[view]));
 const title=el('h2','',record.name);title.id='character-detail-title';heading.append(title);
 const close=button('×','character-detail-close',attemptClose);close.setAttribute('aria-label','Close '+labels[view].toLowerCase());header.append(heading,close);

 const panel=el('div','character-detail-panel'),notice=el('p','character-detail-notice');notice.setAttribute('role','status');
 const discard=el('div','character-discard');discard.hidden=true;discard.append(el('span','','Discard unsaved changes?'),button('Keep editing','',()=>{discard.hidden=true;close.focus();}),button('Discard changes','',()=>dialog.close()));
 const footer=el('footer','character-detail-footer');
 if(view!=='morality'){const profile=el('a','detail-profile-link','Open full profile ↗');profile.href=record.href;footer.append(profile);}
 const save=button(view==='connection'?'Save featured item':view==='morality'?'Save alignment':'Save details','attribute-save',saveChanges);
 save.hidden=!['attributes','morality','connection'].includes(view);save.disabled=true;footer.append(notice,save);

 let connectionOptions=[],connection=null;
 let documentData,draft={},aboutDraft={},alignment='',portraitUrl='',aboutMedia=null,datePicker=null,dirty=false,saving=false,activeTab='about';
 const tabButtons=new Map(),tabPanels=new Map();
 const tabs=view==='attributes'?buildTabs():null;

 function buildTabs(){
  const nav=el('div','character-detail-tabs');nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Character details');
  detailTabs.forEach(([key,label],index)=>{
   const tab=button(label,'character-detail-tab',()=>activateTab(key));
   tab.id='character-detail-tab-'+key;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','character-detail-panel-'+key);tab.setAttribute('aria-selected',String(index===0));tab.tabIndex=index===0?0:-1;
   tab.addEventListener('keydown',event=>{
    const current=detailTabs.findIndex(([name])=>name===key);let next;
    if(event.key==='ArrowRight')next=(current+1)%detailTabs.length;
    else if(event.key==='ArrowLeft')next=(current-1+detailTabs.length)%detailTabs.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=detailTabs.length-1;
    else return;
    event.preventDefault();activateTab(detailTabs[next][0],true);
   });
   tabButtons.set(key,tab);nav.append(tab);
  });
  return nav;
 }
 function activateTab(name,focus=false){
  if(!tabButtons.has(name))return;
  activeTab=name;
  tabButtons.forEach((tab,key)=>{const selected=key===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
  tabPanels.forEach((tabPanel,key)=>{tabPanel.hidden=key!==name;});
  save.hidden=name==='mentions';notice.hidden=name==='mentions';save.textContent=name==='ratings'?'Save ratings':'Save details';
  if(tabPanels.size)panel.scrollTop=0;
  if(focus)tabButtons.get(name).focus();
 }
 function makeTabPanel(name,cls=''){
  const tabPanel=el('section','character-tab-panel '+cls);tabPanel.id='character-detail-panel-'+name;tabPanel.setAttribute('role','tabpanel');tabPanel.setAttribute('aria-labelledby','character-detail-tab-'+name);tabPanel.hidden=name!==activeTab;tabPanels.set(name,tabPanel);return tabPanel;
 }
 function buildPreview(){
  tabPanels.clear();
  const about=makeTabPanel('about','character-about');
  const media=el('figure','character-about-media'),fallback=el('span','character-about-initials',initials(record.name));fallback.setAttribute('aria-hidden','true');media.append(fallback);aboutMedia=media;
  renderAboutArtwork(/^https:\/\//i.test(portraitUrl)?portraitUrl:record.image||'');
  const biography=documentData.biography||documentData.introduction||documentData.summary||record.summary||'';
  const bio=el('p','character-about-bio',excerpt(biography)||'No biography yet.');
  const facts=el('dl','character-about-facts');facts.setAttribute('aria-label','Editable character details');
  facts.append(buildMeasurementFact('Height','height','heightUnit',['cm','in']),buildMeasurementFact('Weight','weight','weightUnit',['kg','lb']),buildDateFact('Birthday','birthDate'),buildAlignmentFact());
  about.append(media,bio,facts);

  const ratings=makeTabPanel('ratings','character-ratings');ratings.append(buildAttributes());
  const mentions=makeTabPanel('mentions','character-mentions-placeholder');mentions.append(el('p','detail-empty','Mentions will appear here.'));
  panel.replaceChildren(about,ratings,mentions);datePicker?.destroy();datePicker=initDatePicker(dialog,{requestSave:saveChanges});activateTab(activeTab);
 }
 function renderAboutArtwork(source=portraitUrl){
  if(!aboutMedia)return;
  aboutMedia.querySelector('.character-about-photo')?.remove();aboutMedia.classList.add('is-placeholder');
  if(!/^https:\/\//i.test(source))return;
  const image=el('img','character-about-photo');image.src=source;image.alt='Portrait of '+record.name;image.loading='eager';image.decoding='async';image.referrerPolicy='no-referrer';
  image.addEventListener('error',()=>{image.remove();aboutMedia?.classList.add('is-placeholder');});aboutMedia.append(image);aboutMedia.classList.remove('is-placeholder');
 }
 function factShell(label){
  const fact=el('div','character-about-fact'),term=el('dt','',label),fields=el('dd','character-about-fact-fields');fact.append(term,fields);return {fact,fields};
 }
 function buildMeasurementFact(label,key,unitKey,units){
  const {fact,fields}=factShell(label),value=el('input','character-about-value'),unit=el('select','character-about-unit');
  value.id='character-about-'+key;value.type='text';value.inputMode='decimal';value.maxLength=10000;value.placeholder='Not set';value.value=aboutDraft[key]||'';value.setAttribute('aria-label',label);bindNumericText(value,key);
  unit.id='character-about-'+unitKey;unit.setAttribute('aria-label',label+' unit');
  for(const choice of ['',...units]){const option=el('option','',choice||'—');option.value=choice;unit.append(option);}unit.value=aboutDraft[unitKey]||'';
  value.addEventListener('input',()=>{aboutDraft[key]=value.value;markDirty();});unit.addEventListener('change',()=>{aboutDraft[unitKey]=unit.value;markDirty();});
  fields.classList.add('has-unit');fields.append(value,unit);return fact;
 }
 function buildDateFact(label,key){
  const {fact,fields}=factShell(label),{control,input}=createDateControl({id:'character-about-'+key,label,value:aboutDraft[key]||'',placeholder:'Select date…',inputClass:'character-about-value'});
  input.addEventListener('input',()=>{aboutDraft[key]=input.value;markDirty();});fields.append(control);return fact;
 }
 function buildAlignmentFact(){
  const {fact,fields}=factShell('Moral alignment'),select=el('select','character-about-value');select.id='character-about-alignment';select.setAttribute('aria-label','Moral alignment');
  const choices=alignment&&!alignments.includes(alignment)?[...alignments,alignment]:alignments;
  for(const choice of ['',...choices]){const option=el('option','',choice||'Not set');option.value=choice;select.append(option);}select.value=alignment;
  select.addEventListener('change',()=>{alignment=select.value;markDirty();});fields.append(select);return fact;
 }
 function attemptClose(){if(saving)return;if(dirty){discard.hidden=false;discard.querySelector('button').focus();}else dialog.close();}
 function markDirty(){dirty=true;notice.textContent='Unsaved changes';save.disabled=false;}
 async function load(){
  panel.replaceChildren(el('p','detail-empty','Loading…'));save.disabled=true;
  try{
   if(view==='relationships'){
    const catalog=await request('/api/characters?view=cards');if(!dialog.open)return;
    panel.replaceChildren(createConnectionsMap(catalog.characters,record.id));return;
   }
   if(view==='connection'){
    const data=await request('/api/characters/'+encodeURIComponent(record.id)+'?view=connections');if(!dialog.open)return;
    documentData=data.character;record.defaultAffiliationCard=data.defaultAffiliationCard;connectionOptions=data.options;connection=documentData.cardConnection||null;
    panel.replaceChildren(buildConnections());return;
   }
   documentData=await request('/api/characters/'+encodeURIComponent(record.id));if(!dialog.open)return;
   draft={...(documentData.attributeRatings||{})};aboutDraft={height:documentData.height||'',heightUnit:documentData.heightUnit||'',weight:documentData.weight||'',weightUnit:documentData.weightUnit||'',birthDate:documentData.birthDate||''};alignment=documentData.alignment||'';portraitUrl=documentData.portraitUrl||'';
   if(view==='morality')panel.replaceChildren(buildMorality());else buildPreview();
  }catch(error){if(!dialog.open)return;panel.replaceChildren(el('p','detail-empty',error.message),button('Try again','detail-retry',load));}
 }
 function buildConnections(){
  const layout=el('div','featured-picker'),label=el('label','','Find an item'),search=el('input'),choices=el('fieldset','featured-choices');
  search.type='search';search.id='featured-search';search.placeholder='Characters, places, factions, notes…';label.htmlFor=search.id;
  function render(){
   choices.replaceChildren(el('legend','shell-sr-only','Featured item'));
   const query=search.value.trim().toLowerCase();
   const options=[{ref:null,name:'Automatic affiliation',label:'Faction or citizenship'},...connectionOptions.filter(option=>(option.name+' '+option.label).toLowerCase().includes(query))];
   for(const option of options){
    const row=el('label','featured-option'),radio=el('input');radio.type='radio';radio.name='featured-item';radio.checked=option.ref?Boolean(connection)&&referenceKey(option.ref)===referenceKey(connection):!connection;
    radio.addEventListener('change',()=>{connection=option.ref;markDirty();});
    const copy=el('span');copy.append(el('strong','',option.name),el('small','',option.label));row.append(radio,copy);choices.append(row);
   }
   if(options.length===1&&query)choices.append(el('p','detail-empty','No matching items.'));
  }
  search.addEventListener('input',render);render();layout.append(label,search,choices);return layout;
 }
 function buildMorality(){
  const choices=el('fieldset','morality-options'),legend=el('legend','shell-sr-only','Choose moral alignment');choices.append(legend);
  const values=alignment&&!alignments.includes(alignment)?[...alignments,alignment]:alignments;
  for(const choice of ['',...values]){
   const label=el('label','morality-option'),radio=el('input');radio.type='radio';radio.name='alignment';radio.value=choice;radio.checked=choice===alignment;
   const mark=el('span','morality-symbol',moralityIcons[choice]||'—');mark.setAttribute('aria-hidden','true');label.append(radio,mark,el('span','',choice||'Not set'));
   radio.addEventListener('change',()=>{alignment=choice;markDirty();});choices.append(label);
  }
  return choices;
 }
 function buildAttributes(){
  const layout=el('div','attribute-stack');
  layout.append(createAttributeControls(draft,markDirty));
  const artwork=el('details','attribute-artwork');artwork.append(el('summary','','Card portrait'));
  const label=el('label','','Portrait image URL'),url=el('input');url.id='attribute-portrait-url';url.type='url';url.value=portraitUrl;url.placeholder='https://…';url.maxLength=2048;url.pattern='https://.*';label.htmlFor=url.id;
  url.addEventListener('input',()=>{portraitUrl=url.value.trim();renderAboutArtwork();markDirty();});artwork.append(label,url);layout.append(artwork);return layout;
 }
 async function saveChanges(){
  if(!documentData||saving)return;
  const invalid=[...panel.querySelectorAll('input,select')].find(input=>!input.checkValidity());
  if(invalid){
   const invalidPanel=invalid.closest('.character-tab-panel');
   if(invalidPanel){const entry=[...tabPanels].find(([,tabPanel])=>tabPanel===invalidPanel);if(entry)activateTab(entry[0]);}
   invalid.reportValidity();invalid.focus();return;
  }
  const updates=view==='connection'?{cardConnection:connection}:view==='morality'?{alignment}:{...aboutDraft,alignment,attributeRatings:draft,portraitUrl:portraitUrl.trim()};
  saving=true;save.disabled=true;close.disabled=true;panel.querySelectorAll('input,select,button').forEach(n=>n.disabled=true);tabButtons.forEach(tab=>{tab.disabled=true;});notice.textContent='Saving…';
  try{
   const updated=await request('/api/characters/'+encodeURIComponent(record.id),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({...documentData,...updates})});
   documentData=updated;aboutDraft={height:updated.height||'',heightUnit:updated.heightUnit||'',weight:updated.weight||'',weightUnit:updated.weightUnit||'',birthDate:updated.birthDate||''};alignment=updated.alignment||'';portraitUrl=updated.portraitUrl||'';dirty=false;record.attributeRatings={...updated.attributeRatings};record.image=portraitUrl;record.alignment=alignment;Object.assign(record,aboutDraft);renderAboutArtwork();notice.textContent='Saved';
   if(view==='connection'){record.cardConnection=updated.cardConnection;record.affiliationCard=connectionOptions.find(option=>updated.cardConnection&&referenceKey(option.ref)===referenceKey(updated.cardConnection))||record.defaultAffiliationCard||record.affiliationCard;}
   onUpdate?.(record);announceWorkspaceChange();
   if(['morality','connection'].includes(view))dialog.close();
  }catch(error){notice.textContent=error.message;}
  finally{saving=false;save.disabled=!dirty;close.disabled=false;panel.querySelectorAll('input,select,button').forEach(n=>n.disabled=false);tabButtons.forEach(tab=>{tab.disabled=false;});}
 }
 function renderMentions(){
  if(!record.mentions.length){panel.append(el('p','detail-empty','No notes mentioning this character yet.'));return;}
  const list=el('ul','character-mention-list');
  for(const note of record.mentions){
   const item=el('li'),link=el('a','mention-entry');link.href=note.href;link.title=note.source+' · '+note.label+' — '+note.text;
   link.append(el('strong','mention-source',note.source+' · '+note.label),el('span','mention-excerpt',note.text.replace(/\s+/g,' ').trim()),el('span','mention-arrow','↗'));item.append(link);list.append(item);
  }
  panel.append(list);
 }

 dialog.addEventListener('cancel',event=>{event.preventDefault();attemptClose();});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)attemptClose();}});
 dialog.addEventListener('close',()=>{datePicker?.destroy();datePicker=null;dialog.remove();activeDialog=null;document.body.classList.remove('character-overlay-open');if(opener?.isConnected)opener.focus();else{const card=[...document.querySelectorAll('.story-character-card')].find(item=>item.querySelector('.character-profile-link')?.getAttribute('href')===record.href);card?.querySelector({attributes:'.character-more',morality:'.morality-action',relationships:'.relationships-action',mentions:'.mentions-action',connection:'.affiliation-picker'}[view])?.focus();}});
 const preventUnload=event=>{if(dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',preventUnload);dialog.addEventListener('close',()=>window.removeEventListener('beforeunload',preventUnload),{once:true});
 dialog.append(header,discard,...(tabs?[tabs]:[]),panel,footer);document.body.append(dialog);document.body.classList.add('character-overlay-open');dialog.showModal();if(view==='mentions')renderMentions();else load();(tabButtons.get('about')||close).focus();
}
