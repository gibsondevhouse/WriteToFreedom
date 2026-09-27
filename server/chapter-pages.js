import {repository} from './db.js';
import {writingRepository} from './writing-repository.js';
import {validateWritingContent,writingContentSchemaVersion} from '../public/writing/document.js';
import {escape,jsonData,createFieldRenderer,renderInfoGroup,renderProfileName,renderProfilePage,renderSection} from './profile-components.js';
import {frontendAssets} from './frontend-assets.js';
import {validImageUrl} from '../public/locations/countries/template.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const htmlHeaders={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const statuses={draft:'Draft',revising:'Revising',complete:'Complete'};
const markTags={bold:'strong',italic:'em',strike:'s',underline:'u',code:'code'};
const notFound=()=>new Response('Chapter not found.',{status:404,headers:{'cache-control':'no-store'}});

function sceneCard(book,scene){
 const title=book.title||'Untitled novel',name=scene?.title||'Your next scene';
 const monogram=title.replace(/^The\s+/i,'').trim().split(/\s+/).slice(0,2).map(word=>word[0]||'').join('').toUpperCase()||'?';
 const cover=`<div class="chapter-scene-cover-well"><div class="chapter-scene-book-cover"><div class="chapter-scene-cover-placeholder" role="img" aria-label="Book cover placeholder for ${escape(title)}"${book.coverUrl?' aria-hidden="true"':''}><span class="chapter-scene-cover-monogram" aria-hidden="true">${escape(monogram)}</span><span class="chapter-scene-cover-title" aria-hidden="true">${escape(title)}</span></div>${book.coverUrl?`<img src="${escape(book.coverUrl)}" alt="Book cover for ${escape(title)}" referrerpolicy="no-referrer">`:''}</div></div>`;
 const copy=`<div class="chapter-scene-card-copy"><h3 class="chapter-scene-card-heading">${escape(name)}</h3><div class="chapter-scene-card-summary-field"><span>Scene summary</span><p class="chapter-scene-card-summary">${escape(scene?(scene.summary||'Describe what happens in this scene…'):'Add a scene to start writing here.')}</p></div></div>`;
 return `<div class="chapter-scene-card chapter-scene-image" role="group" aria-label="${escape(scene?'Scene card: '+name:'New scene card')}">${cover}${copy}</div>`;
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
  return `<article class="chapter-inline-scene" data-scene-id="${escape(scene.id)}">${sceneCard(book,scene)}<p class="chapter-scene-status">${escape(statuses[scene.status]||'Draft')}</p><div class="chapter-scene-prose">${renderWritingNode(content)}</div></article>`;
 }).join('');
}

export function renderChapterProfile(chapter,{novel,ordinal,scenes,sceneDocuments}){
 const record={...chapter,name:chapter.title};
 const book={id:novel.id,title:novel.title||'Untitled novel',coverUrl:typeof novel.coverUrl==='string'&&!/[\s"'<>]/.test(novel.coverUrl)&&validImageUrl(novel.coverUrl)?novel.coverUrl:''};
 const field=createFieldRenderer(chapter,{required:['title'],maxLengths:{title:160}});
 const infobox=renderProfileName(record,'chapter')+
  renderInfoGroup('Chapter details','chapter-details',field(['title','Chapter title','textarea'])+
   `<dl class="chapter-facts"><div><dt>Novel</dt><dd><a class="chapter-parent-novel" href="/novels/${encodeURIComponent(novel.id)}/">${escape(novel.title||'Untitled novel')}</a></dd></div><div><dt>Chapter number</dt><dd>${ordinal}</dd></div><div><dt>Scenes</dt><dd id="chapter-scene-count">${scenes.length}</dd></div></dl>`);
 const overview=renderSection({id:'overview',title:'Overview',fields:[['summary','Chapter summary']]},field(['summary','Chapter summary','textarea','Describe this chapter…']),chapter,{menuFields:[]});
 const sceneSection=renderSection({id:'scenes',title:'Scenes',fields:[]},
  `<div id="chapter-scenes-editor">${sceneWriting(sceneDocuments,book)}<noscript>Enable JavaScript to add and write scenes here.</noscript></div><script id="chapter-scenes-data" type="application/json">${jsonData({chapter,novel:book,scenes:sceneDocuments})}</script>`,chapter);
 return renderProfilePage({record,type:'chapter',collection:'Chapters',collectionUrl:'/chapters/?novel='+encodeURIComponent(novel.id),infobox,content:overview+sceneSection,script:'/chapters/profile.js',styles:['/chapters/profile.css'],initial:chapter,boxClass:'chapter-infobox'})
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
  const [chapters,scenes]=await Promise.all([writing.listChapters(owner,chapter.novelId),writing.listScenes(owner,chapter.id,chapter.novelId)]);
  const ordinal=chapters.findIndex(item=>item.id===chapter.id)+1;
  if(!ordinal)return notFound();
  // Load this chapter's documents for its inline editors, retaining catalog
  // order and rechecking ownership before exposing any prose.
  const documents=await Promise.all(scenes.map(scene=>writing.getScene(owner,scene.id)));
  const sceneDocuments=documents.filter(scene=>scene&&scene.chapterId===chapter.id);
  const liveIds=new Set(sceneDocuments.map(scene=>scene.id));
  return new Response(renderChapterProfile(chapter,{novel,ordinal,scenes:scenes.filter(scene=>liveIds.has(scene.id)),sceneDocuments}),{headers:htmlHeaders});
 }catch(error){
  console.error('Chapter page request failed',error.message);
  return new Response('This chapter could not be loaded. Please try again.',{status:503,headers:{'cache-control':'no-store'}});
 }
}
