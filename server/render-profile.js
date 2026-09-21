import { characters as seeds } from '../public/characters/data.js';
import { templateSections, nameFields, storyRoles, alignments } from '../public/characters/template.js';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderProfile(character, cast, factions=[]) {
 const color=seeds.find(c=>c.id===character.id)?.color||'blue';
 const name=escape(character.name.trim() || 'Untitled character');
 const initials=escape(character.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]||'').join('').toUpperCase()||'?');
 const contents=templateSections.map(s=>`<li><a href="#${s.id}">${escape(s.title)}</a></li>`).join('');
 const field=([key,label,type])=>{
  const val=character[key]||'',attrs=`id="field-${key}" name="${key}" aria-label="${escape(label)}"`;
  let control;
  if(type==='select'||type==='faction'){
   let choices=type==='faction'?factions.map(f=>[f.id,f.name||'Untitled faction']):(key==='alignment'?alignments:storyRoles).map(v=>[v,v]);
   let selected=val;
   if(type==='faction'&&!selected&&character.affiliation){choices.push(['__legacy__',character.affiliation]);selected='__legacy__';}
   if(type==='select'&&val&&!choices.some(c=>c[0]===val))choices.push([val,val]);
   control=`<select ${attrs}><option value="">${type==='faction'?'No faction selected':'Not yet chosen'}</option>${choices.map(([v,l])=>`<option value="${escape(v)}"${v===selected?' selected':''}>${escape(l)}</option>`).join('')}${type==='faction'?'<option value="__create__">+ Create a faction…</option>':''}</select>`;
  }else if(type==='input')control=`<input ${attrs} type="text" autocomplete="off" maxlength="${nameFields.includes(key)?160:10000}" value="${escape(val)}" placeholder="Add ${escape(label.toLowerCase())}…">`;
  else control=`<textarea ${attrs} rows="2" maxlength="10000" placeholder="Add ${escape(label.toLowerCase())}…">${escape(val)}</textarea>`;
  return `<div class="inline-field${type==='textarea'?' prose-field':''}"><label for="field-${key}">${escape(label)}</label>${control}</div>`;
 };
 const body=templateSections.filter(s=>s.id!=='identity').map(section=>{
  if(section.id==='relationships')return `<section id="relationships" class="profile-section full-width"><h2>Relationships</h2><div id="relationship-fields"></div><button type="button" id="add-relationship" class="quiet-button">+ Add relationship</button></section>`;
  const fields=section.id==='overview'?[section.fields[1],section.fields[0]]:section.fields;
  return `<section id="${section.id}" class="profile-section${section.id==='personality'?' full-width':''}">${section.id==='overview'?'':`<h2>${escape(section.title)}</h2>`}${fields.map(field).join('')}</section>`;
 }).join('');
 const data=JSON.stringify({character,cast:cast.map(c=>({id:c.id,name:c.name})),factions}).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${name} — Write to Freedom</title><link rel="icon" href="/crest.svg"><link rel="stylesheet" href="/characters/profile.css"><link rel="stylesheet" href="/characters/profile-editor.css"><script type="module" src="/characters/profile-editor.js"></script></head><body><header class="site-header"><a class="brand" href="/"><img src="/crest.svg" width="35" height="40" alt=""><span>Write to Freedom<small>A Free Novelpedia</small></span></a><a href="/characters/">← All characters</a></header><div class="page-layout"><aside class="desktop-contents"><nav aria-label="Profile contents"><h2>Contents</h2><ol>${contents}</ol></nav></aside><main id="profile"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/characters/">Characters</a> / <span aria-current="page" data-display-name>${name}</span></nav><div class="title-row"><h1><button type="button" id="edit-name" title="Edit character name" data-display-name>${name}</button></h1></div><form id="profile-form"><div class="article-bar"><span class="current-view">Character profile</span><div class="save-actions"><span id="save-status" role="status">Saved</span><button id="save-character" type="submit">Save changes</button></div></div><p class="byline">Click any field to edit your character.</p><p id="editor-error" role="alert" hidden></p><noscript>Enable JavaScript to edit and save this profile.</noscript><details class="mobile-contents"><summary>Contents</summary><nav aria-label="Profile sections"><ol>${contents}</ol></nav></details><fieldset id="editor-fields"><legend class="sr-only">Character profile</legend><article><aside class="infobox" id="identity" aria-label="Character information"><h2 data-display-name>${name}</h2><div class="epithet-field">${field(templateSections[0].fields.find(f=>f[0]==='title'))}</div><div class="identity-panel ${color}"><span class="monogram" id="monogram">${initials}</span></div><h3>Character information</h3>${templateSections[0].fields.filter(f=>f[0]!=='title').map(field).join('')}<small class="name-hint">Names can include hyphens and spaces.</small></aside>${body}</article></fieldset></form><footer class="profile-footer"><a href="/characters/">← Back to characters</a><a href="#profile">Back to top ↑</a></footer></main></div><script id="profile-data" type="application/json">${data}</script></body></html>`;
}
