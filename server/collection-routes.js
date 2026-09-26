import {collectionRepository} from './collection-repository.js';
import {libraryEntries,libraryKey,cleanLibraryReference} from './library-targets.js';
import {repository} from './db.js';
import {validateCollectionRules,collectionRuleSummary} from '../public/collections/rules.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const conflict=input=>json({error:'This collection changed in another tab. Your draft is still here. Reload before saving.',draft:input},409);
function document(input,current,kind){
 const value=(key,fallback)=>Object.hasOwn(input,key)?input[key]:current?.[key]??fallback;
 const name=value('name',''),summary=value('summary',''),coverUrl=value('coverUrl','');
 if(typeof name!=='string'||!name.trim()||name.length>160)throw new Error('Enter a collection name of 1–160 characters.');
 if(typeof summary!=='string'||summary.length>10000)throw new Error('Keep the summary within 10,000 characters.');
 if(typeof coverUrl!=='string'||coverUrl.length>2048)throw new Error('Use an HTTPS image URL.');
 if(coverUrl){let url;try{url=new URL(coverUrl);}catch{throw new Error('Use an HTTPS image URL.');}if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use an HTTPS image URL without credentials.');}
 const result={name:name.trim(),summary,coverUrl};
 if(kind==='smart')result.rules=validateCollectionRules(value('rules',null));
 else {const order=value('order',[]);if(!Array.isArray(order)||order.length>1000||order.some(key=>typeof key!=='string'||key.length>400)||new Set(order).size!==order.length)throw new Error('Choose a valid collection order.');result.order=[...order];}
 return result;
}

/** Private, JSON-only collection writes. Membership and rules use parent revision. */
export async function collectionRoute(request,env){
 const owner=request.headers.get('oai-authenticated-user-id'),url=new URL(request.url);
 if(!owner)return json({error:'Sign in to access your collections.'},401);
 const match=url.pathname.match(/^\/api\/collections(?:\/([^/]+)(?:\/(entries|members))?)?$/);
 if(url.pathname==='/api/library'){
  if(request.method!=='GET')return json({error:'Method not allowed.'},405);
  try{return json({entries:await libraryEntries(env.DB,owner)});}catch(error){console.error('Library request failed',error.message);return json({error:'Your library could not be loaded.'},503);}
 }
 if(!match)return json({error:'Collection not found.'},404);
 const [,id,operation]=match;
 if(id&&!uuid.test(id))return json({error:'Collection not found.'},404);
 if(!['GET','POST','PUT','DELETE'].includes(request.method)||!id&&['PUT','DELETE'].includes(request.method)||id&&!operation&&request.method==='POST'||operation==='entries'&&request.method!=='GET'||operation==='members'&&!['GET','POST','DELETE'].includes(request.method))return json({error:'Method not allowed.'},405);
 if(request.method!=='GET'&&(request.headers.get('origin')!==url.origin||request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json'))return json({error:'This request could not be verified.'},403);
 try{
  const db=collectionRepository(env.DB),current=id?await db.get(owner,id):null;
  if(id&&!current)return json({error:'Collection not found.'},404);
  if(request.method==='GET'){
   if(!id)return json(await db.list(owner));
   if(operation==='members')return json({members:current.kind==='manual'?await db.members(owner,id):[]});
   if(operation==='entries'){
    const entries=await db.entries(owner,current),labels=Object.fromEntries((await libraryEntries(env.DB,owner)).filter(entry=>['novel','series'].includes(entry.kind)).map(entry=>[entry.id,entry.name]));
    return json({entries,ruleSummary:current.kind==='smart'?collectionRuleSummary(current.rules,labels)+' · Embedded notes use their parent character’s novel links.':'Selected library entries'});
   }
   return json(current);
  }
  const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>50000)return json({error:'This collection request is too large.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid collection data.'},400);}
  if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Invalid collection data.'},400);
  if(Object.hasOwn(input,'schemaVersion')&&input.schemaVersion!==1)return json({error:'This collection format is not supported.'},400);
  if(id){
   if(Object.hasOwn(input,'id')&&input.id!==id)return json({error:'A collection ID cannot change.'},400);
   if(!Number.isSafeInteger(input.version)||input.version<1||input.version>=Number.MAX_SAFE_INTEGER)return json({error:'Reload this collection before saving.'},400);
   if(input.version!==current.version)return conflict(input);
   if(operation==='members'){
    if(current.kind!=='manual')return json({error:'Smart collections derive their entries from criteria.'},400);
    let ref;try{ref=cleanLibraryReference(input.ref);}catch(error){return json({error:error.message},400);}
    if(request.method==='POST'&&!(await libraryEntries(env.DB,owner)).some(entry=>libraryKey(entry)===libraryKey(ref)))return json({error:'Library entry not found.'},404);
    const saved=await db.changeMember(owner,id,input.version,ref,request.method==='DELETE');
    return saved?json(saved):conflict(input);
   }
   if(request.method==='DELETE')return await db.remove(owner,id,input.version)?new Response(null,{status:204,headers:{'cache-control':'no-store'}}):conflict(input);
   if(Object.hasOwn(input,'kind')&&input.kind!==current.kind)return json({error:'Create a new collection to change its kind.'},400);
  }else if(!uuid.test(input.id)||!['manual','smart'].includes(input.kind))return json({error:'Choose a valid collection ID and kind.'},400);
  const kind=current?.kind||input.kind;
  let normalized;try{normalized=document(input,current,kind);}catch(error){return json({error:error.message},400);}
  const library=repository(env.DB);
  if(kind==='smart'){
   for(const rule of normalized.rules.predicates){
    if(rule.field==='linkedNovel'&&!await library.getNovel(owner,rule.value)||rule.field==='series'&&!await library.getSeries(owner,rule.value))return json({error:'Choose a novel or series from your library.'},404);
   }
  }else if(id&&Object.hasOwn(input,'order')){
   const members=await db.members(owner,id),keys=members.map(libraryKey);
   if(normalized.order.length!==keys.length||normalized.order.some(key=>!keys.includes(key)))return json({error:'Order must include each collection member exactly once.'},400);
  }
  const saved=id?await db.save(owner,id,input.version,normalized):await db.create(owner,input.id,kind,normalized);
  return saved?json(saved,id?200:201):conflict(input);
 }catch(error){console.error('Collection request failed',error.message);return json({error:'Your collection could not be loaded or saved. Your draft is still here.'},503);}
}
