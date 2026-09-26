import {repository} from './db.js';
import {validateSchemaVersion} from './document-storage.js';
import {validImageUrl} from '../public/locations/countries/template.js';
import {sampleCharacter} from './sample-characters.js';
import {seedFactions} from '../public/characters/factions.js';
import {seedLocations} from '../public/locations/data.js';
import {factionCatalog} from './factions.js';
import {locationCatalog} from './countries.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const targetKinds=new Set(['character','faction','location','lore','story_arc']);
const relationKinds=new Set(['appears_in','referenced_by','linked']);
const statuses=new Set(['drafting','revising','complete','archived']);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const noContent=()=>new Response(null,{status:204,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const field=(input,current,key,fallback)=>Object.hasOwn(input,key)?input[key]:current?.[key]??fallback;
const conflict=(subject,draft)=>json({error:`This ${subject} changed in another tab. Your draft is still here. Copy your changes, then reload before saving.`,draft},409);

function textField(input,current,key,max,fallback=''){
 const value=field(input,current,key,fallback);
 if(typeof value!=='string'||value.length>max)throw new Error(`Keep ${key} within ${max.toLocaleString('en-US')} characters.`);
 return value;
}
function hiddenFields(input,current,allowed){
 const value=field(input,current,'hiddenFields',[]);
 if(!Array.isArray(value)||value.length>allowed.length||value.some(key=>typeof key!=='string'||!allowed.includes(key))||new Set(value).size!==value.length)throw new Error('Choose valid visible fields.');
 return [...value];
}
async function novelDocument(input,current,db,owner){
 const title=textField(input,current,'title',480).trim().replace(/\s+/g,' ');
 if(!title)throw new Error('Enter a novel title from 1 to 480 characters.');
 const synopsis=textField(input,current,'synopsis',10000);
 const status=field(input,current,'status','drafting');
 if(!statuses.has(status))throw new Error('Choose Drafting, Revising, Complete, or Archived as the novel status.');
 const coverUrl=textField(input,current,'coverUrl',2048);
 if(!validImageUrl(coverUrl))throw new Error('Use an HTTPS cover image URL without embedded credentials.');
 const seriesId=field(input,current,'seriesId','');
 if(typeof seriesId!=='string'||seriesId&&( !uuid.test(seriesId)||!await db.getSeries(owner,seriesId)))throw new Error('Choose a series from your library.');
 const seriesOrder=field(input,current,'seriesOrder',0);
 if(!Number.isSafeInteger(seriesOrder)||seriesOrder<0)throw new Error('Choose a nonnegative whole number for series position.');
 return {title,synopsis,status,coverUrl,seriesId,seriesOrder,hiddenFields:hiddenFields(input,current,['synopsis','status','coverUrl','seriesId','seriesOrder'])};
}
function seriesDocument(input,current){
 const title=textField(input,current,'title',480).trim().replace(/\s+/g,' ');
 if(!title)throw new Error('Enter a series title from 1 to 480 characters.');
 const summary=textField(input,current,'summary',10000),coverUrl=textField(input,current,'coverUrl',2048);
 if(!validImageUrl(coverUrl))throw new Error('Use an HTTPS cover image URL without embedded credentials.');
 return {title,summary,coverUrl,hiddenFields:hiddenFields(input,current,['summary','coverUrl'])};
}
function targetIdentity(kind,id){return targetKinds.has(kind)&&typeof id==='string'&&(uuid.test(id)||kind==='character'&&!!sampleCharacter(id)||kind==='faction'&&seedFactions.some(item=>item.id===id)||kind==='location'&&seedLocations.some(item=>item.id===id));}
async function targetExists(db,owner,kind,id){
 if(!targetIdentity(kind,id))return false;
 if(kind==='character'){const resolved=await db.get(owner,id)||sampleCharacter(id);return resolved?.id===id;}
 if(kind==='faction')return (await factionCatalog(db,owner)).some(record=>record.id===id);
 if(kind==='location')return (await locationCatalog(db,owner)).some(record=>record.id===id);
 if(kind==='lore')return !!await db.getLore(owner,id);
 return !!await db.getStoryArc(owner,id);
}
function validVersion(value){return Number.isSafeInteger(value)&&value>0&&value<Number.MAX_SAFE_INTEGER;}
async function parseBody(request){
 const raw=await request.text();
 if(new TextEncoder().encode(raw).byteLength>131072)return {error:json({error:'Keep this request within 128 KiB.'},413)};
 let input;try{input=JSON.parse(raw);}catch{return {error:json({error:'Invalid novel or series data.'},400)};}
 if(!object(input))return {error:json({error:'Invalid novel or series data.'},400)};
 try{validateSchemaVersion(input);}catch(error){return {error:json({error:error.message},400)};}
 return {input};
}

/** Owner-scoped JSON API for novels, series, ordering, and typed links. */
export async function novelRoute(request,env){
 const url=new URL(request.url),path=url.pathname,owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Sign in to access your novels.'},401);
 const targetList=path==='/api/novel-associations';
 const match=path.match(/^\/api\/(novels|series)(?:\/([^/]+))?(?:\/(associations|order)(?:\/([^/]+))?)?$/);
 if(!targetList&&!match)return json({error:'Novel or series not found.'},404);
 const [,collection,id,subresource,associationId]=match||[],novel=collection==='novels';
 if(id&&!uuid.test(id)||associationId&&!uuid.test(associationId))return json({error:'Novel, series, or association not found.'},404);
 const allowed=targetList?['GET']:subresource==='associations'&&novel?associationId?['PUT','DELETE']:['GET','POST']:subresource==='order'&&!novel&&!associationId?['PUT']:subresource?[]:id?['GET','PUT']:['GET','POST'];
 if(!allowed.includes(request.method))return json({error:'Method not allowed.'},405);
 if(request.method!=='GET'&&(request.headers.get('origin')!==url.origin||request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json'))return json({error:'This request could not be verified.'},403);
 try{
  const db=repository(env.DB);
  if(targetList){
   const kind=url.searchParams.get('targetKind'),targetId=url.searchParams.get('targetId');
   if(!targetIdentity(kind,targetId))return json({error:'Choose a valid association target.'},400);
   if(!await targetExists(db,owner,kind,targetId))return json({error:'Association target not found.'},404);
   return json(await db.listNovelAssociationsByTarget(owner,kind,targetId));
  }
  const current=id?await (novel?db.getNovel(owner,id):db.getSeries(owner,id)):null;
  if(id&&!current)return json({error:`${novel?'Novel':'Series'} not found.`},404);
  if(request.method==='GET'){
   if(subresource==='associations')return json(await db.listNovelAssociations(owner,id));
   return json(id?current:await (novel?db.listNovels(owner):db.listSeries(owner)));
  }
  if(request.method==='DELETE'){
   const association=await db.getNovelAssociation(owner,associationId);
   if(!association||association.novelId!==id)return json({error:'Novel association not found.'},404);
   const parsed=await parseBody(request);if(parsed.error)return parsed.error;
   const {input}=parsed;
   if(!Number.isSafeInteger(input.version)||input.version<1)return json({error:'Reload this novel association before unlinking.'},400);
   if(input.version!==association.version)return conflict('novel association',input);
   return await db.deleteNovelAssociation(owner,associationId,input.version)?noContent():conflict('novel association',input);
  }
  const parsed=await parseBody(request);if(parsed.error)return parsed.error;
  const {input}=parsed;
  if(subresource==='associations'){
   if(associationId){
    const association=await db.getNovelAssociation(owner,associationId);
    if(!association||association.novelId!==id)return json({error:'Novel association not found.'},404);
    if(Object.hasOwn(input,'id')&&input.id!==associationId||Object.hasOwn(input,'novelId')&&input.novelId!==id||Object.hasOwn(input,'targetKind')&&input.targetKind!==association.targetKind||Object.hasOwn(input,'targetId')&&input.targetId!==association.targetId)return json({error:'An association target cannot be changed.'},400);
    if(!validVersion(input.version))return json({error:'Reload this association before saving.'},400);
    if(input.version!==association.version)return conflict('novel association',input);
    const relationKind=field(input,association,'relationKind','appears_in'),prose=field(input,association,'prose','');
    if(!relationKinds.has(relationKind)||typeof prose!=='string'||prose.length>10000)return json({error:'Choose a valid association kind and keep its prose within 10,000 characters.'},400);
    const saved=await db.saveNovelAssociation(owner,associationId,input.version,relationKind,prose);
    return saved?json(saved):conflict('novel association',input);
   }
   if(typeof input.id!=='string'||!uuid.test(input.id))return json({error:'Choose a valid association ID.'},400);
   if(!targetIdentity(input.targetKind,input.targetId))return json({error:'Choose a valid association target.'},400);
   if(!await targetExists(db,owner,input.targetKind,input.targetId))return json({error:'Association target not found.'},404);
   const relationKind=field(input,null,'relationKind','appears_in'),prose=field(input,null,'prose','');
   if(!relationKinds.has(relationKind)||typeof prose!=='string'||prose.length>10000)return json({error:'Choose a valid association kind and keep its prose within 10,000 characters.'},400);
   const created=await db.createNovelAssociation(owner,input.id,id,input.targetKind,input.targetId,relationKind,prose);
   return created?json(created,201):json({error:'This association ID is unavailable.'},409);
  }
  if(subresource==='order'){
   if(!validVersion(input.version))return json({error:'Reload this series before reordering.'},400);
   if(input.version!==current.version)return conflict('series order',input);
   if(!Array.isArray(input.novelIds)||input.novelIds.some(novelId=>typeof novelId!=='string'||!uuid.test(novelId))||new Set(input.novelIds).size!==input.novelIds.length)return json({error:'Provide each novel in this series exactly once.'},400);
   const saved=await db.reorderSeriesNovels(owner,id,input.version,input.novelIds);
   return saved?json(saved):conflict('series order',input);
  }
  if(!id){
   if(typeof input.id!=='string'||!uuid.test(input.id))return json({error:`Choose a valid ${novel?'novel':'series'} ID.`},400);
   const existing=await (novel?db.getNovel(owner,input.id):db.getSeries(owner,input.id));
   if(existing)return json(existing,201);
  }else{
   if(Object.hasOwn(input,'id')&&input.id!==id)return json({error:`A ${novel?'novel':'series'} ID cannot be changed.`},400);
   if(!validVersion(input.version))return json({error:`Reload this ${novel?'novel':'series'} before saving.`},400);
   if(input.version!==current.version)return conflict(novel?'novel':'series',input);
  }
  let document;try{document=novel?await novelDocument(input,current,db,owner):seriesDocument(input,current);}catch(error){return json({error:error.message},400);}
  const saved=id?await (novel?db.saveNovel(owner,id,input.version,document):db.saveSeries(owner,id,input.version,document)):await (novel?db.createNovel(owner,input.id,document):db.createSeries(owner,input.id,document));
  return saved?json(saved,id?200:201):id?conflict(novel?'novel':'series',input):novel&&document.seriesId?conflict('series membership',input):json({error:`This ${novel?'novel':'series'} ID is unavailable.`},409);
 }catch(error){console.error('Novel or series request failed',error.message);return json({error:'Your novels and series could not be loaded or saved. Please try again.'},503);}
}
