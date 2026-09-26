import {repository} from './db.js';
import {sampleCharacter} from './sample-characters.js';
import {factionCatalog} from './factions.js';
import {locationCatalog} from './countries.js';
import {locationPaths} from '../public/locations/data.js';
import {escape,jsonData,renderSection,renderInfoGroup} from './profile-components.js';

const relationLabels={appears_in:'Appears in',referenced_by:'Referenced by',linked:'Linked to'};
const novelHref=id=>'/novels/'+encodeURIComponent(id)+'/';
const sectionTitle=kind=>['lore','story_arc'].includes(kind)?'Novel references':'Appearances';
function profileTarget(path){
 const match=path.match(/^\/(characters|factions|lore|story-arcs)\/([^/]+)\/$/);
 if(match)return {kind:{characters:'character',factions:'faction',lore:'lore','story-arcs':'story_arc'}[match[1]],id:match[2]};
 for(const [type,prefix] of Object.entries(locationPaths)){
  if(path.startsWith(prefix)&&/^[^/]+\/$/.test(path.slice(prefix.length)))return {kind:'location',id:path.slice(prefix.length,-1),type};
 }
 return null;
}
async function resolveTarget(db,owner,target){
 if(target.kind==='character')return await db.get(owner,target.id)||sampleCharacter(target.id);
 if(target.kind==='faction')return (await factionCatalog(db,owner)).find(item=>item.id===target.id);
 if(target.kind==='location')return (await locationCatalog(db,owner)).find(item=>item.id===target.id&&item.type===target.type);
 if(target.kind==='lore')return db.getLore(owner,target.id);
 return db.getStoryArc(owner,target.id);
}
function appearanceSection(data,{native=false}={}){
 const map=new Map(data.novels.map(novel=>[novel.id,novel]));
 const rows=data.associations.map(association=>{
  const novel=map.get(association.novelId),label=relationLabels[association.relationKind]||'Linked to';
  return `<section id="appearance-${escape(novel.id)}" class="novel-appearance-entry" data-appearance-id="${escape(association.id)}"><h3><span data-appearance-relation>${label}</span> <a href="${novelHref(novel.id)}">${escape(novel.title)}</a></h3><p class="novel-appearance-prose">${escape(association.prose||'No details yet.')}</p><button type="button" class="quiet-button" data-edit-appearance="${escape(association.id)}">Edit ${association.relationKind==='appears_in'?'appearance':association.relationKind==='referenced_by'?'reference':'link details'}</button></section>`;
 }).join('');
 const title=sectionTitle(data.target.kind),content=`<p class="section-note">This article is shared across novels. The details below belong to each individual novel.</p><div data-appearance-list>${rows||'<p class="section-note" data-appearance-empty>No novels linked yet.</p>'}</div><button type="button" class="quiet-button" data-link-appearance>Link an existing novel</button><p class="section-note" data-appearance-status role="status"></p>`;
 if(native)return `<section id="novel-appearances" class="profile-section" data-novel-appearances><details class="appearance-native-disclosure" open><summary class="section-header"><h2>${title}</h2></summary><div id="novel-appearances-body">${content}</div></details></section>`;
 return renderSection({id:'novel-appearances',title,fields:[]},content,{}).replace('<section ','<section data-novel-appearances ');
}
function infobox(data,{native=false}={}){
 const map=new Map(data.novels.map(novel=>[novel.id,novel]));
 const rows=data.associations.map(association=>{const novel=map.get(association.novelId);return `<li><a href="${novelHref(novel.id)}">${escape(novel.title)}</a><small>${relationLabels[association.relationKind]||'Linked to'}${novel.seriesTitle?` · <a href="/series/${encodeURIComponent(novel.seriesId)}/">${escape(novel.seriesTitle)}</a>`:''}</small></li>`;}).join('');
 const content=`<ul class="novel-appearance-links" data-appearance-infobox-list>${rows}</ul><p class="section-note" data-appearance-infobox-empty${rows?' hidden':''}>No novels linked yet.</p>`;
 if(native)return `<details class="card-group appearance-native-disclosure" data-appearance-infobox open><summary><h3>Linked novels</h3></summary>${content}</details>`;
 return renderInfoGroup('Linked novels','linked-novel-information',content).replace('<div class="card-group"','<div data-appearance-infobox class="card-group"');
}
function editor(){
 return `<dialog id="novel-appearance-dialog" class="novel-appearance-dialog" aria-labelledby="novel-appearance-editor-title"><form id="novel-appearance-form"><h2 id="novel-appearance-editor-title">Novel details</h2><p class="section-note">Save appearance or reference details for one novel. Your shared article stays in its own editor.</p><fieldset id="novel-appearance-fields"><legend class="sr-only">Novel appearance details</legend><label for="appearance-novel">Novel</label><select id="appearance-novel" name="novelId" required></select><label for="appearance-relation">Link kind</label><select id="appearance-relation" name="relationKind"><option value="appears_in">Appears in</option><option value="referenced_by">Referenced by</option><option value="linked">Linked to</option></select><label for="appearance-prose">Appearance or reference text</label><textarea id="appearance-prose" name="prose" rows="7" maxlength="10000"></textarea></fieldset><p id="appearance-editor-status" role="status"></p><p id="appearance-editor-error" role="alert" hidden></p><button type="button" class="quiet-button" id="appearance-review-version" hidden>Review saved version and keep my draft</button><details id="appearance-saved-preview" hidden><summary>Latest saved text</summary><p class="novel-appearance-prose" id="appearance-saved-text"></p></details><div class="appearance-dialog-actions"><button type="button" class="quiet-button" id="appearance-unlink" hidden>Unlink novel</button><button type="button" class="quiet-button" data-close-appearance>Close</button><button type="submit" class="quiet-button appearance-primary">Save details</button></div></form></dialog>`;
}

/** Add separate association views/editing to canonical HTML profiles. */
export async function enhanceNovelAppearances(request,env,response){
 if(request.method!=='GET'||response.status!==200||!response.headers.get('content-type')?.includes('text/html'))return response;
 const target=profileTarget(new URL(request.url).pathname),owner=request.headers.get('oai-authenticated-user-id');
 if(!target||!owner)return response;
 let html=await response.clone().text();if(html.includes('id="novel-appearances-data"'))return response;
 try{
  const db=repository(env.DB),record=await resolveTarget(db,owner,target);if(!record)return response;
  const [novels,series,associations]=await Promise.all([db.listNovels(owner),db.listSeries(owner),db.listNovelAssociationsByTarget(owner,target.kind,target.id)]);
  const owned=new Map(novels.map(novel=>[novel.id,novel])),seriesMap=new Map(series.map(item=>[item.id,item]));
  const data={target:{kind:target.kind,id:target.id,label:record.name||record.title||'This article'},novels:novels.map(novel=>({id:novel.id,title:novel.title||'Untitled novel',status:novel.status,seriesId:novel.seriesId||'',seriesTitle:seriesMap.get(novel.seriesId)?.title||''})),associations:associations.filter(association=>owned.has(association.novelId)).sort((a,b)=>String(owned.get(a.novelId).title||'').localeCompare(String(owned.get(b.novelId).title||''))||a.novelId.localeCompare(b.novelId))};
  const pilot=html.includes('id="lore-profile-root"'),section=appearanceSection(data,{native:pilot}),info=infobox(data,{native:pilot});
  html=html.replace('<footer class="profile-footer">',section+'<footer class="profile-footer">');
  html=html.replace(/(<aside\b[^>]*class="[^"]*\binfobox\b[^"]*"[^>]*>[\s\S]*?)(<\/aside>)/,(_,inside,close)=>inside+info+close);
  // The React note pilot mounts its article after this response. Inert templates
  // let the separate client mount the same section without owning React fields.
  html=html.replace('</head>','<link rel="stylesheet" href="/novels/appearances.css?v=__WTF_ASSET_REVISION__"><script type="module" src="/novels/appearances.js?v=__WTF_ASSET_REVISION__"></script></head>');
  html=html.replace('</body>',`<template id="novel-appearances-template">${section}</template><template id="novel-appearances-infobox-template">${info}</template>${editor()}<script id="novel-appearances-data" type="application/json">${jsonData(data)}</script></body>`);
  const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');
  return new Response(html,{status:response.status,headers});
 }catch(error){console.error('Novel appearance links could not be loaded',error.message);return response;}
}
