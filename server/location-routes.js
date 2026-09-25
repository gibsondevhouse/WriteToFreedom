import {validateSchemaVersion} from './document-storage.js';
import {locationTemplates} from '../public/locations/template.js';
import {connectedNotes} from './note-connections.js';
import {characterCast} from './sample-characters.js';
import { locationCatalog } from './countries.js';
import { repository } from './db.js';
import { locationTypes,areaTypes,parentChoices,requiresParent } from '../public/locations/data.js';
import { idPattern } from '../public/characters/template.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
/**
 * Handle exactly /api/locations: GET catalog plus explicit note backlinks, POST
 * any supported location type, or legacy basic PUTs for types other than country/city.
 * POST retries an existing owned ID; PUT preserves type and profile content and requires its version.
 * parentChoices/requiresParent enforce type, ancestry and owner-catalog rules.
 * No profile HTML or independent country/city document is created here.
 * @param {Request} request Writes carry id/name/type/parentId and areaType for areas.
 * @param {{DB: object}} env D1-compatible binding.
 * @returns {Promise<Response>} JSON record/envelope or error; creation uses 201.
 */
export async function locationRoute(request,env){
 const owner=request.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'Sign in to access your locations.'},401);
 try{
  const db=repository(env.DB),records=await locationCatalog(db,owner);
  if(request.method==='GET'){const cast=characterCast(await db.list(owner)),lore=await db.listLore(owner);return json({locations:records.map(l=>({...l,linkedNotes:connectedNotes(cast,{kind:'location',id:l.id},lore)}))});}
  if(!['POST','PUT'].includes(request.method))return json({error:'Method not allowed.'},405);
  const url=new URL(request.url);if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'This request could not be verified.'},403);
  const raw=await request.text();if(raw.length>4096)return json({error:'Location details are too long.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid location details.'},400);}
  if(!input||typeof input!=='object'||Array.isArray(input)||!(idPattern.test(input.id)||request.method==='PUT'&&records.some(r=>r.id===input.id))||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>160||!locationTypes.includes(input.type))return json({error:'Enter a name and choose a location type.'},400);
  try{validateSchemaVersion(input);}catch(error){return json({error:error.message},400);}
  const existing=records.find(r=>r.id===input.id);
  if(request.method==='POST'&&existing)return existing.type===input.type?json(existing,201):json({error:'That ID already belongs to a different location type.'},409);
  if(request.method==='PUT'){
   if(!existing)return json({error:'Location not found.'},404);
   if(['country','city'].includes(existing.type)||input.type!==existing.type)return json({error:'Open the country or city profile to edit it.'},400);
   if(!Number.isSafeInteger(input.version)||input.version>=Number.MAX_SAFE_INTEGER||input.version<0||input.version!==existing.version)return json({error:'This location changed in another tab. Close and reopen this editor before saving.'},409);
  }
  if(input.type==='area'&&!areaTypes.includes(input.areaType))return json({error:'Choose an area type.'},400);
  if(input.parentId!==undefined&&input.parentId!==null&&typeof input.parentId!=='string')return json({error:'Choose a valid parent location from your world.'},400);
  const parentId=input.parentId||null;
  if(parentId||requiresParent(input.type)){
   if(!parentChoices(input.type,records,input.id).some(r=>r.id===parentId))return json({error:'Choose a valid parent location from your world. A location cannot contain itself or one of its ancestors.'},400);
  }
  const document={name:input.name.trim().replace(/\s+/g,' '),parentId,...(input.type==='area'?{areaType:input.areaType}:{})};
  if(request.method==='PUT'){
   const template=locationTemplates[existing.type];
   const preserved=Object.fromEntries([...template.fields,'hiddenFields','profileRatings'].filter(key=>Object.hasOwn(existing,key)).map(key=>[key,existing[key]]));
   const saved=await db.saveLocationDetails(owner,input.id,input.version,{...preserved,...document});
   return saved?json({...existing,...saved}):json({error:'This location changed in another tab. Close and reopen this editor before saving.'},409);
  }
  const created=await db.createLocation(owner,{id:input.id,type:input.type,...document});
  const saved=created&&(await locationCatalog(db,owner)).find(r=>r.id===created.id);
  return saved?json(saved,201):json({error:'Could not create this location. Try again.'},409);
 }catch(error){if(/(?:^|:\s*)locations: (?:invalid parent|hierarchy cycle)(?:: SQLITE_CONSTRAINT(?:_TRIGGER)?)?$/.test(error.message))return json({error:'Your location hierarchy changed while saving. Reload before trying again.'},409);console.error('Location request failed',error.message);return json({error:'Your locations could not be saved or loaded. Please try again.'},503);}
}
