import {repository} from './db.js';
import {locationCatalog} from './countries.js';
import {characterCast} from './sample-characters.js';
import {locationTemplates,defaultLocation,validImageUrl} from '../public/locations/template.js';
import {parentChoices,requiresParent,areaTypes,locationPaths,ancestors,locationHref} from '../public/locations/data.js';
import {readHiddenFields} from '../public/profiles/schema.js';
import {renderLocation} from './render-location.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const conflict=()=>json({error:'This location changed in another tab. Copy your unsaved text, then reload before saving.'},409);
const responseRecord=(record,locations)=>({...record,ancestry:ancestors(record,locations).map(l=>({id:l.id,name:l.name,href:locationHref(l)}))});

/** Existing catalog identities only; creation continues through /api/locations. */
export async function locationProfileRoute(request,env){
 const url=new URL(request.url),html=url.pathname.startsWith('/locations/'),id=url.pathname.split('/')[3];
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Sign in to access your locations.'},401);
 try{
  const db=repository(env.DB),locations=await locationCatalog(db,owner),location=locations.find(l=>l.id===id);
  const template=location&&locationTemplates[location.type];
  if(!template||html&&!url.pathname.startsWith(locationPaths[location.type]))return json({error:'Location not found.'},404);
  const current=defaultLocation(location);
  if(html){
   if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed.'},405);
   return new Response(request.method==='HEAD'?null:renderLocation(current,locations,characterCast(await db.list(owner)),await db.listLore(owner)),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
  if(request.method==='GET')return json(responseRecord(current,locations));
  if(request.method!=='PUT')return json({error:'Method not allowed.'},405);
  if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'This request could not be verified.'},403);
  const raw=await request.text();if(raw.length>550000)return json({error:'Location profile is too large to save.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid location data.'},400);}
  if(!input||Array.isArray(input)||!Number.isInteger(input.version)||input.version<0)return json({error:'Reload this location before saving.'},400);
  if(input.version!==current.version)return conflict();
  if(Object.hasOwn(input,'type')&&input.type!==location.type)return json({error:'A location’s type cannot change.'},400);
  const document={};
  for(const key of template.fields){
   const value=Object.hasOwn(input,key)?input[key]:current[key];
   if(typeof value!=='string'||value.length>(key==='name'?160:template.imageFields.includes(key)?2048:10000))return json({error:'One or more fields exceed the allowed length.'},400);
   document[key]=value;
  }
  document.name=document.name.trim().replace(/\s+/g,' ');
  if(!document.name)return json({error:'Enter a location name.'},400);
  document.hiddenFields=readHiddenFields(input,current,template.hideableFields);
  if(!document.hiddenFields)return json({error:'Choose visible fields from this profile’s template.'},400);
  // Universes have no parent field; reject attempts to add a parent through JSON.
  if(location.type==='universe'&&input.parentId)return json({error:'A universe cannot have a parent location.'},400);
  document.parentId=document.parentId||null;
  if((document.parentId||requiresParent(location.type))&&!parentChoices(location.type,locations,id).some(l=>l.id===document.parentId))return json({error:'Choose a valid parent location. A location cannot contain itself or one of its ancestors.'},400);
  if(location.type==='area'&&!areaTypes.includes(document.areaType))return json({error:'Choose an area type.'},400);
  if(document.leaderId&&!characterCast(await db.list(owner)).some(c=>c.id===document.leaderId))return json({error:'Choose an existing character as leader.'},400);
  if(template.imageFields.some(key=>!validImageUrl(document[key])))return json({error:'Use an HTTPS image URL for images and maps.'},400);
  const saved=await db.saveLocationDetails(owner,id,input.version,document);
  return saved?json(responseRecord(defaultLocation({...saved,type:location.type}),locations)):conflict();
 }catch(error){console.error('Location profile request failed',error.message);return json({error:'Your location could not be saved or loaded. Please try again.'},503);}
}
