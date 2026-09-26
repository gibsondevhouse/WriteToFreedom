import {repository} from './db.js';
import {writingRepository} from './writing-repository.js';
import {characterCast} from './sample-characters.js';
import {factionCatalog} from './factions.js';
import {locationCatalog} from './countries.js';
import {locationHref} from '../public/locations/data.js';
import {escape, createFieldRenderer, renderFieldWrapper, renderInfoGroup, renderProfileName, renderProfilePage, renderSection} from './profile-components.js';
import {renderDirectoryPage} from './directory-shell.js';

const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const htmlHeaders={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const statuses=[['drafting','Drafting'],['revising','Revising'],['complete','Complete'],['archived','Archived']];
const kindLabels={character:'Characters',faction:'Factions',location:'Locations',lore:'Lore',story_arc:'Story arcs'};
const articleSection={character:'characters',faction:'places-and-factions',location:'places-and-factions',lore:'lore-and-arcs',story_arc:'lore-and-arcs'};
const profileUrl=(kind,id)=>({character:'/characters/',faction:'/factions/',lore:'/lore/',story_arc:'/story-arcs/'}[kind]||'/')+encodeURIComponent(id)+'/';
const sentence=value=>escape(String(value||'').trim());

function directory(kind){
 const novel=kind==='novel',plural=novel?'novels':'series';
 return renderDirectoryPage({
  id:novel?'novels-directory':'series-directory',title:novel?'My novels':'Series',
  singular:novel?'novel':'series',plural,
  eyebrow:novel?'MANUSCRIPTS & BOOKS':'CONNECTED STORIES',
  description:novel?'Browse your manuscripts and open the right writing workspace.':'Explore your series and the books within each one.',
  script:'/novels/directory.js?v=__WTF_ASSET_REVISION__',
  styles:['/dashboard/shell.css?v=__WTF_ASSET_REVISION__','/novels/directory.css?v=__WTF_ASSET_REVISION__'],
  searchPlaceholder:novel?'Search titles, synopses, or status…':'Search series titles or summaries…',
  leadingAction:{label:novel?'Browse series':'Browse novels',href:novel?'/series/':'/novels/'},
  primaryAction:{id:novel?'new-novel':'new-series',label:novel?'New novel':'New series',icon:'+'},
  views:[{value:'cards',label:'Covers'},{value:'list',label:'List'}],
  sorts:[{value:'order',label:'Recently updated'},{value:'name',label:'Alphabetical'}],
  empty:{title:novel?'No novels yet':'No series yet',description:novel?'Create a novel to start a manuscript.':'Series help you arrange related novels. Standalone novels need no series.'},
  noResults:{title:novel?'No novels found':'No series found',description:'Try another title or keyword.'},
  slots:{dialogs:`<dialog class="novel-create-dialog" id="create-${kind}-dialog" aria-labelledby="create-${kind}-title"><form id="create-${kind}-form"><h2 id="create-${kind}-title">New ${kind}</h2><p>Start with a title. You can add the details in its profile.</p><label for="create-${kind}-name">Title</label><input id="create-${kind}-name" name="title" maxlength="480" autocomplete="off" required><p id="create-${kind}-error" role="alert" hidden></p><div class="novel-dialog-actions"><button type="button" data-cancel-create>Cancel</button><button type="submit" class="directory-action directory-primary-action">Create ${kind}</button></div></form></dialog>`}
 });
}

function articleLink(target){return `<a href="${escape(target.href)}">${escape(target.label)}</a>`;}
function entityTargets({characters,factions,locations,lore,storyArcs}){
 return [
  ...characterCast(characters).map(item=>({kind:'character',id:item.id,label:item.name||'Untitled character',href:profileUrl('character',item.id)})),
  ...factions.map(item=>({kind:'faction',id:item.id,label:item.name||'Untitled faction',href:profileUrl('faction',item.id)})),
  ...locations.map(item=>({kind:'location',id:item.id,label:item.name||'Untitled location',href:locationHref(item)})),
  ...lore.map(item=>({kind:'lore',id:item.id,label:item.name||'Untitled lore',href:profileUrl('lore',item.id)})),
  ...storyArcs.map(item=>({kind:'story_arc',id:item.id,label:item.name||'Untitled story arc',href:profileUrl('story_arc',item.id)}))
 ];
}
const targetKey=(kind,id)=>kind+':'+id;
function linkedItems(associations,targets){
 const map=new Map(targets.map(target=>[targetKey(target.kind,target.id),target]));
 return associations.map(association=>({
  ...association,target:map.get(targetKey(association.targetKind,association.targetId))||null
 }));
}
function linkedList(items,kind,{editable=false}={}){
 const selected=items.filter(item=>item.targetKind===kind);
 return `<div class="novel-entity-group" data-association-group="${kind}"><h3>${kindLabels[kind]}</h3><ul>${selected.map(item=>`<li data-association-id="${escape(item.id)}">${item.target?articleLink(item.target):`<span>Unavailable ${escape(kind.replace('_',' '))}</span>`}${editable?` <button type="button" data-remove-association="${escape(item.id)}" aria-label="Remove ${escape(item.target?.label||'reference')} from this novel">Remove</button>`:''}</li>`).join('')}</ul>${selected.length?'':`<p class="section-note" data-group-empty>No ${kindLabels[kind].toLowerCase()} linked yet.</p>`}</div>`;
}
function linkedGroups(items,kinds,options){return kinds.map(kind=>linkedList(items,kind,options)).join('');}
function cover(record){
 const src=typeof record.coverUrl==='string'&&/^https:\/\/[^\s]+$/i.test(record.coverUrl)?` src="${escape(record.coverUrl)}"`:'';
 return `<figure class="novel-cover"><div class="novel-cover-art"><span aria-hidden="true">${escape((record.title||'?').trim().charAt(0).toUpperCase()||'?')}</span><img data-image="coverUrl" alt="" referrerpolicy="no-referrer"${src}${src?'':' hidden'}></div><figcaption>${escape(record.title||'Untitled')}</figcaption><small data-image-error="coverUrl" hidden>Image unavailable. Check its URL.</small></figure>`;
}
function chapterList(novel,chapters,scenes){
 const byChapter=new Map();for(const scene of scenes)byChapter.set(scene.chapterId,(byChapter.get(scene.chapterId)||0)+1);
 if(!chapters.length)return '<p class="section-note">No chapters yet. Open the writing workspace to start this manuscript.</p>';
 return `<ol class="novel-chapters">${chapters.map(chapter=>{
  const params=`novel=${encodeURIComponent(novel.id)}&chapter=${encodeURIComponent(chapter.id)}`;
  const count=byChapter.get(chapter.id)||0;
  return `<li><div><strong>${escape(chapter.title||'Untitled chapter')}</strong><p>${sentence(chapter.summary)||'Add a chapter summary in the writing workspace.'}</p><small>${count} scene${count===1?'':'s'}</small></div><div class="novel-chapter-actions"><a href="/chapters/?${params}">Edit chapter</a><a href="/scenes/?${params}">Write scenes →</a></div></li>`;
 }).join('')}</ol>`;
}
function seriesOptions(series){return [['','Standalone novel'],...series.map(item=>[item.id,item.title||'Untitled series'])];}
function novelInfo(record,series){
 const field=createFieldRenderer(record,{required:['title'],maxLengths:{title:480},options:key=>key==='status'?statuses:key==='seriesId'?seriesOptions(series):null});
 const order=renderFieldWrapper(record,'seriesOrder','Position in series','number',`<input id="field-seriesOrder" name="seriesOrder" type="number" min="0" max="9999" step="1" value="${Number.isSafeInteger(record.seriesOrder)?record.seriesOrder:0}" aria-label="Position in series">`);
 return {field,infobox:renderProfileName({...record,name:record.title},'novel')+cover(record)+
  renderInfoGroup('Manuscript details','novel-details',field(['title','Title','input'])+field(['status','Drafting status','select'])+field(['seriesId','Primary series','select'])+order)+
  renderInfoGroup('Artwork','novel-artwork',field(['coverUrl','Cover image URL','url']))};
}
function renderNovel(record,{series,chapters,scenes,associations,targets}){
 targets=targets.map(target=>{
  const url=new URL(target.href,'https://write-to-freedom.local');url.searchParams.set('novel',record.id);url.hash='appearance-'+record.id;
  return {...target,href:url.pathname+url.search+url.hash};
 });
 const {field,infobox}=novelInfo(record,series),items=linkedItems(associations,targets);
 const picker=`<div class="novel-association-picker"><label for="novel-link-target">Add an existing entry</label><select id="novel-link-target"><option value="">Choose an entry…</option>${Object.entries(kindLabels).map(([kind,label])=>`<optgroup label="${label}">${targets.filter(item=>item.kind===kind).map(item=>`<option value="${escape(targetKey(item.kind,item.id))}">${escape(item.label)}</option>`).join('')}</optgroup>`).join('')}</select><button type="button" id="add-novel-association" class="quiet-button">Link entry</button><p id="novel-association-status" role="status"></p></div>`;
 const overview=renderSection({id:'overview',title:'Overview',fields:[['synopsis','Synopsis']]},field(['synopsis','Synopsis','textarea','Describe this novel…']),record,{menuFields:[['synopsis','Synopsis'],['status','Drafting status'],['coverUrl','Cover image URL'],['seriesId','Primary series'],['seriesOrder','Position in series']]});
 const manuscript=renderSection({id:'manuscript',title:'Manuscript',fields:[]},`<p class="section-note">Chapters in this novel, in manuscript order.</p>${chapterList(record,chapters,scenes)}<p class="novel-section-action"><a href="/scenes/?novel=${encodeURIComponent(record.id)}">Open scene-writing workspace →</a></p>`,record);
 const characters=renderSection({id:'characters',title:'Characters',fields:[]},linkedGroups(items,['character'],{editable:true}),record);
 const places=renderSection({id:'places-and-factions',title:'Locations and factions',fields:[]},linkedGroups(items,['location','faction'],{editable:true}),record);
 const lore=renderSection({id:'lore-and-arcs',title:'Lore, notes and story arcs',fields:[]},linkedGroups(items,['lore','story_arc'],{editable:true}),record);
 const links=renderSection({id:'link-material',title:'Link existing material',fields:[]},`${picker}<p class="section-note">Entries keep one canonical article and can appear in several novels.</p>`,record);
 return renderProfilePage({record:{...record,name:record.title},type:'novel',collection:'My novels',collectionUrl:'/novels/',infobox,content:overview+manuscript+characters+places+lore+links,script:'/novels/profile.js',styles:['/novels/profile.css'],initial:{...record,kind:'novel',targets,associations},boxClass:'novel-infobox'});
}
function seriesBookList(series,novels){
 if(!novels.length)return '<p class="section-note">No novels are in this series yet. Open a novel profile and select this series.</p>';
 return `<ol class="series-books" id="series-books">${novels.map((novel,index)=>`<li data-series-novel="${escape(novel.id)}"><a href="/novels/${encodeURIComponent(novel.id)}/">${escape(novel.title||'Untitled novel')}</a><span>${escape(statuses.find(([value])=>value===novel.status)?.[1]||novel.status||'Drafting')}</span><a href="/scenes/?novel=${encodeURIComponent(novel.id)}">Write scenes →</a><div class="series-book-move"><button type="button" data-series-move="up" class="quiet-button" aria-label="Move ${escape(novel.title||'novel')} earlier"${index===0?' disabled':''}>↑</button><button type="button" data-series-move="down" class="quiet-button" aria-label="Move ${escape(novel.title||'novel')} later"${index===novels.length-1?' disabled':''}>↓</button></div></li>`).join('')}</ol>${novels.length>1?'<button type="button" class="quiet-button" id="save-series-order" disabled>Save book order</button><p class="section-note" id="series-order-status" role="status">Book order is saved.</p>':''}<p class="section-note">Select this series on a novel profile to add a book.</p>`;
}
function renderSeries(record,{novels,associations,targets}){
 const field=createFieldRenderer(record,{required:['title'],maxLengths:{title:480}}),items=linkedItems(associations,targets);
 const infobox=renderProfileName({...record,name:record.title},'series')+cover(record)+renderInfoGroup('Series details','series-details',field(['title','Title','input']))+renderInfoGroup('Artwork','series-artwork',field(['coverUrl','Cover image URL','url']));
 const books=renderSection({id:'books',title:'Books in order',fields:[]},seriesBookList(record,novels),record);
 const overview=renderSection({id:'overview',title:'Overview',fields:[['summary','Summary']]},field(['summary','Summary','textarea','Describe this series…']),record,{menuFields:[['summary','Summary'],['coverUrl','Cover image URL']]});
 const shared=renderSection({id:'shared-material',title:'Shared material',fields:[]},`<p class="section-note">Entries linked to the novels in this series. Each article appears once here.</p>${linkedGroups(items,Object.keys(kindLabels))}`,record);
 return renderProfilePage({record:{...record,name:record.title},type:'series',collection:'Series',collectionUrl:'/series/',infobox,content:books+overview+shared,script:'/novels/profile.js',styles:['/novels/profile.css'],initial:{...record,kind:'series',novelIds:novels.map(novel=>novel.id)},boxClass:'novel-infobox'});
}

/** HTML pages only. JSON API ownership and writes remain in novel-routes.js. */
export async function novelPageRoute(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(path==='/novels'||path==='/series')return Response.redirect(url.origin+path+'/'+url.search,308);
 if(path==='/novels/'||path==='/novels/index.html'||path==='/series/'||path==='/series/index.html'){
  const html=directory(path.startsWith('/novels')?'novel':'series');
  return new Response(request.method==='HEAD'?null:html,{headers:htmlHeaders});
 }
 const match=path.match(/^\/(novels|series)\/([^/]+)(?:\/(?:index\.html)?)?$/);
 if(!match)return new Response('Page not found',{status:404});
 const [,kind,id]=match;
 if(!idPattern.test(id))return new Response('Page not found',{status:404});
 if(!path.endsWith('/')&&!path.endsWith('/index.html'))return Response.redirect(url.origin+'/'+kind+'/'+id+'/'+url.search,308);
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return new Response('Sign in to access your '+(kind==='novels'?'novels':'series')+'.',{status:401,headers:{'cache-control':'no-store'}});
 try{
  const db=repository(env.DB),record=kind==='novels'?await db.getNovel(owner,id):await db.getSeries(owner,id);
  if(!record)return new Response(kind==='novels'?'Novel not found.':'Series not found.',{status:404,headers:{'cache-control':'no-store'}});
  if(request.method==='HEAD')return new Response(null,{headers:htmlHeaders});
  const [series,novels,characters,factions,locations,lore,storyArcs]=await Promise.all([
   db.listSeries(owner),db.listNovels(owner),db.list(owner),factionCatalog(db,owner),locationCatalog(db,owner),db.listLore(owner),db.listStoryArcs(owner)
  ]);
  const targets=entityTargets({characters,factions,locations,lore,storyArcs});
  if(kind==='novels'){
   const writing=writingRepository(env.DB);
   const [chapters,scenes,associations]=await Promise.all([writing.listChapters(owner,id),writing.listScenes(owner,undefined,id),db.listNovelAssociations(owner,id)]);
   return new Response(renderNovel(record,{series,chapters:chapters.filter(chapter=>chapter.novelId===id),scenes,associations,targets}),{headers:htmlHeaders});
  }
  const books=novels.filter(novel=>novel.seriesId===id).sort((a,b)=>(a.seriesOrder??0)-(b.seriesOrder??0)||String(a.createdAt||'').localeCompare(String(b.createdAt||''))||a.id.localeCompare(b.id));
  const associations=(await Promise.all(books.map(novel=>db.listNovelAssociations(owner,novel.id)))).flat();
  const unique=[...new Map(associations.map(item=>[targetKey(item.targetKind,item.targetId),item])).values()];
  return new Response(renderSeries(record,{novels:books,associations:unique,targets}),{headers:htmlHeaders});
 }catch(error){console.error('Novel page request failed',error.message);return new Response('This page could not be loaded. Please try again.',{status:503,headers:{'cache-control':'no-store'}});}
}
