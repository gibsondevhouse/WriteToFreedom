import {noteContent} from '../public/characters/note-content.js';
import {referenceKey} from '../public/characters/notes.js';
import {noteTargets,connectedNotes} from './note-connections.js';
import {ancestors,typeLabels} from '../public/locations/data.js';
import { characters as seeds } from '../public/characters/data.js';
import { templateSections, nameFields, storyRoles, alignments, humanFieldGroups, humanFields, humanChoices } from '../public/characters/template.js';
import {escape,renderChoice,renderDateControl,renderFieldWrapper,renderArticleProfile} from './profile-components.js';
export {escape} from './profile-components.js';
/**
 * Compose the character article from shared profile primitives plus specialized
 * relationships, attributes and authored notes. Inputs are owner-scoped by the
 * route. Initial JSON supplies the character, choices and note targets/backlinks
 * to profile-editor.js; external mentions exclude own notes to avoid duplication.
 * Returns HTML only: persistence and outer workspace navigation belong elsewhere.
 */
export function renderProfile(character, cast, factions=[],locations=[],notes=[],lore=[]) {
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
  }else if(type==='number')control=`<input ${attrs} type="text" inputmode="${key==='age'?'numeric':'decimal'}" maxlength="10000" value="${escape(val)}" placeholder="Not set">`;
  else if(type==='choice')control=renderChoice(key,label,val,attrs,{continents:locations.filter(l=>l.type==='continent'),nationalityContinents:character.nationalityContinents||{},choiceSelections:character.choiceSelections});
  else if(type==='date')control=renderDateControl(key,label,val,attrs);
  else if(key==='portraitUrl'){
   const uploaded=val.startsWith('/api/characters/');
   return `<div data-profile-field="portraitUrl" class="inline-field portrait-source-field"><label for="field-portraitUrl">Portrait</label><div class="portrait-source-control"><div class="portrait-source-actions" role="group" aria-label="Portrait source"><button type="button" id="portrait-link-action" class="portrait-source-button" aria-label="Add portrait from link" title="Add portrait from link" aria-controls="portrait-link-panel" aria-expanded="false" aria-pressed="${Boolean(val)&&!uploaded}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/></svg></button><button type="button" id="portrait-image-action" class="portrait-source-button" aria-label="Upload portrait image" title="Upload portrait image" aria-pressed="${uploaded}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 16-5-5L5 21"/></svg></button><button type="button" id="portrait-ai-action" class="portrait-source-button" aria-label="Generate portrait with AI (coming soon)" title="AI portrait generation coming soon" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="m19 18 .8 1.2L21 20l-1.2.8L19 22l-.8-1.2L17 20l1.2-.8z"/></svg></button></div><div id="portrait-link-panel" class="portrait-source-panel" hidden><input ${attrs} type="text" inputmode="url" autocomplete="off" maxlength="2048" value="${escape(val)}" placeholder="https://…"></div><input id="portrait-image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden><span id="portrait-source-status" class="portrait-source-status" role="status" hidden></span></div></div>`;
  }
  else if(type==='url')control=`<input ${attrs} type="url" pattern="https://.*" maxlength="2048" value="${escape(val)}" placeholder="https://…">`;
  else if(type==='input')control=`<input ${attrs} type="text" autocomplete="off" maxlength="${nameFields.includes(key)?160:10000}" value="${escape(val)}" placeholder="Add ${escape(label.toLowerCase())}…">`;
  else control=`<textarea ${attrs} rows="2" maxlength="10000" placeholder="Add ${escape(label.toLowerCase())}…">${escape(val)}</textarea>`;
  return renderFieldWrapper(character,key,label,type,control);
 };
 const sections=templateSections.filter(s=>s.id!=='identity').map(section=>{
  const fields=section.id==='overview'?[section.fields[1],section.fields[0]]:section.fields;
  const content=section.id==='relationships'?`<div data-profile-field="relationships"${character.hiddenFields?.includes('relationships')?' hidden':''}><div id="relationship-fields"></div><button type="button" id="add-relationship" class="quiet-button">+ Add relationship</button></div>`:fields.map(field).join('');
  return {section,content,options:{fullWidth:section.id==='relationships',allowNotes:section.fields.some(f=>f[2]==='textarea'),menuFields:section.id==='relationships'?[['relationships','Relationship entries']]:section.fields}};
 });
 sections.push({section:{id:'notes',title:'Notes',fields:[]},content:renderNotes(notes,character.notes||[],noteTargets(cast,factions,locations,lore))});
 const identityFields=templateSections[0].fields.filter(f=>f[0]!=='title'&&!humanFields.some(h=>h[0]===f[0]));
 const cardGroups=[{title:'Character information',fields:identityFields},...humanFieldGroups].map((group,index)=>({title:group.title,id:'identity-group-'+index,content:group.fields.map(field).join('')}));
 const identity={record:character,type:'character',epithet:field(templateSections[0].fields.find(f=>f[0]==='title')),portrait:`<div class="identity-panel ${color}"><span class="monogram" id="monogram">${initials}</span></div>`,groups:cardGroups,hints:['Dates can use your story’s calendar. Height and weight use the selected units.','Names can include hyphens and spaces.']};
 return renderArticleProfile({identity,sections,record:character,type:'character',collection:'Characters',collectionUrl:'/characters/',script:'/characters/profile-editor.js',styles:['/characters/attribute-controls.css','/characters/profile-notes.css','/characters/portrait-controls.css'],initial:{character,locations,noteTargets:noteTargets(cast,factions,locations,lore),noteBacklinks:Object.fromEntries((character.notes||[]).map(n=>[n.id,connectedNotes(cast,{kind:'note',id:n.id,characterId:character.id},lore)])),cast:cast.map(c=>({id:c.id,name:c.name})),factions}});
}

function renderNotes(notes,authored,targets){
 const catalog=new Map(targets.map(t=>[referenceKey(t),t]));
 const inline=note=>noteContent(note,targets).map(part=>{const target=part.ref&&catalog.get(referenceKey(part.ref));return target?`<a class="note-inline-link" href="${escape(target.href)}">${escape(part.text)}</a>`:escape(part.text);}).join('');
 const detail=note=>note.type&&note.type!=='detail'?`<div class="note-details"><span class="note-kind">${escape(note.type)}</span></div>`:'';

 const own=`<ol id="authored-notes" class="profile-references"${authored.length?'':' hidden'}>${authored.map((note,index)=>`<li id="note-${escape(note.id)}"><a class="reference-backlink" href="#field-${escape(note.field)}" aria-label="Return to note ${index+1} in the text">↑</a> ${note.title?`<strong class="note-title">${escape(note.title)}</strong>. `:''}<span class="reference-text">${inline(note)}</span>${detail(note)}</li>`).join('')}</ol>`;
 const references=`<ol id="mentioned-notes" class="profile-references" start="${authored.length+1}"${notes.length?'':' hidden'}>${notes.map((note,index)=>`<li id="character-note-${index+1}"><a class="reference-backlink" href="${escape(note.href)}" aria-label="Open source for note ${authored.length+index+1}: ${escape(note.source)}" title="Open source">↑</a> <a class="reference-source" href="${escape(note.href)}">${escape(note.source)}</a>. <span class="reference-label">${escape(note.label)}</span>. <span class="reference-text">${inline(note)}</span></li>`).join('')}</ol>`;
 return own+references+`<p id="notes-empty" class="reference-empty"${authored.length||notes.length?' hidden':''}>No notes yet.</p>`;
}
