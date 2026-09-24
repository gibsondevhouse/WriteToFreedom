import {repository} from './db.js';
import {characterCast} from './sample-characters.js';
import {factionCatalog} from './factions.js';
import {locationCatalog} from './countries.js';
import {noteTargets,connectedNotes} from './note-connections.js';
import {cleanNoteReference,referenceKey} from '../public/characters/notes.js';
import {idPattern} from '../public/characters/template.js';
import {readHiddenFields} from '../public/profiles/schema.js';
import {blankLore,loreTypes,loreTemplates,allowedCollections,primaryCollection,validImageUrl} from '../public/lore/template.js';
import {loreDashboardData} from './lore.js';
import {renderLore} from './render-lore.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
function validate(input,current,targets){
 if(input.type!==undefined&&input.type!==current.type)throw new Error('Keep this entry’s original type. Use collections to organize it.');
 const template=loreTemplates[current.type],document={type:current.type};
 for(const key of template.fields){const value=Object.hasOwn(input,key)?input[key]:current[key];if(typeof value!=='string'||value.length>(key==='name'?160:key==='imageUrl'?2048:10000))throw new Error('One or more fields exceed the allowed length.');document[key]=value;}
 document.name=document.name.trim().replace(/\s+/g,' ');if(!document.name)throw new Error('Enter a name for this entry.');
 if(!validImageUrl(document.imageUrl))throw new Error('Use an HTTPS image URL.');
 document.hiddenFields=readHiddenFields(input,current,template.hideableFields);if(!document.hiddenFields)throw new Error('Choose visible fields from this entry’s template.');
 const collections=Object.hasOwn(input,'collections')?input.collections:current.collections;
 if(!Array.isArray(collections)||collections.length>4||!collections.includes(primaryCollection[current.type])||collections.some(c=>!allowedCollections(current.type).includes(c)))throw new Error('Choose collections appropriate for this entry and keep its primary collection.');
 document.collections=[...new Set(collections)];
 for(const key of ['pinned','featured']){document[key]=Object.hasOwn(input,key)?input[key]:current[key];if(typeof document[key]!=='boolean')throw new Error('Choose a valid pin or feature setting.');}
 const connections=Object.hasOwn(input,'connections')?input.connections:current.connections;
 if(!Array.isArray(connections)||connections.length>60)throw new Error('Keep at most 60 connections per entry.');
 const known=new Set(targets.map(referenceKey)),seen=new Set();
 const old=new Set(current.connections.map(c=>referenceKey(c.target)));
 document.connections=connections.map(c=>{
  const target=cleanNoteReference(c?.target),key=referenceKey(target);
  if(target.kind==='lore'&&target.id===current.id)throw new Error('Choose a different entry to connect.');
  if(!known.has(key)&&!old.has(key))throw new Error('Choose connected items from your world.');
  if(seen.has(key))throw new Error('An entry can connect to the same item only once.');seen.add(key);
  if(typeof c.relationship!=='string'||!c.relationship.trim()||c.relationship.length>160)throw new Error('Describe each connection in 160 characters or fewer.');
  return {target,relationship:c.relationship.trim()};
 });
 return document;
}
export async function loreRoute(request,env){
 const url=new URL(request.url),html=url.pathname.startsWith('/lore/'),id=url.pathname.split('/')[html?2:3],owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Sign in to access your lore.'},401);
 if(!['GET','HEAD','POST','PUT'].includes(request.method)||html&&!['GET','HEAD'].includes(request.method)||!html&&request.method==='HEAD'||id&&request.method==='POST'||!id&&request.method==='PUT')return json({error:'Method not allowed.'},405);
 try{
  const db=repository(env.DB),records=await db.listLore(owner),current=id?records.find(r=>r.id===id):null;
  if(id&&!current)return json({error:'Lore entry not found.'},404);
  if(request.method==='HEAD')return new Response(null,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(!html&&request.method==='GET')return json(id?current:loreDashboardData(records,characterCast(await db.list(owner))));
  const [savedCast,factions,locations]=await Promise.all([db.list(owner),factionCatalog(db,owner),locationCatalog(db,owner)]),cast=characterCast(savedCast),targets=noteTargets(cast,factions,locations,records);
  if(html)return new Response(renderLore(current,targets,connectedNotes(cast,{kind:'lore',id},records)),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'This request could not be verified.'},403);
  const raw=await request.text();if(raw.length>550000)return json({error:'This lore entry is too large to save.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid lore data.'},400);}
  if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Invalid lore data.'},400);
  if(!id){
   if(!idPattern.test(input.id)||!Object.hasOwn(loreTypes,input.type))return json({error:'Choose an entry type and valid ID.'},400);
   const existing=records.find(r=>r.id===input.id);if(existing)return json(existing,201);
  }else if(!Number.isInteger(input.version)||input.version<1)return json({error:'Reload this entry before saving.'},400);
  else if(input.version!==current.version)return json({error:'This entry changed in another tab. Copy your unsaved text, then reload before saving.'},409);
  let document;try{document=validate(input,current||{...blankLore(input.type),id:input.id},targets);}catch(error){return json({error:error.message},400);}
  const saved=id?await db.saveLore(owner,id,input.version,document):await db.createLore(owner,input.id,document);
  return saved?json(saved,id?200:201):json({error:'This entry could not be saved. Reload before trying again.'},409);
 }catch(error){console.error('Lore request failed',error.message);return json({error:'Your lore could not be loaded or saved. Please try again.'},503);}
}
