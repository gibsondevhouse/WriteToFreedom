import {writingRepository} from './writing-repository.js';
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
  const db=writingRepository(env.DB),current=id?await (scene?db.getScene(owner,id):db.getChapter(owner,id)):null;
  if(id&&!current)return json({error:`This ${singular} was not found.`},404);
  if(request.method==='GET'){
   if(id)return json(current);
   if(!scene)return json({chapters:await db.listChapters(owner)});
   const chapterId=url.searchParams.get('chapterId');
   if(chapterId!==null&&(!uuid.test(chapterId)||!await db.getChapter(owner,chapterId)))return json({error:'This chapter was not found.'},404);
   return json({scenes:await db.listScenes(owner,chapterId)});
  }
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>writingRequestMaxBytes)return json({error:'Keep a writing request within 1 MiB of content plus 32 KiB of metadata.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid writing data.'},400);}
  if(!object(input))return json({error:'Invalid writing data.'},400);
  if(!id){
   if(typeof input.id!=='string'||!uuid.test(input.id))return json({error:'Choose a valid writing entry ID.'},400);
   const existing=await (scene?db.getScene(owner,input.id):db.getChapter(owner,input.id));
   if(existing)return json(existing,201);
  }else{
   if(!Number.isInteger(input.version)||input.version<1)return json({error:`Reload this ${singular} before saving.`},400);
   if(input.version!==current.version)return json({error:`This ${singular} changed in another tab. Your draft is still here. Copy your changes, then reload before saving.`},409);
  }
  let document;
  try{
   document=metadata(input,current);
   if(scene){
    const chapterId=field(input,current,'chapterId'),status=field(input,current,'status','draft'),contentSchemaVersion=field(input,current,'contentSchemaVersion');
    if(typeof chapterId!=='string'||!uuid.test(chapterId)||!await db.getChapter(owner,chapterId))throw new Error('Choose a chapter from your writing workspace.');
    if(!['draft','revising','complete'].includes(status))throw new Error('Choose Draft, Revising, or Complete as the scene status.');
    if(contentSchemaVersion!==writingContentSchemaVersion)throw new Error('This writing format version is not supported. Reload before saving.');
    document={...document,chapterId,status,contentSchemaVersion,content:validateWritingContent(field(input,current,'content'))};
   }
  }catch(error){return json({error:error.message},400);}
  const saved=id?await (scene?db.saveScene(owner,current,document):db.saveChapter(owner,current,document)):await (scene?db.createScene(owner,input.id,document):db.createChapter(owner,input.id,document));
  return saved?json(saved,id?200:201):json({error:id?`This ${singular} changed before it could be saved. Your draft is still here. Copy your changes, then reload before saving.`:'This writing entry ID is unavailable. Try creating a new entry.'},409);
 }catch(error){console.error('Writing request failed',error.message);return json({error:'Your writing could not be loaded or saved. Please try again.'},503);}
}
