import {loreTypes,loreTemplates,loreCollections,allowedCollections,primaryCollection,validImageUrl} from '../public/lore/template.js';
import {referenceKey} from '../public/characters/notes.js';
import {escape,jsonData,profileRevision,createFieldRenderer,renderSection,renderInfoGroup,renderProfileName,renderProfilePage,renderRatingsHost} from './profile-components.js';
import {ratingGroupsFor} from '../public/profiles/ratings.js';
import {frontendAssets} from './frontend-assets.js';

/** The standalone note owns a single React region; no legacy profile controller runs here. */
function renderNotePilot(record,targets,incoming){
 const name=escape(record.name?.trim()||'Untitled lore');
 const styles=['/profiles/profile.css','/profiles/editor.css','/profiles/date-picker.css','/characters/attribute-controls.css','/profiles/ratings.css','/locations/countries/profile.css','/lore/profile.css'];
 const initial={record,targets:targets.filter(t=>!(t.kind==='lore'&&t.id===record.id)),incoming};
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${name} — Write to Freedom</title><link rel="icon" href="/crest.svg">${styles.map(path=>`<link rel="stylesheet" href="${path}?v=${profileRevision}">`).join('')}${frontendAssets('frontend/lore-profile.tsx')}</head><body class="entity-profile lore-profile"><div class="page-layout" id="lore-profile-root"><main><h1>${name}</h1><p role="status">Loading note…</p><noscript>Enable JavaScript to edit and save this note.</noscript></main></div><script id="profile-data" type="application/json">${jsonData(initial)}</script></body></html>`;
}

export function renderLore(record,targets,incoming){
 if(record.type==='note')return renderNotePilot(record,targets,incoming);
 const template=loreTemplates[record.type],ratingGroups=ratingGroupsFor('lore',record.type),field=createFieldRenderer(record,{required:['name']}),visible=record.imageUrl&&validImageUrl(record.imageUrl);
 const image=`<figure class="country-media country-map"><img data-image="imageUrl" alt="${escape(record.name)}" referrerpolicy="no-referrer"${visible?` src="${escape(record.imageUrl)}"`:' hidden'}><figcaption><details${visible?'':' open'}><summary>Image</summary>${field(['imageUrl','Image URL','url'])}</details><small class="image-error" data-image-error="imageUrl" hidden>Image unavailable. Check its URL.</small></figcaption></figure>`;
 const collections=allowedCollections(record.type).map(c=>`<label class="lore-check"><input type="checkbox" data-collection="${c}"${record.collections.includes(c)?' checked':''}${c===primaryCollection[record.type]?' disabled':''}> ${loreCollections[c]}</label>`).join('');
 const infobox=renderProfileName(record,record.type)+`<p class="lore-type">${loreTypes[record.type]}</p>`+renderInfoGroup('Image','symbols',image)+renderInfoGroup('Entry information','identity-information',template.sections[0].fields.map(field).join(''))+
  renderInfoGroup('Collections','identity-collections',collections)+renderInfoGroup('On your dashboard','identity-dashboard',`<label class="lore-check"><input type="checkbox" id="lore-pinned"${record.pinned?' checked':''}> Pin to Continue building</label><label class="lore-check"><input type="checkbox" id="lore-featured"${record.featured?' checked':''}> Feature on Lore</label>`);
 const body=template.sections.filter(s=>!['identity','symbols'].includes(s.id)).map(s=>renderSection(s,s.fields.map(field).join('')+renderRatingsHost(ratingGroups,s.id),record)).join('');
 const targetMap=new Map(targets.map(t=>[referenceKey(t),t]));
 const outgoing=record.connections.map(c=>{const target=targetMap.get(referenceKey(c.target));return `<li>${escape(c.relationship)}: ${target?`<a href="${escape(target.href)}">${escape(target.label)}</a>`:'Unavailable entry'}</li>`;}).join('');
 const related=renderSection({id:'connections',title:'Connections',fields:[]},`<div id="lore-connections"></div><button type="button" class="lore-add-link" id="add-lore-connection">Add a connection</button><p class="section-note">Describe the connection, such as “owned by”, “describes”, or “found in”.</p><noscript><ul>${outgoing}</ul></noscript>`,record);
 const backlinks=renderSection({id:'linked-from',title:'Linked from',fields:[]},incoming.length?`<ul class="lore-backlinks">${incoming.map(n=>`<li><a href="${escape(n.href)}">${escape(n.title||n.source)}</a><p>${escape(n.text)}</p></li>`).join('')}</ul>`:'<p class="section-note">Entries and character notes that link here will appear here.</p>',record);
 return renderProfilePage({record,type:'lore',collection:'Lore',collectionUrl:'/lore/',infobox,content:body+related+backlinks,script:'/lore/profile.js',styles:['/characters/attribute-controls.css','/profiles/ratings.css','/locations/countries/profile.css','/lore/profile.css'],initial:{record,targets:targets.filter(t=>!(t.kind==='lore'&&t.id===record.id))},boxClass:'country-infobox lore-infobox'});
}
