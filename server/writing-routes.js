import {writingRepository} from './writing-repository.js';
import {repository} from './db.js';
import {supportedSchemaVersion} from './document-storage.js';
import {validateWritingContent,writingContentSchemaVersion,writingRequestMaxBytes} from '../public/writing/document.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const field=(input,current,key,fallback)=>Object.hasOwn(input,key)?input[key]:current?.[key]??fallback;
function metadata(input,current){
 const title=field(input,current,'title',''),summary=field(input,current,'summary','');
 if(typeof title!=='string'||!title.trim()||title.length>160)throw new Error('Enter a title from 1 to 160 characters.');
 if(typeof summary!=='string'||summary.length>10000)throw new Error('Keep the summary within 10,000 characters.');
 return {title:title.trim().replace(/\s+/g,' '),summary};
}

/** JSON-only chapters/scenes endpoints; the caller routes these exact paths. */
export async function writingRoute(request,env){
 const url=new URL(request.url),match=url.pathname.match(/^\/api\/(chapters|scenes)(?:\/([^/]+))?$/),owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Sign in to access your writing.'},401);
 if(!match)return json({error:'Writing entry not found.'},404);
 const [,collection,id]=match,scene=collection==='scenes',singular=scene?'scene':'chapter';
 if(!['GET','POST','PUT'].includes(request.method)||id&&request.method==='POST'||!id&&request.method==='PUT')return json({error:'Method not allowed.'},405);
 if(id&&!uuid.test(id))return json({error:'Writing entry not found.'},404);
 if(request.method!=='GET'&&(request.headers.get('origin')!==url.origin||request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json'))return json({error:'This request could not be verified.'},403);
 try{
  const db=writingRepository(env.DB),library=repository(env.DB),current=id?await (scene?db.getScene(owner,id):db.getChapter(owner,id)):null;
  if(id&&!current)return json({error:`This ${singular} was not found.`},404);
  const scopedNovel=url.searchParams.get('novelId');
  if(scopedNovel!==null&&(!uuid.test(scopedNovel)||!await library.getNovel(owner,scopedNovel)))return json({error:'This novel was not found.'},404);
  if(id&&scopedNovel){
   const chapter=scene?await db.getChapter(owner,current.chapterId):current;
   if(chapter?.novelId!==scopedNovel)return json({error:`This ${singular} was not found in the selected novel.`},404);
  }
  if(request.method==='GET'){
   if(id)return json(current);
   if(!scene)return json({chapters:await db.listChapters(owner,scopedNovel)});
   const chapterId=url.searchParams.get('chapterId');
   if(chapterId!==null&&(!uuid.test(chapterId)||!await db.getChapter(owner,chapterId)))return json({error:'This chapter was not found.'},404);
   if(chapterId&&scopedNovel&&(await db.getChapter(owner,chapterId))?.novelId!==scopedNovel)return json({error:'This chapter was not found in the selected novel.'},404);
   return json({scenes:await db.listScenes(owner,chapterId,scopedNovel)});
  }
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>writingRequestMaxBytes)return json({error:'Keep a writing request within 1 MiB of content plus 32 KiB of metadata.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid writing data.'},400);}
  if(!object(input))return json({error:'Invalid writing data.'},400);
  if(Object.hasOwn(input,'schemaVersion')&&input.schemaVersion!==supportedSchemaVersion)return json({error:'This writing format version is not supported. Reload before saving.'},400);
  if(!id){
   if(typeof input.id!=='string'||!uuid.test(input.id))return json({error:'Choose a valid writing entry ID.'},400);
   if(!scene&&scopedNovel&&Object.hasOwn(input,'novelId')&&input.novelId!==scopedNovel)return json({error:'Choose the selected novel for this chapter.'},400);
   const existing=await (scene?db.getScene(owner,input.id):db.getChapter(owner,input.id));
   if(existing){
    const chapter=scene?await db.getChapter(owner,existing.chapterId):existing;
    const requestedNovel=scene?scopedNovel:Object.hasOwn(input,'novelId')?input.novelId:scopedNovel;
    if(requestedNovel!==null&&requestedNovel!==undefined&&chapter?.novelId!==requestedNovel)return json({error:`This ${singular} was not found in the selected novel.`},404);
    if(scene&&Object.hasOwn(input,'chapterId')&&input.chapterId!==existing.chapterId)return json({error:'This scene already belongs to another chapter.'},409);
    return json(existing,201);
   }
  }else{
   if(Object.hasOwn(input,'id')&&input.id!==id)return json({error:'A writing entry ID cannot be changed.'},400);
   if(!Number.isSafeInteger(input.version)||input.version<1)return json({error:`Reload this ${singular} before saving.`},400);
   if(input.version!==current.version)return json({error:`This ${singular} changed in another tab. Your draft is still here. Copy your changes, then reload before saving.`},409);
   if(current.version===Number.MAX_SAFE_INTEGER)return json({error:`This ${singular} has reached its revision limit and cannot be saved.`},409);
  }
  let document;
  try{
   document=metadata(input,current);
   if(!scene){
    if(id){
     if(Object.hasOwn(input,'novelId')&&input.novelId!==current.novelId)throw new Error('Moving a chapter to another novel requires a separate transfer.');
     document.novelId=current.novelId;
    }else{
     const requested=Object.hasOwn(input,'novelId')?input.novelId:scopedNovel;
     if(requested!==null&&requested!==undefined){
      if(typeof requested!=='string'||!uuid.test(requested)||!await library.getNovel(owner,requested))throw new Error('Choose one of your novels for this chapter.');
      document.novelId=requested;
     }else{
      const novels=await library.listNovels(owner);
      if(novels.length>1)throw new Error('Choose a novel before creating a chapter.');
      document.novelId=novels[0]?.id||null;
     }
    }
   }
   if(scene){
    const chapterId=field(input,current,'chapterId'),status=field(input,current,'status','draft'),contentSchemaVersion=field(input,current,'contentSchemaVersion');
    const destination=typeof chapterId==='string'&&uuid.test(chapterId)?await db.getChapter(owner,chapterId):null;
    if(!destination)throw new Error('Choose a chapter from your writing workspace.');
    if(scopedNovel&&destination.novelId!==scopedNovel)throw new Error('Choose a chapter in the selected novel.');
    if(id){const source=await db.getChapter(owner,current.chapterId);if(source?.novelId!==destination.novelId)throw new Error('Moving a scene to another novel requires a separate transfer.');}
    if(!['draft','revising','complete'].includes(status))throw new Error('Choose Draft, Revising, or Complete as the scene status.');
    if(contentSchemaVersion!==writingContentSchemaVersion)throw new Error('This writing format version is not supported. Reload before saving.');
    document={...document,chapterId,status,contentSchemaVersion,content:validateWritingContent(field(input,current,'content'))};
   }
  }catch(error){return json({error:error.message},400);}
  const saved=id?await (scene?db.saveScene(owner,current,document):db.saveChapter(owner,current,document)):await (scene?db.createScene(owner,input.id,document):db.createChapter(owner,input.id,document));
  return saved?json(saved,id?200:201):json({error:id?`This ${singular} changed before it could be saved. Your draft is still here. Copy your changes, then reload before saving.`:'This writing entry ID is unavailable. Try creating a new entry.'},409);
 }catch(error){console.error('Writing request failed',error.message);return json({error:'Your writing could not be loaded or saved. Please try again.'},503);}
}
