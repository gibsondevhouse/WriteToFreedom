import {validateSchemaVersion} from './document-storage.js';
import {readHiddenFields} from '../public/profiles/schema.js';
import {repository} from './db.js';
import {locationCatalog,defaultCountry} from './countries.js';
import {defaultCity} from './cities.js';
import {cityHideableFields,cityFields,cityImageFields,validImageUrl} from '../public/locations/cities/template.js';
import {characterCast} from './sample-characters.js';
import {renderCity} from './render-city.js';
import {ratingGroupsFor,validateProfileRatings} from '../public/profiles/ratings.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
/**
 * Serve /locations/cities/id/ HTML (GET/HEAD) or /api/cities/id JSON (GET/PUT).
 * Resolve an owned/catalog city first; choose its saved profile or default.
 * PUT rejects stale/negative versions, requires a valid country, validates
 * leader/images/visibility, and prevents moving a designated capital/largest
 * city until the original country's references are cleared. Repository save
 * batches the profile write with its catalog name/parent update.
 * @param {Request} request Both route forms place the ID at path segment 3.
 * @param {{DB: object}} env D1-compatible binding.
 * @returns {Promise<Response>} JSON or HTML; creation is handled by locationRoute.
 */
export async function cityRoute(request,env){
 const url=new URL(request.url),id=url.pathname.split('/')[3],profile=url.pathname.startsWith('/locations/'),owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Sign in to access your cities.'},401);
 try{
  const db=repository(env.DB),locations=await locationCatalog(db,owner),location=locations.find(l=>l.id===id&&l.type==='city');
  if(!location)return json({error:'City not found.'},404);
  const stored=(await db.listCityProfiles(owner)).find(p=>p.id===id),current={...defaultCity(location),...stored,profileRatings:{...(stored?.profileRatings||{})}},cast=characterCast(await db.list(owner));
  if(profile){if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed.'},405);return new Response(request.method==='HEAD'?null:renderCity(current,locations,cast,await db.listLore(owner)),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
  if(request.method==='GET')return json(current);
  if(request.method!=='PUT')return json({error:'Method not allowed.'},405);
  if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'This request could not be verified.'},403);
  const raw=await request.text();if(raw.length>550000)return json({error:'City profile is too large to save.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid city data.'},400);}
  if(!input||typeof input!=='object'||Array.isArray(input)||!Number.isSafeInteger(input.version)||input.version>=Number.MAX_SAFE_INTEGER||input.version<0)return json({error:'Reload this city before saving.'},400);
  try{validateSchemaVersion(input);}catch(error){return json({error:error.message},400);}
  if(Object.hasOwn(input,'id')&&input.id!==id)return json({error:'A city’s ID cannot change.'},400);
  if(Object.hasOwn(input,'type')&&input.type!=='city')return json({error:'A city’s type cannot change.'},400);
  if(input.version!==current.version)return json({error:'This city changed in another tab. Copy your unsaved text, then reload before saving.'},409);
  const document={};for(const key of cityFields){const value=Object.hasOwn(input,key)?input[key]:current[key]||'';if(typeof value!=='string'||value.length>(key==='name'?160:cityImageFields.includes(key)?2048:10000))return json({error:'One or more fields exceed the allowed length.'},400);document[key]=value;}
  document.hiddenFields=readHiddenFields(input,current,cityHideableFields);if(!document.hiddenFields)return json({error:'Choose visible fields from this profile’s template.'},400);
  try{document.profileRatings=validateProfileRatings(Object.hasOwn(input,'profileRatings')?input.profileRatings:(current.profileRatings||{}),ratingGroupsFor('location','city'));}catch(error){return json({error:error.message},400);}
  document.name=document.name.trim().replace(/\s+/g,' ');if(!document.name)return json({error:'Enter a city name.'},400);
  if(!locations.some(l=>l.id===document.parentId&&l.type==='country'))return json({error:'Every city must belong to a country. Choose an existing country.'},400);
  for(const key of cityImageFields)if(!validImageUrl(document[key]))return json({error:'Use an HTTPS image URL for city images and maps.'},400);
  if(document.leaderId&&!cast.some(c=>c.id===document.leaderId))return json({error:'Choose an existing character as city leader.'},400);
  if(document.parentId!==current.parentId){
   const oldLocation=locations.find(l=>l.id===current.parentId),oldCountry=oldLocation&&((await db.listCountryProfiles(owner)).find(p=>p.id===oldLocation.id)||defaultCountry(oldLocation));
   if(oldCountry&&(oldCountry.capitalId===id||oldCountry.largestCityId===id))return json({error:`This city is recorded as the capital or largest city of ${oldCountry.name}. Change those fields on that country’s profile before moving it.`},400);
  }
  const saved=await db.saveCity(owner,id,input.version,document);return saved?json(saved):json({error:'This city changed in another tab. Copy your unsaved text, then reload before saving.'},409);
 }catch(error){console.error('City request failed',error.message);return json({error:'Your city could not be saved or loaded. Please try again.'},503);}
}
