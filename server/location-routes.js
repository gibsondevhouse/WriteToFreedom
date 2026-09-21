import { locationCatalog } from './countries.js';
import { repository } from './db.js';
import { locationTypes,areaTypes,parentChoices } from '../public/locations/data.js';
import { idPattern } from '../public/characters/template.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function locationRoute(request,env){
 const owner=request.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'Sign in to access your locations.'},401);
 try{
  const db=repository(env.DB),records=await locationCatalog(db,owner);
  if(request.method==='GET')return json({locations:records});
  if(!['POST','PUT'].includes(request.method))return json({error:'Method not allowed.'},405);
  const url=new URL(request.url);if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'This request could not be verified.'},403);
  const raw=await request.text();if(raw.length>4096)return json({error:'Location details are too long.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid location details.'},400);}
  if(!input||!(idPattern.test(input.id)||request.method==='PUT'&&records.some(r=>r.id===input.id))||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>160||!locationTypes.includes(input.type))return json({error:'Enter a name and choose a location type.'},400);
  const existing=records.find(r=>r.id===input.id);
  if(request.method==='POST'&&existing)return json(existing,201);
  if(request.method==='PUT'){
   if(!existing)return json({error:'Location not found.'},404);
   if(!['area','landmark'].includes(existing.type)||input.type!==existing.type)return json({error:'Open the country or city profile to edit it.'},400);
   if(!Number.isInteger(input.version)||input.version!==existing.version)return json({error:'This location changed in another tab. Close and reopen this editor before saving.'},409);
  }
  if(input.type==='area'&&!areaTypes.includes(input.areaType))return json({error:'Choose an area type.'},400);
  const parentId=input.parentId||null;
  if(input.type==='country'&&parentId)return json({error:'A country cannot belong to another location.'},400);
  if(input.type!=='country'){
   if(!parentChoices(input.type,records,input.id).some(r=>r.id===parentId))return json({error:input.type==='city'?'Choose an existing country.':'Choose a city or area. An area cannot belong to itself or one of its own areas.'},400);
  }
  const document={name:input.name.trim().replace(/\s+/g,' '),parentId,...(input.type==='area'?{areaType:input.areaType}:{})};
  if(request.method==='PUT'){
   const saved=await db.saveLocationDetails(owner,input.id,input.version,document);
   return saved?json({...existing,...saved}):json({error:'This location changed in another tab. Close and reopen this editor before saving.'},409);
  }
  const created=await db.createLocation(owner,{id:input.id,type:input.type,...document});
  const saved=created&&(await locationCatalog(db,owner)).find(r=>r.id===created.id);
  return saved?json(saved,201):json({error:'Could not create this location. Try again.'},409);
 }catch(error){console.error('Location request failed',error.message);return json({error:'Your locations could not be saved or loaded. Please try again.'},503);}
}
