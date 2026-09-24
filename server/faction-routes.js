import {validImageUrl} from '../public/locations/countries/template.js';
import {readHiddenFields} from '../public/profiles/schema.js';
import { repository } from './db.js';
import { factionCatalog, attachFactionNames } from './factions.js';
import { factionHideableFields, factionFields, blankFaction, factionTypes, factionStatuses } from '../public/factions/template.js';
import { idPattern } from '../public/characters/template.js';
import { characterCast } from './sample-characters.js';
import { renderFaction } from './render-faction.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
/**
 * Handle /api/factions[/id] and /factions/id/: owner-scoped collection/item GET,
 * HTML GET/HEAD, idempotent blank or name-deduplicated POST, and versioned PUT.
 * Loads the catalog before method dispatch. Writes require same-origin JSON,
 * validate founder/leader IDs and unique names, then batch profile/catalog writes.
 * Expected failures return JSON; a missing HTML profile returns text. Storage
 * exceptions become 503. The outer Worker injects the shared HTML shell.
 * @param {Request} request ID is segment 2 for HTML and segment 3 for JSON.
 * @param {{DB: object}} env D1-compatible binding; identity comes from the header.
 * @returns {Promise<Response>}
 */
export async function factionRoute(request,env){
 const url=new URL(request.url),profile=url.pathname.startsWith('/factions/'),id=url.pathname.split('/')[profile?2:3];
 const owner=request.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'Sign in to access your factions.'},401);
 try{
  const db=repository(env.DB),factions=await factionCatalog(db,owner),current=factions.find(f=>f.id===id);
  if(profile){
   if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed.'},405);
   if(!current)return new Response('Faction not found. Return to /factions/',{status:404});
   const cast=attachFactionNames(characterCast(await db.list(owner)),factions);
   return new Response(request.method==='HEAD'?null:renderFaction(current,cast,await db.listLore(owner)),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
  if(request.method==='GET')return id?(current?json(current):json({error:'Faction not found.'},404)):json({factions});
  if(!['POST','PUT'].includes(request.method))return json({error:'Method not allowed.'},405);
  if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'This request could not be verified.'},403);
  const raw=await request.text();if(raw.length>250000)return json({error:'Faction is too large to save.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid faction data.'},400);}
  if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Invalid faction data.'},400);
  if(request.method==='POST'&&!id){
   if(!idPattern.test(input.id))return json({error:'Invalid faction ID.'},400);
   if(input.blank===true){const existing=factions.find(f=>f.id===input.id);if(existing)return json(existing,201);const created=await db.createBlankFaction(owner,input.id);return created?json({...blankFaction(),...created,version:0},201):json({error:'Could not create this faction. Try again.'},409);}
   if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>160)return json({error:'Enter a faction name of 1–160 characters.'},400);
   const name=input.name.trim().replace(/\s+/g,' '),key=name.normalize('NFKC').toLocaleLowerCase();
   const existing=factions.find(f=>f.name.normalize('NFKC').toLocaleLowerCase()===key);if(existing)return json(existing,201);
   const created=await db.createFaction(owner,input.id,name);return created?json({...blankFaction(),...created,version:0},201):json({error:'Could not create this faction. Try again.'},409);
  }
  if(request.method==='PUT'&&id){
   if(!current)return json({error:'Faction not found.'},404);
   if(!Number.isInteger(input.version))return json({error:'Reload this faction before saving.'},400);
   const document=blankFaction();for(const key of factionFields){const value=Object.hasOwn(input,key)?input[key]:current[key];if(typeof value!=='string'||value.length>(key==='name'?160:10000))return json({error:'One or more fields exceed the allowed length.'},400);document[key]=value;}
  document.hiddenFields=readHiddenFields(input,current,factionHideableFields);if(!document.hiddenFields)return json({error:'Choose visible fields from this profile’s template.'},400);
   if(!validImageUrl(document.imageUrl)||document.imageUrl.length>2048)return json({error:'Use an HTTPS faction image URL of at most 2048 characters.'},400);
   document.name=document.name.trim().replace(/\s+/g,' ');
   for(const [key,choices] of [['type',factionTypes],['status',factionStatuses]])if(document[key]&&!choices.includes(document[key]))return json({error:'Choose a '+key+' from the list.'},400);
   const cast=characterCast(await db.list(owner));for(const key of ['founderId','leaderId'])if(document[key]&&!cast.some(c=>c.id===document[key]))return json({error:'Choose an existing character for the founder and leader.'},400);
   if(document.name&&factions.some(f=>f.id!==id&&f.name.normalize('NFKC').toLocaleLowerCase()===document.name.normalize('NFKC').toLocaleLowerCase()))return json({error:'A faction with that name already exists.'},409);
   const saved=await db.saveFaction(owner,id,input.version,document);return saved?json(saved):json({error:'This faction changed in another tab. Copy your unsaved text, then reload before saving.'},409);
  }
  return json({error:'Method not allowed.'},405);
 }catch(error){console.error('Faction request failed',error.message);return json({error:'Your faction could not be saved or loaded. Please try again.'},503);}
}
