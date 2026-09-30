import {repository} from './db.js';
import {writingRepository} from './writing-repository.js';
import {validateWritingContent,writingContentSchemaVersion} from '../public/writing/document.js';
import {escape,jsonData,renderArticleProfile,renderProfileHero} from './profile-components.js';
import {frontendAssets} from './frontend-assets.js';
import {validImageUrl} from '../public/locations/countries/template.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const htmlHeaders={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const statuses={draft:'Draft',revising:'Revising',complete:'Complete'};
const markTags={bold:'strong',italic:'em',strike:'s',underline:'u',code:'code'};
const notFound=()=>new Response('Chapter not found.',{status:404,headers:{'cache-control':'no-store'}});
const chapterNumber=(chapter,ordinal)=>Number.isSafeInteger(chapter.chapterNumber)&&chapter.chapterNumber>=1&&chapter.chapterNumber<=9999?chapter.chapterNumber:ordinal;

function sceneCard(book,scene){
 const title=book.title||'Untitled novel',name=scene?.title||'Your next scene';
 const monogram=title.replace(/^The\s+/i,'').trim().split(/\s+/).slice(0,2).map(word=>word[0]||'').join('').toUpperCase()||'?';
 const header=scene?`<div class="chapter-scene-card-header"><h2 class="chapter-scene-title">${escape(scene.title||'Untitled scene')}</h2></div>`:'';
 const cover=`<div class="chapter-scene-cover-well"><div class="chapter-scene-book-cover"><div class="chapter-scene-cover-placeholder" role="img" aria-label="Book cover placeholder for ${escape(title)}"${book.coverUrl?' aria-hidden="true"':''}><span class="chapter-scene-cover-monogram" aria-hidden="true">${escape(monogram)}</span><span class="chapter-scene-cover-title" aria-hidden="true">${escape(title)}</span></div>${book.coverUrl?`<img src="${escape(book.coverUrl)}" alt="Book cover for ${escape(title)}" referrerpolicy="no-referrer">`:''}</div></div>`;
 const copy=`<div class="chapter-scene-card-copy">${scene?'':`<h3 class="chapter-scene-card-heading">${escape(name)}</h3>`}<div class="chapter-scene-card-summary-field"><span>Scene summary</span><p class="chapter-scene-card-summary">${escape(scene?(scene.summary||'Describe what happens in this scene…'):'Add a scene to start writing here.')}</p></div></div>`;
 return `<div class="chapter-scene-card chapter-scene-image${scene?'':' chapter-scene-card-empty'}" role="group" aria-label="${escape(scene?'Scene card: '+name:'New scene card')}">${header}${cover}${copy}</div>`;
}

/** Render only the validated writing AST; no stored or user-supplied HTML. */
function renderWritingNode(node){
 const children=()=>node.content?.map(renderWritingNode).join('')||'';
 const marked=text=>(node.marks||[]).reduce((value,mark)=>`<${markTags[mark.type]}>${value}</${markTags[mark.type]}>`,text);
 switch(node.type){
  case 'doc':return children();
  case 'text':return marked(escape(node.text));
  case 'hardBreak':return marked('<br>');
  case 'paragraph':return `<p>${children()}</p>`;
  // The profile and scene titles own h1–h3 in the server reading fallback.
  case 'heading':{const level=node.attrs.level+3;return `<h${level}>${children()}</h${level}>`;}
  case 'bulletList':return `<ul>${children()}</ul>`;
  case 'orderedList':return `<ol start="${node.attrs.start}"${node.attrs.type?` type="${escape(node.attrs.type)}"`:''}>${children()}</ol>`;
  case 'listItem':return `<li>${children()}</li>`;
  case 'blockquote':return `<blockquote>${children()}</blockquote>`;
  case 'horizontalRule':return '<hr>';
  default:throw new Error('Unsupported writing element.');
 }
}

function sceneWriting(scenes,book){
 if(!scenes.length)return `<div class="chapter-scenes-empty">${sceneCard(book)}<p class="section-note">Add your first scene to start writing here.</p></div>`;
 return scenes.map(scene=>{
  if(scene.contentSchemaVersion!==writingContentSchemaVersion)throw new Error('This writing content format version is not supported.');
  const content=validateWritingContent(scene.content);
  const headingFirst=content.content[0]?.type==='heading';
  return `<article class="chapter-inline-scene" data-scene-id="${escape(scene.id)}">${sceneCard(book,scene)}<p class="chapter-scene-status">${escape(statuses[scene.status]||'Draft')}</p><div id="chapter-scene-editor-${escape(scene.id)}" class="chapter-scene-editor-panel"><div class="writing-editor writing-editor-inline"><section class="profile-section chapter-scene-manuscript" aria-label="Scene manuscript"><div class="collapsible-region chapter-scene-manuscript-body"><div class="chapter-scene-writing-area">${headingFirst?'':'<h2 class="chapter-scene-opening-heading" data-placeholder="true"><button type="button" disabled>Opening heading</button></h2>'}<div class="chapter-scene-prose">${renderWritingNode(content)}</div></div></div></section></div></div></article>`;
 }).join('');
}

function arcChip(id,arc,novelId){
 const name=arc?.name||'Unavailable arc';
 return `<span class="chapter-arc-chip" role="listitem" data-chapter-arc="${escape(id)}">${arc?`<a href="/story-arcs/${encodeURIComponent(id)}/?novel=${encodeURIComponent(novelId)}">${escape(name)}</a>`:`<span>${escape(name)}</span>`}<button type="button" data-disconnect-arc="${escape(id)}" aria-label="Disconnect story arc: ${escape(name)}">×</button></span>`;
}

function chapterOverview(chapter,ordinal,novel,arcOptions){
 const number=chapterNumber(chapter,ordinal),status=Object.hasOwn(statuses,chapter.status)?chapter.status:'draft',selected=chapter.connectedArcIds||[],arcs=new Map(arcOptions.map(arc=>[arc.id,arc]));
 const available=arcOptions.filter(arc=>arc.available);
 return renderProfileHero(`<div class="chapter-hero-layout">
  <div class="chapter-hero-heading"><span class="chapter-kicker" data-chapter-number-label>Chapter ${String(number).padStart(2,'0')}</span><a href="/novels/${encodeURIComponent(novel.id)}/" class="chapter-hero-novel">${escape(novel.title||'Untitled novel')}</a></div>
  <div class="inline-field chapter-hero-title" data-profile-field="title"><label for="field-title">Chapter title</label><textarea id="field-title" name="title" aria-label="Chapter title" required rows="1" maxlength="160">${escape(chapter.title)}</textarea></div>
  <div class="chapter-hero-controls">
   <div class="chapter-hero-control"><label for="field-status">Status</label><select id="field-status" name="status" aria-label="Chapter status">${Object.entries(statuses).map(([value,label])=>`<option value="${value}"${value===status?' selected':''}>${label}</option>`).join('')}</select></div>
   <div class="chapter-hero-control"><label for="field-chapterNumber">Chapter number</label><input id="field-chapterNumber" name="chapterNumber" aria-label="Chapter number" type="number" min="1" max="9999" step="1" required value="${number}"></div>
  </div>
  <div class="chapter-hero-arcs"><div class="chapter-hero-field-heading"><label for="chapter-arc-picker">Connected arcs</label><a href="/story-arcs/?novel=${encodeURIComponent(novel.id)}" aria-label="Manage this novel's story arcs">Manage arcs ↗</a></div>
   <div class="chapter-arc-controls"><div id="chapter-arc-values" role="list" aria-label="Connected story arcs">${selected.map(id=>arcChip(id,arcs.get(id),novel.id)).join('')}</div><select id="chapter-arc-picker" aria-label="Connect story arc"><option value="">${available.length?'Add story arc…':'No story arcs linked to this novel'}</option>${available.map(arc=>`<option value="${escape(arc.id)}"${selected.includes(arc.id)?' disabled':''}>${escape(arc.name||'Untitled story arc')}</option>`).join('')}</select></div>
  </div>
  <div class="inline-field prose-field chapter-hero-summary" data-profile-field="summary"><label for="field-summary">Chapter summary</label><textarea id="field-summary" name="summary" aria-label="Chapter summary" rows="3" maxlength="10000" placeholder="What changes in this chapter?">${escape(chapter.summary)}</textarea></div>
  <div class="chapter-hero-actions"><button type="button" id="chapter-new-scene" class="writing-button writing-primary" disabled>New scene</button></div>
 </div>`,{label:'Chapter overview'});
}

export function renderChapterProfile(chapter,{novel,ordinal,scenes,sceneDocuments,arcOptions=[]}){
 const record={...chapter,name:chapter.title};
 const book={id:novel.id,title:novel.title||'Untitled novel',coverUrl:typeof novel.coverUrl==='string'&&!/[\s"'<>]/.test(novel.coverUrl)&&validImageUrl(novel.coverUrl)?novel.coverUrl:''};
 const identity={record,type:'chapter',
  epithet:`<a class="chapter-parent-novel" href="/novels/${encodeURIComponent(novel.id)}/">${escape(novel.title||'Untitled novel')}</a>`,
  portrait:`<div class="identity-panel blue"><span class="monogram" id="monogram" data-chapter-number-value>${chapterNumber(chapter,ordinal)}</span></div>`,
  groups:[{title:'Chapter details',id:'chapter-details',content:
   `<dl class="chapter-facts"><div><dt>Novel</dt><dd><a class="chapter-parent-novel" href="/novels/${encodeURIComponent(novel.id)}/">${escape(novel.title||'Untitled novel')}</a></dd></div><div><dt>Status</dt><dd id="chapter-status-label">${escape(statuses[chapter.status]||'Draft')}</dd></div><div><dt>Chapter number</dt><dd data-chapter-number-value>${chapterNumber(chapter,ordinal)}</dd></div><div><dt>Scenes</dt><dd id="chapter-scene-count">${scenes.length}</dd></div></dl>`}]
 };
 const leadingSections=[{section:{id:'overview',title:'Overview',fields:[]},content:chapterOverview(chapter,ordinal,novel,arcOptions)}];
 const sections=[
  {section:{id:'scenes',title:'Scenes',fields:[]},options:{header:false},content:
   `<div id="chapter-scenes-editor">${sceneWriting(sceneDocuments,book)}<noscript>Enable JavaScript to add and write scenes here.</noscript></div><script id="chapter-scenes-data" type="application/json">${jsonData({chapter,novel:book,scenes:sceneDocuments})}</script>`}
 ];
 return renderArticleProfile({identity,sections,leadingSections,collection:'Chapters',collectionUrl:'/chapters/?novel='+encodeURIComponent(novel.id),script:'/chapters/profile.js',styles:['/chapters/profile.css'],initial:{...chapter,arcOptions},boxClass:'chapter-infobox'})
  .replace('</head>',frontendAssets('frontend/chapter-profile.tsx')+'</head>');
}

/** Canonical owner-scoped chapter profiles; metadata writes use writingRoute. */
export async function chapterPageRoute(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed.',{status:405,headers:{'allow':'GET, HEAD','cache-control':'no-store'}});
 const match=path.match(/^\/chapters\/([^/]+)(?:\/(?:index\.html)?)?$/);
 if(!match||!uuid.test(match[1]))return notFound();
 const id=match[1];
 if(!path.endsWith('/')&&!path.endsWith('/index.html'))return Response.redirect(url.origin+'/chapters/'+id+'/'+url.search,308);
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return new Response('Sign in to access your chapters.',{status:401,headers:{'cache-control':'no-store'}});
 try{
  const writing=writingRepository(env.DB),db=repository(env.DB);
  const chapter=await writing.getChapter(owner,id);
  if(!chapter||!uuid.test(chapter.novelId))return notFound();
  const context=url.searchParams.get('novel');
  if(context!==null&&(!uuid.test(context)||context!==chapter.novelId))return notFound();
  const novel=await db.getNovel(owner,chapter.novelId);
  if(!novel)return notFound();
  if(request.method==='HEAD')return new Response(null,{headers:htmlHeaders});
  const [chapters,scenes,arcs,associations]=await Promise.all([writing.listChapters(owner,chapter.novelId),writing.listScenes(owner,chapter.id,chapter.novelId),db.listStoryArcs(owner),db.listNovelAssociations(owner,chapter.novelId)]);
  const ordinal=chapters.findIndex(item=>item.id===chapter.id)+1;
  if(!ordinal)return notFound();
  // Load this chapter's documents for its inline editors, retaining catalog
  // order and rechecking ownership before exposing any prose.
  const documents=await Promise.all(scenes.map(scene=>writing.getScene(owner,scene.id)));
  const sceneDocuments=documents.filter(scene=>scene&&scene.chapterId===chapter.id);
  const liveIds=new Set(sceneDocuments.map(scene=>scene.id));
  const linked=new Set(associations.filter(item=>item.targetKind==='story_arc').map(item=>item.targetId)),selected=new Set(chapter.connectedArcIds||[]);
  const arcOptions=arcs.filter(arc=>uuid.test(arc.id)&&(linked.has(arc.id)||selected.has(arc.id))).map(arc=>({id:arc.id,name:arc.name||'Untitled story arc',available:linked.has(arc.id)}));
  return new Response(renderChapterProfile(chapter,{novel,ordinal,scenes:scenes.filter(scene=>liveIds.has(scene.id)),sceneDocuments,arcOptions}),{headers:htmlHeaders});
 }catch(error){
  console.error('Chapter page request failed',error.message);
  return new Response('This chapter could not be loaded. Please try again.',{status:503,headers:{'cache-control':'no-store'}});
 }
}
