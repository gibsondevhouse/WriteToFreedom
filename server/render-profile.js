import {ancestors} from '../public/locations/data.js';
import { characters as seeds } from '../public/characters/data.js';
import { templateSections, nameFields, storyRoles, alignments, humanFieldGroups, humanFields, humanChoices, profileChoices, multiChoiceFields } from '../public/characters/template.js';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderProfile(character, cast, factions=[],locations=[]) {
 const color=seeds.find(c=>c.id===character.id)?.color||'blue';
 const name=escape(character.name.trim() || 'Untitled character');
 const initials=escape(character.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]||'').join('').toUpperCase()||'?');
 const field=([key,label,type])=>{
  const val=character[key]||'',attrs=`id="field-${key}" name="${key}" aria-label="${escape(label)}"`;
  let control;
  if(type==='select'||type==='faction'){
   let choices=type==='faction'?factions.map(f=>[f.id,f.name||'Untitled faction']):(humanChoices[key]||(key==='alignment'?alignments:storyRoles)).map(v=>[v,v]);
   let selected=val;
   if(type==='faction'&&!selected&&character.affiliation){choices.push(['__legacy__',character.affiliation]);selected='__legacy__';}
   if(type==='select'&&val&&!choices.some(c=>c[0]===val))choices.push([val,val]);
   control=`<select ${attrs}><option value="">${type==='faction'?'No faction selected':'Not yet chosen'}</option>${choices.map(([v,l])=>`<option value="${escape(v)}"${v===selected?' selected':''}>${escape(l)}</option>`).join('')}${type==='faction'?'<option value="__create__">+ Create a faction…</option>':''}</select>`;
  }else if(type==='location'||type==='country'){
   const choices=locations.filter(l=>type==='location'||l.type==='country');
   control=`<select ${attrs}><option value="">Not yet chosen</option>${choices.map(l=>`<option value="${escape(l.id)}"${val===l.id?' selected':''}>${escape(l.name)}${type==='location'?' — '+escape(ancestors(l,locations).map(p=>p.name).join(' › ')||'Country'):''}</option>`).join('')}</select>`;
  }else if(type==='number')control=`<input ${attrs} type="number" min="0" step="${key==='age'?'1':'any'}" value="${escape(val)}" placeholder="Not set">`;
  else if(type==='choice'){
   const multiple=multiChoiceFields.includes(key), choices=[...profileChoices[key]];
   if(!multiple&&val&&!choices.includes(val))choices.unshift(val);
   control=`<div class="choice-control" data-choice-field="${key}" data-multiple="${multiple}"><input ${attrs} type="hidden" value="${escape(val)}"><div class="choice-values" aria-label="Selected ${escape(label.toLowerCase())}"${multiple?'':' hidden'}></div><select id="choice-${key}" data-choice-select aria-label="${multiple?'Add to ':''}${escape(label)}"><option value="">${multiple?'Add…':'Not yet chosen'}</option>${choices.map(v=>`<option value="${escape(v)}"${!multiple&&v===val?' selected':''}>${escape(v)}</option>`).join('')}<option value="__custom__">Custom…</option></select><div class="choice-custom" hidden><input type="text" data-choice-custom-input aria-label="Custom ${escape(label.toLowerCase())}" maxlength="10000" placeholder="Enter your own…"><div class="choice-custom-actions"><button type="button" data-choice-add>${multiple?'Add':'Use value'}</button><button type="button" data-choice-cancel>Cancel</button></div></div></div>`;
  }
  else if(type==='input')control=`<input ${attrs} type="text" autocomplete="off" maxlength="${nameFields.includes(key)?160:10000}" value="${escape(val)}" placeholder="Add ${escape(label.toLowerCase())}…">`;
  else control=`<textarea ${attrs} rows="2" maxlength="10000" placeholder="Add ${escape(label.toLowerCase())}…">${escape(val)}</textarea>`;
  return `<div data-profile-field="${key}"${character.hiddenFields?.includes(key)?' hidden':''} class="inline-field${type==='textarea'?' prose-field':''}"><label for="${type==='choice'?'choice-':'field-'}${key}">${escape(label)}</label>${control}</div>`;
 };
 const chevron='<svg class="collapse-chevron" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
 function headingButton(title,target){return `<button type="button" class="collapse-toggle" aria-expanded="true" aria-controls="${target}" data-collapse-target="${target}"><span>${escape(title)}</span>${chevron}</button>`;}
 function header(section){const options=section.id==='relationships'?[['relationships','Relationship entries']]:section.fields;
  return `<div class="section-header"><h2>${headingButton(section.title,section.id+'-body')}</h2><details class="field-menu"><summary aria-label="Choose visible fields for ${escape(section.title)}" title="Choose visible fields"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/></svg></summary><div class="field-menu-panel">${options.map(([key,label])=>`<label><input type="checkbox" data-visibility="${key}"${character.hiddenFields?.includes(key)?'':' checked'}> ${escape(label)}</label>`).join('')}<div class="visibility-actions"><button type="button" data-visibility-all="show">Show all</button><button type="button" data-visibility-all="hide">Hide all</button></div></div></details></div>`;
 }
 const body=templateSections.filter(s=>s.id!=='identity').map(section=>{
  const fields=section.id==='overview'?[section.fields[1],section.fields[0]]:section.fields;
  const content=section.id==='relationships'?`<div data-profile-field="relationships"${character.hiddenFields?.includes('relationships')?' hidden':''}><div id="relationship-fields"></div><button type="button" id="add-relationship" class="quiet-button">+ Add relationship</button></div>`:fields.map(field).join('');
  return `<section id="${section.id}" class="profile-section${section.id==='relationships'?' full-width':''}">${header(section)}<div id="${section.id}-body" class="collapsible-region">${content}</div></section>`;
 }).join('');
 const identityFields=templateSections[0].fields.filter(f=>f[0]!=='title'&&!humanFields.some(h=>h[0]===f[0]));
 const cardGroups=[{title:'Character information',fields:identityFields},...humanFieldGroups].map((group,index)=>`<div class="card-group"><h3>${headingButton(group.title,'identity-group-'+index)}</h3><div id="identity-group-${index}" class="collapsible-region">${group.fields.map(field).join('')}</div></div>`).join('');
 const data=JSON.stringify({character,cast:cast.map(c=>({id:c.id,name:c.name})),factions}).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${name} — Write to Freedom</title><link rel="icon" href="/crest.svg"><link rel="stylesheet" href="/characters/profile.css"><link rel="stylesheet" href="/characters/profile-editor.css?v=profile-controls-2"><script type="module" src="/characters/profile-editor.js?v=profile-controls-2"></script></head><body class="character-profile"><div class="page-layout"><main id="profile"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/characters/">Characters</a> / <span aria-current="page" data-display-name>${name}</span></nav><div class="title-row"><h1><button type="button" id="edit-name" title="Edit character name" data-display-name>${name}</button></h1></div><form id="profile-form"><div class="article-bar"><span class="current-view">Character profile</span><div class="save-actions"><span id="save-status" role="status">Saved</span><button id="save-character" type="submit">Save changes</button></div></div><p class="byline">Click any field to edit your character.</p><p id="editor-error" role="alert" hidden></p><noscript>Enable JavaScript to edit and save this profile.</noscript><fieldset id="editor-fields"><legend class="sr-only">Character profile</legend><article><aside class="infobox" id="identity" aria-label="Character information"><h2 data-display-name>${name}</h2><div class="epithet-field">${field(templateSections[0].fields.find(f=>f[0]==='title'))}</div><div class="identity-panel ${color}"><span class="monogram" id="monogram">${initials}</span></div>${cardGroups}<small class="name-hint">Dates can use your story’s calendar. Height and weight use the selected units.</small><small class="name-hint">Names can include hyphens and spaces.</small></aside>${body}</article></fieldset></form><footer class="profile-footer"><a href="/characters/">← Back to characters</a><a href="#profile">Back to top ↑</a></footer></main></div><script id="profile-data" type="application/json">${data}</script></body></html>`;
}
