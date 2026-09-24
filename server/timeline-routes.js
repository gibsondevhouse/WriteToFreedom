import {locationProfileGroups} from '../public/locations/template.js';
import {repository} from './db.js';
import {characterCast} from './sample-characters.js';
import {factionCatalog} from './factions.js';
import {locationCatalog,defaultCountry} from './countries.js';
import {defaultCity} from './cities.js';
import {collectTimeline} from '../public/timeline/model.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
/**
 * GET /api/timeline: require identity and reject other methods before querying.
 * Merge owner-scoped saved profiles with defaults, then derive story events via
 * collectTimeline. No timeline records or synchronization state are persisted.
 * Concurrent catalog reads are not an atomic cross-catalog snapshot.
 * @param {Request} request Authenticated GET.
 * @param {{DB: object}} env D1-compatible binding.
 * @returns {Promise<Response>} JSON {events, unplaced, undated, counts}, or error.
 */
export async function timelineRoute(request,env){
 const owner=request.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'Sign in to see your timeline.'},401);
 if(request.method!=='GET')return json({error:'Method not allowed.'},405);
 try{
  const db=repository(env.DB);
  const [characters,factions,locations,countries,cities,lore]=await Promise.all([db.list(owner),factionCatalog(db,owner),locationCatalog(db,owner),db.listCountryProfiles(owner),db.listCityProfiles(owner),db.listLore(owner)]);
  const countryProfiles=new Map(countries.map(c=>[c.id,c])),cityProfiles=new Map(cities.map(c=>[c.id,c]));
  return json(collectTimeline({...locationProfileGroups(locations),lore,character:characterCast(characters),faction:factions,country:locations.filter(l=>l.type==='country').map(l=>({...defaultCountry(l),...countryProfiles.get(l.id)})),city:locations.filter(l=>l.type==='city').map(l=>({...defaultCity(l),...cityProfiles.get(l.id)}))}));
 }catch(error){console.error('Timeline request failed',error.message);return json({error:'Your timeline could not be loaded. Please try again.'},503);}
}
