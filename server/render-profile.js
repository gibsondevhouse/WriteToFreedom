import {ancestors,typeLabels} from '../public/locations/data.js';
import { characters as seeds } from '../public/characters/data.js';
import { templateSections, nameFields, storyRoles, alignments, humanFieldGroups, humanFields, humanChoices } from '../public/characters/template.js';
import {escape,renderChoice,renderDateControl,renderFieldWrapper,renderSection,renderInfoGroup,renderProfileName,renderProfilePage} from './profile-components.js';
export {escape} from './profile-components.js';
export function renderProfile(character, cast, factions=[],locations=[],notes=[]) {
 const color=seeds.find(c=>c.id===character.id)?.color||'blue';
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
   control=`<select ${attrs}><option value="">Not yet chosen</option>${choices.map(l=>`<option value="${escape(l.id)}"${val===l.id?' selected':''}>${escape(l.name)}${type==='location'?' — '+escape(ancestors(l,locations).map(p=>p.name).join(' › ')||typeLabels[l.type]):''}</option>`).join('')}</select>`;
  }else if(type==='number')control=`<input ${attrs} type="number" min="0" step="${key==='age'?'1':'any'}" value="${escape(val)}" placeholder="Not set">`;
  else if(type==='choice')control=renderChoice(key,label,val,attrs,{continents:locations.filter(l=>l.type==='continent'),nationalityContinents:character.nationalityContinents||{}});
  else if(type==='date')control=renderDateControl(key,label,val,attrs);
  else if(type==='url')control=`<input ${attrs} type="url" pattern="https://.*" maxlength="2048" value="${escape(val)}" placeholder="https://…">`;
  else if(type==='input')control=`<input ${attrs} type="text" autocomplete="off" maxlength="${nameFields.includes(key)?160:10000}" value="${escape(val)}" placeholder="Add ${escape(label.toLowerCase())}…">`;
  else control=`<textarea ${attrs} rows="2" maxlength="10000" placeholder="Add ${escape(label.toLowerCase())}…">${escape(val)}</textarea>`;
  return renderFieldWrapper(character,key,label,type,control);
 };
 const body=templateSections.filter(s=>s.id!=='identity').map(section=>{
  const fields=section.id==='overview'?[section.fields[1],section.fields[0]]:section.fields;
  const content=section.id==='relationships'?`<div data-profile-field="relationships"${character.hiddenFields?.includes('relationships')?' hidden':''}><div id="relationship-fields"></div><button type="button" id="add-relationship" class="quiet-button">+ Add relationship</button></div>`:fields.map(field).join('');
  return renderSection(section,content,character,{fullWidth:section.id==='relationships',allowNotes:section.fields.some(f=>f[2]==='textarea'),menuFields:section.id==='relationships'?[['relationships','Relationship entries']]:section.fields});
 }).join('')+renderSection({id:'notes',title:'Notes',fields:[]},renderNotes(notes,character.notes||[]),character);
 const identityFields=templateSections[0].fields.filter(f=>f[0]!=='title'&&!humanFields.some(h=>h[0]===f[0]));
 const cardGroups=[{title:'Character information',fields:identityFields},...humanFieldGroups].map((group,index)=>renderInfoGroup(group.title,'identity-group-'+index,group.fields.map(field).join(''))).join('');
 const infobox=renderProfileName(character,'character')+`<div class="epithet-field">${field(templateSections[0].fields.find(f=>f[0]==='title'))}</div><div class="identity-panel ${color}"><span class="monogram" id="monogram">${initials}</span></div>${cardGroups}<small class="name-hint">Dates can use your story’s calendar. Height and weight use the selected units.</small><small class="name-hint">Names can include hyphens and spaces.</small>`;
 return renderProfilePage({record:character,type:'character',collection:'Characters',collectionUrl:'/characters/',infobox,content:body,script:'/characters/profile-editor.js',styles:['/characters/attribute-controls.css','/characters/profile-card.css','/characters/profile-notes.css'],initial:{character,cast:cast.map(c=>({id:c.id,name:c.name})),factions}});
}

function renderNotes(notes,authored){
 const own=`<ol id="authored-notes" class="profile-references"${authored.length?'':' hidden'}>${authored.map((note,index)=>`<li id="note-${escape(note.id)}"><a class="reference-backlink" href="#field-${escape(note.field)}" aria-label="Return to note ${index+1} in the text">↑</a> <span class="reference-text">${escape(note.text)}</span></li>`).join('')}</ol>`;
 const references=`<ol id="mentioned-notes" class="profile-references" start="${authored.length+1}"${notes.length?'':' hidden'}>${notes.map((note,index)=>`<li id="character-note-${index+1}"><a class="reference-backlink" href="${escape(note.href)}" aria-label="Open source for note ${authored.length+index+1}: ${escape(note.source)}" title="Open source">↑</a> <a class="reference-source" href="${escape(note.href)}">${escape(note.source)}</a>. <span class="reference-label">${escape(note.label)}</span>. <span class="reference-text">${escape(note.text.replace(/\s+/g,' ').trim())}</span></li>`).join('')}</ol>`;
 return own+references+`<p id="notes-empty" class="reference-empty"${authored.length||notes.length?' hidden':''}>No notes yet.</p>`;
}
