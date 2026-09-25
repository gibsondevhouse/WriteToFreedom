import {parentChoices} from '../public/locations/data.js';
import {readHiddenFields} from '../public/profiles/schema.js';
import {repository} from './db.js';
import {locationCatalog,defaultCountry} from './countries.js';
import {countryHideableFields,countryFields,countryImageFields,validImageUrl} from '../public/locations/countries/template.js';
import {characterCast} from './sample-characters.js';
import {renderCountry} from './render-country.js';
import {ratingGroupsFor,validateProfileRatings} from '../public/profiles/ratings.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
/**
 * Serve existing country profiles at /locations/countries/id/ (GET/HEAD HTML)
 * and /api/countries/id (GET/PUT JSON). Both forms use path segment 3 as ID.
 * Resolve a country location before method dispatch; overlay saved fields on
 * defaults. PUT validates optional world parent, local capital/largest city,
 * leader, images and visibility, then saves with an optimistic version and a
 * guarded catalog rename/reparent. Create countries through /api/locations.
 * @param {Request} request Identity required; PUT additionally needs same-origin JSON.
 * @param {{DB: object}} env D1-compatible binding.
 * @returns {Promise<Response>} Expected errors are JSON; processing failures are 503.
 */
export async function countryRoute(request,env){
 const url=new URL(request.url),id=url.pathname.split('/')[3],profile=url.pathname.startsWith('/locations/'),owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Sign in to access your countries.'},401);
 try{
  const db=repository(env.DB),locations=await locationCatalog(db,owner),location=locations.find(l=>l.id===id&&l.type==='country');
  if(!location)return json({error:'Country not found.'},404);
  const stored=(await db.listCountryProfiles(owner)).find(p=>p.id===id),current={...defaultCountry(location),...stored,profileRatings:{...(stored?.profileRatings||{})}},cast=characterCast(await db.list(owner));
  if(profile){if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed.'},405);return new Response(request.method==='HEAD'?null:renderCountry(current,locations,cast,await db.listLore(owner)),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
  if(request.method==='GET')return json(current);
  if(request.method!=='PUT')return json({error:'Method not allowed.'},405);
  if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'This request could not be verified.'},403);
  const raw=await request.text();if(raw.length>550000)return json({error:'Country profile is too large to save.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid country data.'},400);}
  if(!input||!Number.isInteger(input.version))return json({error:'Reload this country before saving.'},400);
  const document={};for(const key of countryFields){const value=Object.hasOwn(input,key)?input[key]:current[key]||'';if(typeof value!=='string'||value.length>(key==='name'?160:countryImageFields.includes(key)?2048:10000))return json({error:'One or more fields exceed the allowed length.'},400);document[key]=value;}
  document.hiddenFields=readHiddenFields(input,current,countryHideableFields);if(!document.hiddenFields)return json({error:'Choose visible fields from this profile’s template.'},400);
  try{document.profileRatings=validateProfileRatings(Object.hasOwn(input,'profileRatings')?input.profileRatings:(current.profileRatings||{}),ratingGroupsFor('location','country'));}catch(error){return json({error:error.message},400);}
  document.name=document.name.trim().replace(/\s+/g,' ');if(!document.name)return json({error:'Enter a country name.'},400);
  for(const key of countryImageFields)if(!validImageUrl(document[key]))return json({error:'Use an HTTPS image URL for the flag, coat of arms, or map.'},400);
  if(document.parentId&&!parentChoices('country',locations,id).some(p=>p.id===document.parentId))return json({error:'Choose a continent, planet, or moon from your locations.'},400);
  for(const key of ['capitalId','largestCityId'])if(document[key]&&!locations.some(l=>l.id===document[key]&&l.type==='city'&&l.parentId===id))return json({error:'Choose a city that belongs to this country.'},400);
  if(document.leaderId&&!cast.some(c=>c.id===document.leaderId))return json({error:'Choose an existing character as head of state.'},400);
  const saved=await db.saveCountry(owner,id,input.version,document);return saved?json(saved):json({error:'This country changed in another tab. Copy your unsaved text, then reload before saving.'},409);
 }catch(error){console.error('Country request failed',error.message);return json({error:'Your country could not be saved or loaded. Please try again.'},503);}
}
