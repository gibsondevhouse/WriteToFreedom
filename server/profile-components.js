import {profileChoices,multiChoiceFields,nationalityGroups} from '../public/profiles/choices.js';
export const profileRevision='create-note-items-1';
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const jsonData=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
const chevron='<svg class="collapse-chevron" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
function headingButton(title,target){return `<button type="button" class="collapse-toggle" aria-expanded="true" aria-controls="${target}" data-collapse-target="${target}"><span>${escape(title)}</span>${chevron}</button>`;}
export function renderFieldWrapper(record,key,label,type,control){return `<div data-profile-field="${key}"${record.hiddenFields?.includes(key)?' hidden':''} class="inline-field${type==='textarea'?' prose-field':''}"><label for="${type==='choice'?'choice-':'field-'}${key}">${escape(label)}</label>${control}</div>`;}
export function renderChoice(key,label,val,attrs,{continents=[],nationalityContinents={}}={}){
 const multiple=multiChoiceFields.includes(key),choices=[...profileChoices[key]];
 if(!multiple&&val&&!choices.includes(val))choices.unshift(val);
 const option=(value,label=value)=>`<option value="${escape(value)}">${escape(label)}</option>`;
 let options=choices.map(v=>`<option value="${escape(v)}"${!multiple&&v===val?' selected':''}>${escape(v)}</option>`).join('')+option('__custom__','Custom…');
 let continentControl='';
 if(key==='nationality'){
  const chosen=val.split(/\s*·\s*/).filter(Boolean),custom=chosen.filter(v=>!choices.includes(v));
  options=Object.entries(nationalityGroups).map(([group,values])=>`<optgroup label="${escape(group)}">${values.map(v=>option(v)).join('')}</optgroup>`).join('');
  const known=new Set(continents.map(c=>c.id));
  options+=continents.map(c=>`<optgroup data-continent="${escape(c.id)}" label="${escape(c.name)}">${custom.filter(v=>nationalityContinents[v]===c.id).map(v=>option(v)).join('')}</optgroup>`).join('');
  options+=`<optgroup data-continent="" label="Custom continent">${custom.filter(v=>!known.has(nationalityContinents[v])).map(v=>option(v)).join('')}${option('__custom__','Add custom nationality…')}</optgroup>`;
  continentControl=`<label for="nationality-continent">Continent</label><select id="nationality-continent" data-nationality-continent>${option('','Custom continent')}${continents.map(c=>option(c.id,c.name)).join('')}</select><a href="/locations/?type=continent" target="_blank" rel="noopener" class="nationality-continent-link">Create a continent ↗</a>`;
 }
 return `<div class="choice-control" data-choice-field="${key}" data-multiple="${multiple}"><input ${attrs} type="hidden" value="${escape(val)}"><div class="choice-values" aria-label="Selected ${escape(label.toLowerCase())}"${multiple?'':' hidden'}></div><select id="choice-${key}" data-choice-select aria-label="${multiple?'Add to ':''}${escape(label)}"><option value="">${multiple?'Add…':'Not yet chosen'}</option>${options}</select><div class="choice-custom" hidden>${continentControl}<input type="text" data-choice-custom-input aria-label="Custom ${escape(label.toLowerCase())}" maxlength="10000" placeholder="Enter your own…"><div class="choice-custom-actions"><button type="button" data-choice-add>${multiple?'Add':'Use value'}</button><button type="button" data-choice-cancel>Cancel</button></div></div></div>`;
}
export function renderDateControl(key,label,val,attrs){return `<div class="date-control"><input ${attrs} type="text" data-date-input readonly aria-haspopup="dialog" aria-controls="profile-date-picker" autocomplete="off" maxlength="10000" value="${escape(val)}" placeholder="Select date…"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/></svg></div>`;}
export function createFieldRenderer(record,{options=()=>null,required=[],links={}}={}){
 return ([key,label,type])=>{
  const val=record[key]||'',attrs=`id="field-${key}" name="${key}" aria-label="${escape(label)}"${required.includes(key)?' required':''}`,choices=options(key,type);let control;
  if(type==='date')control=renderDateControl(key,label,val,attrs);
  else if(type==='choice')control=renderChoice(key,label,val,attrs);
  else if(choices){
   if(val&&!choices.some(([value])=>value===val))choices.push([val,val]);
   control=`<select ${attrs}><option value="">Not yet chosen</option>${choices.map(([v,l])=>`<option value="${escape(v)}"${v===val?' selected':''}>${escape(l)}</option>`).join('')}</select>`;
   if(links[key])control+=`<a class="person-link" data-for="${key}" href="${links[key]}${escape(val)}/"${!val?' hidden':''}>Open profile →</a>`;
  }else if(type==='textarea')control=`<textarea ${attrs} rows="2" maxlength="10000" placeholder="Add ${escape(label.toLowerCase())}…">${escape(val)}</textarea>`;
  else control=`<input ${attrs} type="${type==='url'?'url':'text'}"${type==='url'?' pattern="https://.*" title="Use an HTTPS image URL"':''} autocomplete="off" maxlength="${key==='name'?160:type==='url'?2048:10000}" value="${escape(val)}" placeholder="${type==='url'?'https://…':'Add '+escape(label.toLowerCase())+'…'}">`;
  return renderFieldWrapper(record,key,label,type,control);
 };
}
export function renderSection(section,content,record,{fullWidth=false,menuFields=section.fields,allowNotes=false}={}){
 const menu=menuFields.length?`<details class="field-menu"><summary aria-label="Choose visible fields for ${escape(section.title)}" title="Choose visible fields"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/></svg></summary><div class="field-menu-panel">${menuFields.map(([key,label])=>`<label><input type="checkbox" data-visibility="${key}"${record.hiddenFields?.includes(key)?'':' checked'}> ${escape(label)}</label>`).join('')}<div class="visibility-actions"><button type="button" data-visibility-all="show">Show all</button><button type="button" data-visibility-all="hide">Hide all</button></div>${allowNotes?'<button type="button" class="create-profile-note" data-create-note>Create a note</button>':''}</div></details>`:'';
 return `<section id="${section.id}" class="profile-section${fullWidth?' full-width':''}"><div class="section-header"><h2>${headingButton(section.title,section.id+'-body')}</h2>${menu}</div><div id="${section.id}-body" class="collapsible-region">${content}</div></section>`;
}
export function renderInfoGroup(title,id,content){return `<div class="card-group"><h3>${headingButton(title,id)}</h3><div id="${id}" class="collapsible-region">${content}</div></div>`;}
export function renderProfileName(record,type,{official=false}={}){return `<h1 class="profile-name"><button type="button" id="edit-name" title="Edit ${type} name"><span ${official?'id="official-heading"':'data-display-name'}>${escape((official&&record.officialName)||record.name||'Untitled '+type)}</span></button></h1>`;}
export function renderProfilePage({record,type,collection,collectionUrl,infobox,content,script,styles=[],initial=record,boxClass=''}){
 const name=escape(record.name?.trim()||'Untitled '+type),label=type[0].toUpperCase()+type.slice(1);
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${name} — Write to Freedom</title><link rel="icon" href="/crest.svg">${['/profiles/profile.css','/profiles/editor.css','/profiles/date-picker.css',...styles].map(path=>`<link rel="stylesheet" href="${path}?v=${profileRevision}">`).join('')}<script type="module" src="${script}?v=${profileRevision}"></script></head><body class="entity-profile ${type}-profile"><div class="page-layout"><main id="profile"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="${collectionUrl}">${collection}</a> / <span aria-current="page" data-display-name>${name}</span></nav><form id="profile-form" data-id="${escape(record.id)}" data-version="${record.version}"><div class="article-bar"><span class="current-view">${label} profile</span><div class="save-actions"><span id="save-status" role="status">Saved</span><button id="save-character" type="submit">Save changes</button></div></div><p class="byline">Click any field to edit your ${type}.</p><p id="editor-error" role="alert" hidden></p><noscript>Enable JavaScript to edit and save this profile.</noscript><fieldset id="editor-fields"><legend class="sr-only">${label} profile</legend><article><aside class="infobox ${boxClass}" id="identity" tabindex="0" aria-label="${label} information">${infobox}</aside><div class="profile-content">${content}<footer class="profile-footer"><a href="${collectionUrl}">← Back to ${collection.toLowerCase()}</a><a href="#profile">Back to top ↑</a></footer></div></article></fieldset></form></main></div><script id="profile-data" type="application/json">${jsonData(initial)}</script></body></html>`;
}
