import {loreCard} from './lore.js';
import {locationProfileGroups} from '../public/locations/template.js';
import {locationPaths} from '../public/locations/data.js';
import {characterCardDetails} from './character-card-data.js';
import {repository} from './db.js';
import {collectionRepository} from './collection-repository.js';
import {characterCast} from './sample-characters.js';
import {factionCatalog,attachFactionNames} from './factions.js';
import {locationCatalog,defaultCountry} from './countries.js';
import {defaultCity} from './cities.js';
import {ancestors,typeLabels} from '../public/locations/data.js';
import {collectTimeline} from '../public/timeline/model.js';
import {choicesFor} from '../public/profiles/choice-selections.js';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const paths={...locationPaths,lore:'/lore/',character:'/characters/',faction:'/factions/',storyArc:'/story-arcs/'};
const names={lore:'Lore',character:'Character',faction:'Faction',storyArc:'Story Arc',...typeLabels};
function profileCard(record,kind){return {id:record.id,name:record.name?.trim()||'Untitled '+kind,kind,label:names[kind],href:paths[kind]+encodeURIComponent(record.id)+'/',summary:record.summary||'',title:record.title||record.motto||''};}

/**
 * Pure projection of already owner-scoped catalogs into dashboard view models.
 * Merge character samples and country/city defaults; derive questions, rich
 * character cards, faction membership counts, place paths, and story events.
 * Also powers /api/characters?view=cards: its relationships/roles are display
 * shapes and must not be sent back as an editable character document.
 * @param {object} catalogs Arrays: characters (saved), factions, locations,
 * countries (saved profiles), cities (saved profiles), lore (optional standalone entries).
 * @returns {object} {questions, characters, factions, locations, lore, timeline}.
 */
export function dashboardData({characters,factions,locations,countries,cities,lore=[],storyArcs=[],novels=[],series=[],collections=[]}){
 const cast=attachFactionNames(characterCast(characters),factions);
 const countryMap=new Map(countries.map(r=>[r.id,r])),cityMap=new Map(cities.map(r=>[r.id,r]));
 const countryProfiles=locations.filter(r=>r.type==='country').map(r=>({...defaultCountry(r),...countryMap.get(r.id)}));
 const cityProfiles=locations.filter(r=>r.type==='city').map(r=>({...defaultCity(r),...cityMap.get(r.id)}));
 const profiles={...locationProfileGroups(locations),lore,storyArc:storyArcs,character:cast,faction:factions,country:countryProfiles,city:cityProfiles};
 // A hidden question still belongs on the dashboard. Open its profile normally
 // instead of jumping to an invisible field or changing the author's preference.
 const questions=Object.entries(profiles).flatMap(([kind,records])=>records.filter(r=>r.questions?.trim()).map(r=>{const prompts=r.questions.split(/\n+/).map(text=>text.trim()).filter(Boolean);return {...profileCard(r,kind),href:profileCard(r,kind).href+(r.hiddenFields?.includes('questions')?'':'#field-questions'),question:prompts[0],questionCount:prompts.length,prompts};}));
 return {
  questions,
  novels:novels.map(r=>({id:r.id,name:r.title||'Untitled novel',kind:'novel',label:'Novel',href:'/novels/'+encodeURIComponent(r.id)+'/',image:r.coverUrl||'',summary:r.synopsis||'',status:r.status||'drafting'})),
  series:series.map(r=>({id:r.id,name:r.title||'Untitled series',kind:'series',label:'Series',href:'/series/'+encodeURIComponent(r.id)+'/',image:r.coverUrl||'',summary:r.summary||'',status:''})),
  collections:collections.map(r=>({id:r.id,name:r.name,kind:'collection',label:r.kind==='smart'?'Smart collection':'Collection',href:'/collections/'+encodeURIComponent(r.id)+'/',image:r.coverUrl||'',summary:r.summary||''})),
  lore:lore.map(loreCard),
  storyArcs:storyArcs.map(r=>({...profileCard(r,'storyArc'),type:r.arcType,status:r.status,startDate:r.startDate,endDate:r.endDate})),
  characters:cast.map(r=>({...profileCard(r,'character'),roles:choicesFor(r,'roles'),storyRole:r.storyRole,affiliation:r.affiliation,...characterCardDetails(r,{cast,factions,countries:countryProfiles,locations,profiles})})),
  factions:factions.map(r=>({...profileCard(r,'faction'),type:r.type,members:cast.filter(c=>c.factionId===r.id).length})),
  locations:locations.map(r=>{const profile=profiles[r.type].find(p=>p.id===r.id);return {...profileCard(profile,r.type),parent:ancestors(r,locations).map(a=>a.name).join(' / '),image:profile?.imageUrl||profile?.skylineUrl||profile?.flagUrl||'',areaType:r.areaType||''};}),
  timeline:collectTimeline(profiles)
 };
}

/**
 * GET /api/dashboard: authenticate and gate methods before concurrent reads,
 * then pass catalogs to dashboardData. This endpoint also supplies shell search.
 * Performs no writes; processing/storage exceptions are logged and become 503.
 * @param {Request} request Authenticated GET.
 * @param {{DB: object}} env D1-compatible binding.
 * @returns {Promise<Response>} Owner-scoped dashboard JSON with no-store headers.
 */
export async function dashboardRoute(request,env){
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Sign in to see your dashboard.'},401);
 if(request.method!=='GET')return json({error:'Method not allowed.'},405);
 try{
  const db=repository(env.DB);
  const [characters,factions,locations,countries,cities,lore,storyArcs,novels,series,collections]=await Promise.all([db.list(owner),factionCatalog(db,owner),locationCatalog(db,owner),db.listCountryProfiles(owner),db.listCityProfiles(owner),db.listLore(owner),db.listStoryArcs(owner),db.listNovels(owner),db.listSeries(owner),collectionRepository(env.DB).list(owner)]);
  return json(dashboardData({characters,factions,locations,countries,cities,lore,storyArcs,novels,series,collections}));
 }catch(error){console.error('Dashboard request failed',error.message);return json({error:'Your dashboard could not be loaded. Please try again.'},503);}
}
