import {characterCardDetails} from './character-card-data.js';
import {repository} from './db.js';
import {characterCast} from './sample-characters.js';
import {factionCatalog,attachFactionNames} from './factions.js';
import {locationCatalog,defaultCountry} from './countries.js';
import {defaultCity} from './cities.js';
import {ancestors,typeLabels} from '../public/locations/data.js';
import {collectTimeline} from '../public/timeline/model.js';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const paths={character:'/characters/',faction:'/factions/',country:'/locations/countries/',city:'/locations/cities/'};
const names={character:'Character',faction:'Faction',...typeLabels};
function profileCard(record,kind){return {id:record.id,name:record.name?.trim()||'Untitled '+kind,kind,label:names[kind],href:paths[kind]+encodeURIComponent(record.id)+'/',summary:record.summary||'',title:record.title||record.motto||''};}

export function dashboardData({characters,factions,locations,countries,cities}){
 const cast=attachFactionNames(characterCast(characters),factions);
 const countryMap=new Map(countries.map(r=>[r.id,r])),cityMap=new Map(cities.map(r=>[r.id,r]));
 const countryProfiles=locations.filter(r=>r.type==='country').map(r=>({...defaultCountry(r),...countryMap.get(r.id)}));
 const cityProfiles=locations.filter(r=>r.type==='city').map(r=>({...defaultCity(r),...cityMap.get(r.id)}));
 const profiles={character:cast,faction:factions,country:countryProfiles,city:cityProfiles};
 // A hidden question still belongs on the dashboard. Open its profile normally
 // instead of jumping to an invisible field or changing the author's preference.
 const questions=Object.entries(profiles).flatMap(([kind,records])=>records.filter(r=>r.questions?.trim()).map(r=>{const prompts=r.questions.split(/\n+/).map(text=>text.trim()).filter(Boolean);return {...profileCard(r,kind),href:profileCard(r,kind).href+(r.hiddenFields?.includes('questions')?'':'#field-questions'),question:prompts[0],questionCount:prompts.length,prompts};}));
 return {
  questions,
  characters:cast.map(r=>({...profileCard(r,'character'),roles:r.roles.split(/\s*[·,;]\s*/).filter(Boolean),storyRole:r.storyRole,affiliation:r.affiliation,...characterCardDetails(r,{cast,factions,countries:countryProfiles,locations,profiles})})),
  factions:factions.map(r=>({...profileCard(r,'faction'),type:r.type,members:cast.filter(c=>c.factionId===r.id).length})),
  locations:locations.map(r=>{const profile=(r.type==='country'?countryProfiles:cityProfiles).find(p=>p.id===r.id);return {...(profile?profileCard(profile,r.type):{id:r.id,name:r.name,kind:r.type,label:typeLabels[r.type],href:'/locations/#location-'+encodeURIComponent(r.id)}),parent:ancestors(r,locations).map(a=>a.name).join(' / '),image:profile?.skylineUrl||profile?.flagUrl||'',areaType:r.areaType||''};}),
  timeline:collectTimeline(profiles)
 };
}

export async function dashboardRoute(request,env){
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Sign in to see your dashboard.'},401);
 if(request.method!=='GET')return json({error:'Method not allowed.'},405);
 try{
  const db=repository(env.DB);
  const [characters,factions,locations,countries,cities]=await Promise.all([db.list(owner),factionCatalog(db,owner),locationCatalog(db,owner),db.listCountryProfiles(owner),db.listCityProfiles(owner)]);
  return json(dashboardData({characters,factions,locations,countries,cities}));
 }catch(error){console.error('Dashboard request failed',error.message);return json({error:'Your dashboard could not be loaded. Please try again.'},503);}
}
