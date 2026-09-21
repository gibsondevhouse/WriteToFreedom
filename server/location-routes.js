import { repository } from './db.js';
import { seedLocations, locationTypes } from '../public/locations/data.js';
import { idPattern } from '../public/characters/template.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function locationRoute(request,env){
 const owner=request.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'Sign in to access your locations.'},401);
 try{
  const db=repository(env.DB),records=[...seedLocations,...await db.listLocations(owner)];
  if(request.method==='GET')return json({locations:records});
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);
  const url=new URL(request.url);if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'This request could not be verified.'},403);
  const raw=await request.text();if(raw.length>4096)return json({error:'Location details are too long.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid location details.'},400);}
  if(!input||!idPattern.test(input.id)||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>160||!locationTypes.includes(input.type))return json({error:'Enter a name and choose a location type.'},400);
  const existing=records.find(r=>r.id===input.id);if(existing)return json(existing,201);
  const parentId=input.parentId||null;
  if(input.type==='country'&&parentId)return json({error:'A country cannot belong to another location.'},400);
  if(input.type!=='country'){
   const expected=input.type==='city'?'country':'city',parent=records.find(r=>r.id===parentId);
   if(!parent||parent.type!==expected)return json({error:`Choose an existing ${expected} for this ${input.type}.`},400);
  }
  const saved=await db.createLocation(owner,{id:input.id,name:input.name.trim().replace(/\s+/g,' '),type:input.type,parentId});
  return saved?json(saved,201):json({error:'Could not create this location. Try again.'},409);
 }catch(error){console.error('Location request failed',error.message);return json({error:'Your locations could not be saved or loaded. Please try again.'},503);}
}
