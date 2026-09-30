import {json,isSameOriginJson} from './http.js';
import {assetCacheControl} from './asset-url.js';
import {validateSchemaVersion} from './document-storage.js';
import {validateChoiceSelections} from '../public/profiles/choice-selections.js';
import {multiChoiceFields} from '../public/profiles/choices.js';
import {dashboardPages} from './dashboard-pages.js';
import {renderDashboardPage} from './dashboard-shell.js';
import {directoryPages} from './directory-pages.js';
import {renderDirectoryPage} from './directory-shell.js';
import {loreRoute} from './lore-routes.js';
import {writingRoute} from './writing-routes.js';
import {chapterPageRoute} from './chapter-pages.js';
import {novelRoute} from './novel-routes.js';
import {novelPageRoute} from './novel-pages.js';
import {collectionRoute} from './collection-routes.js';
import {collectionPageRoute} from './collection-pages.js';
import {validateCollectedNotes} from './collection-repository.js';
import {validateNovelContext,applyNovelContext} from './novel-context.js';
import {enhanceNovelAppearances} from './novel-appearances.js';
import {renderWritingWorkspace} from './render-writing.js';
import {storyArcRoute} from './story-arc-routes.js';
import {locationProfileRoute} from './location-profile-routes.js';
import {locationTemplates,locationProfileGroups} from '../public/locations/template.js';
import {locationPaths} from '../public/locations/data.js';
import {noteTargets,validateNoteConnections} from './note-connections.js';
import {validateNotes,cleanNoteReference,referenceKey} from '../public/characters/notes.js';
import {validateRatings} from '../public/characters/attributes.js';
import {numericTextFields,validNumericText,numericTextError} from '../public/characters/numeric-text.js';
import {validImageUrl} from '../public/locations/countries/template.js';
import {workspaceShell} from './workspace-shell.js';
import {timelineRoute} from './timeline-routes.js';
import {dashboardRoute,dashboardData} from './dashboard-routes.js';
import {locationCatalog,defaultCountry} from './countries.js';
import {defaultCity} from './cities.js';
import {characterMentions,cardConnectionOptions,characterCardDetails} from './character-card-data.js';
import { cityRoute } from './city-routes.js';
import { countryRoute } from './country-routes.js';
import { locationRoute } from './location-routes.js';
import { factionRoute } from './faction-routes.js';
import { factionCatalog, attachFactionNames } from './factions.js';
import { repository } from './db.js';
import { blankCharacter, fieldNames, idPattern, nameFields, fullName, storyRoles, alignments, humanChoices, hideableFields } from '../public/characters/template.js';
import { characters as seeds } from '../public/characters/data.js';
import { renderProfile } from './render-profile.js';
import { sampleCharacter, characterCast } from './sample-characters.js';
const portraitMimeTypes=new Set(['image/png','image/jpeg','image/webp','image/gif']);
const portraitMaxBytes=2*1024*1024;
const portraitChunkBytes=1024*1024;
const portraitUrlPattern=/^\/api\/characters\/([^/]+)\/portraits\/([0-9a-f-]+)$/i;
function ownedPortraitId(value,characterId){
 const match=portraitUrlPattern.exec(value);
 return match&&match[1]===characterId&&idPattern.test(match[2])?match[2]:null;
}
function matchesPortraitType(bytes,type){
 const starts=(...signature)=>signature.every((value,index)=>bytes[index]===value);
 if(type==='image/png')return bytes.length>=8&&starts(137,80,78,71,13,10,26,10);
 if(type==='image/jpeg')return bytes.length>=4&&starts(255,216,255);
 if(type==='image/webp')return bytes.length>=12&&starts(82,73,70,70)&&[87,69,66,80].every((value,index)=>bytes[index+8]===value);
 if(type==='image/gif')return bytes.length>=6&&starts(71,73,70,56)&&(bytes[4]===55||bytes[4]===57)&&bytes[5]===97;
 return false;
}
async function readPortraitBytes(request){
 const reader=request.body?.getReader();if(!reader)return new Uint8Array(0);
 const chunks=[];let total=0;
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;
   if(total>portraitMaxBytes){await reader.cancel();return null;}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return bytes;
}
function portraitHeaders(type,size){return {'content-type':type,'content-length':String(size),'cache-control':'private, no-store','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin'};}
/**
 * Build an allowlisted character document, retaining omitted fields from current.
 * Validates field/relationship shapes, notes, ratings, portrait, and visibility;
 * throws Error for the PUT branch to translate to 400. Catalog ownership,
 * reference existence, and optimistic version checks happen in the route later.
 * @param {object} input Parsed mutation payload (relationships is required).
 * @param {object} current Current saved document or source sample.
 * @returns {object} Normalized editable document, without persistence metadata.
 */
function validate(input,current,id) {
 const output=blankCharacter();
 for(const name of fieldNames) {
  const text=Object.hasOwn(input,name)?input[name]:(current[name]||'');
  if(typeof text!=='string'||text.length>(nameFields.includes(name)?160:10000)) throw new Error('One or more fields exceed the allowed length.');
  output[name]=text;
 }
 if(!nameFields.some(key=>Object.hasOwn(input,key))&&Object.hasOwn(input,'name')) {
  if(typeof input.name!=='string'||input.name.length>160)throw new Error('Name is too long.');
  if(input.name!==current.name){output.firstName=input.name;output.middleName='';output.lastName='';}
 }
 output.name=fullName(output);
 if(output.storyRole&&!storyRoles.includes(output.storyRole)&&output.storyRole!==current.storyRole)throw new Error('Choose a story role from the list.');
 if(output.alignment&&!alignments.includes(output.alignment)&&output.alignment!==current.alignment)throw new Error('Choose a moral alignment from the list.');
 output.affiliation=typeof input.affiliation==='string'?input.affiliation:current.affiliation||'';
 if(output.affiliation.length>10000)throw new Error('Affiliation is too long.');
 if(!Array.isArray(input.relationships)||input.relationships.length>100) throw new Error('Too many relationships.');
 output.relationships=input.relationships.map(r=>{
  if(!r||typeof r.targetId!=='string'||!(idPattern.test(r.targetId)||seeds.some(s=>s.id===r.targetId))||typeof r.type!=='string'||r.type.length>160||typeof r.description!=='string'||r.description.length>10000) throw new Error('Please check the relationship details.');
  return {targetId:r.targetId,type:r.type,description:r.description};
 });
 for(const [key,options] of Object.entries(humanChoices))if(output[key]&&!options.includes(output[key]))throw new Error('Choose a valid '+key+' option.');
 for(const key of numericTextFields)if(!validNumericText(key,output[key]))throw new Error(numericTextError);
 if((!validImageUrl(output.portraitUrl)&&!ownedPortraitId(output.portraitUrl,id))||output.portraitUrl.length>2048)throw new Error('Use an HTTPS image URL or an uploaded portrait for this character.');
 const assignments=Object.hasOwn(input,'nationalityContinents')?input.nationalityContinents:(current.nationalityContinents||{});
 if(!assignments||typeof assignments!=='object'||Array.isArray(assignments)||Object.keys(assignments).length>100)throw new Error('Choose a continent for each custom nationality.');
 output.choiceSelections=validateChoiceSelections(input,current,output,multiChoiceFields.filter(key=>fieldNames.includes(key)));
 const nationalities=output.choiceSelections.nationality;
 output.nationalityContinents=Object.fromEntries(Object.entries(assignments).filter(([name])=>nationalities.includes(name)));
 if(Object.values(output.nationalityContinents).some(id=>typeof id!=='string'))throw new Error('Choose an existing continent.');
 output.notes=validateNotes(Object.hasOwn(input,'notes')?input.notes:(current.notes||[]),output);
 output.attributeRatings=validateRatings(Object.hasOwn(input,'attributeRatings')?input.attributeRatings:(current.attributeRatings||{}));
 const connection=Object.hasOwn(input,'cardConnection')?input.cardConnection:(current.cardConnection||null);
 output.cardConnection=connection===null?null:cleanNoteReference(connection);
 const hidden=Object.hasOwn(input,'hiddenFields')?input.hiddenFields:current.hiddenFields||[];
 if(!Array.isArray(hidden)||hidden.length>hideableFields.length||hidden.some(key=>!hideableFields.includes(key)))throw new Error('Invalid field visibility settings.');
 output.hiddenFields=[...new Set(hidden)];
 return output;
}
/**
 * Internal first-match dispatcher: redirects -> delegated domain handlers ->
 * inline character routes -> static GET/HEAD fallback. Ordering is significant:
 * broad API prefixes must not consume a more specific endpoint placed later.
 * Authentication belongs to private handlers, not static pages or redirects.
 * See docs/routing.md for exact path, method, and query-string edge cases.
 * @param {Record<string, {content: string, type: string, encoding?: string}>} assets Built text or base64 assets.
 * @returns {{fetch: function(Request, object): Promise<Response>}}
 */
function createAppWorker(assets) {
 const decodedAssets=new Map();
 return {async fetch(request,env) {
 // Canonicalize/delegate specific location routes before broad APIs and assets.
 const url=new URL(request.url);const path=url.pathname;
 if(/^\/api\/(novels|series|novel-associations)(?:\/|$)/.test(path))return novelRoute(request,env);
 if(/^\/(novels|series)(?:\/(?:index\.html)?|\/[0-9a-f-]+(?:\/(?:index\.html)?)?|)$/.test(path))return novelPageRoute(request,env);
 if(path==='/api/library'||/^\/api\/collections(?:\/|$)/.test(path))return collectionRoute(request,env);
 if(/^\/collections(?:\/(?:index\.html)?|\/[0-9a-f-]+(?:\/(?:index\.html)?)?|)$/.test(path))return collectionPageRoute(request,env);
 if(path==='/chapters'||path==='/scenes'){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  return Response.redirect(url.origin+path+'/'+url.search,308);
 }
 if(path==='/chapters/'||path==='/scenes/'){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  return new Response(request.method==='HEAD'?null:renderWritingWorkspace(path==='/chapters/'?'chapters':'scenes'),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 }
 if(/^\/chapters\/[0-9a-f-]+(?:\/(?:index\.html)?)?$/i.test(path))return chapterPageRoute(request,env);
 if(/^\/api\/(chapters|scenes)(?:\/|$)/.test(path))return writingRoute(request,env);
 // Dashboard definitions all share one complete main-area shell.
 const dashboard=dashboardPages.get(path);
 if(dashboard){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  return new Response(request.method==='HEAD'?null:renderDashboardPage(dashboard),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff'}});
 }
 if(dashboardPages.has(path+'/')){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  return Response.redirect(url.origin+path+'/'+url.search,308);
 }
 const directory=directoryPages.get(path);
 if(directory){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  return new Response(request.method==='HEAD'?null:renderDirectoryPage(directory),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff'}});
 }
 if(directoryPages.has(path+'/')){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  return Response.redirect(url.origin+path+'/'+url.search,308);
 }
 if(/^\/locations\/countries\/(?:sample-kingdom|[0-9a-f-]{36})$/i.test(path))return Response.redirect(url.origin+path+'/',308);
 if(/^\/locations\/countries\/[^/]+\/$/.test(path)||path.startsWith('/api/countries/'))return countryRoute(request,env);
 if(/^\/locations\/cities\/(?:sample-capital|[0-9a-f-]{36})$/i.test(path))return Response.redirect(url.origin+path+'/',308);
 if(/^\/locations\/cities\/[^/]+\/$/.test(path)||path.startsWith('/api/cities/'))return cityRoute(request,env);
 const locationPage=Object.keys(locationTemplates).some(type=>path.startsWith(locationPaths[type])&&/^[^/]+\/?$/.test(path.slice(locationPaths[type].length)));
 if(locationPage&&!path.endsWith('/'))return Response.redirect(url.origin+path+'/'+url.search,308);
 if(locationPage||/^\/api\/locations\/[^/]+\/?$/.test(path))return locationProfileRoute(request,env);
 if(/^\/lore\/[0-9a-f-]{36}$/i.test(path))return Response.redirect(url.origin+path+'/'+url.search,308);
 if(/^\/lore\/[^/]+\/$/.test(path)||path==='/api/lore'||/^\/api\/lore\/[^/]+\/?$/.test(path))return loreRoute(request,env);
 if(/^\/story-arcs\/[0-9a-f-]{36}$/i.test(path))return Response.redirect(url.origin+path+'/'+url.search,308);
 if(/^\/story-arcs\/[^/]+\/$/.test(path)||path==='/api/story-arcs'||/^\/api\/story-arcs\/[^/]+\/?$/.test(path))return storyArcRoute(request,env);
 if(path==='/api/timeline')return timelineRoute(request,env);
 if(path==='/api/dashboard')return dashboardRoute(request,env);
 if(path==='/api/locations')return locationRoute(request,env);
 // Legacy URLs redirect without querying ownership; destination resolves access.
 if(path==='/characters/edit/'||path==='/characters/edit/index.html') {
  const legacyId=url.searchParams.get('id');
  return Response.redirect(url.origin+(idPattern.test(legacyId)||sampleCharacter(legacyId)?'/characters/'+legacyId+'/':'/characters/'),302);
 }
 if(/^\/characters\/([0-9a-f-]{36}|claude|gpt|deepseek|gemini)(?:\/index.html)?$/i.test(path))return Response.redirect(url.origin+path.replace(/\/index.html$/,'')+'/',308);
 if(/^\/factions\/(?:sample-(?:ember|lantern|archive|horizon)|[0-9a-f-]{36})(?:\/index.html)?$/i.test(path))return Response.redirect(url.origin+path.replace(/\/index.html$/,'')+'/',308);
 if(path==='/api/factions'||path.startsWith('/api/factions/')||/^\/factions\/[^/]+\/$/.test(path))return factionRoute(request,env);
 // Characters remain inline; HTML and JSON share the same owner-scoped repository.
 const api=path==='/api/characters'||path.startsWith('/api/characters/');
 const profile=path.match(/^\/characters\/([0-9a-f-]{36}|claude|gpt|deepseek|gemini)\/$/i);
 if(api||profile) {
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner) return json({error:'Sign in to access your characters.'},401);
  try {
   const db=repository(env.DB);
   const portrait=path.match(/^\/api\/characters\/([^/]+)\/portraits(?:\/([^/]+))?$/i);
   if(portrait){
    const [,characterId,imageId]=portrait;
    if(!idPattern.test(characterId)&&!sampleCharacter(characterId))return json({error:'Character not found.'},404);
    if(imageId){
     if(!idPattern.test(imageId))return json({error:'Portrait not found.'},404);
     if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed.'},405);
     if(request.method==='HEAD'){
      const row=await env.DB.prepare('SELECT content_type, total_size FROM character_images WHERE owner_id = ? AND character_id = ? AND image_id = ? AND chunk_index = 0').bind(owner,characterId,imageId).first();
      return row?new Response(null,{headers:portraitHeaders(row.content_type,row.total_size)}):json({error:'Portrait not found.'},404);
     }
     const result=await env.DB.prepare('SELECT chunk_index, content_type, total_size, data FROM character_images WHERE owner_id = ? AND character_id = ? AND image_id = ? ORDER BY chunk_index').bind(owner,characterId,imageId).all();
     const rows=result.results;if(!rows.length)return json({error:'Portrait not found.'},404);
     const size=rows[0].total_size,bytes=new Uint8Array(size);let offset=0;
     for(const [index,row] of rows.entries()){
      if(row.chunk_index!==index||row.content_type!==rows[0].content_type||row.total_size!==size)return json({error:'Portrait is unavailable.'},503);
      const chunk=new Uint8Array(row.data);bytes.set(chunk,offset);offset+=chunk.length;
     }
     if(offset!==size)return json({error:'Portrait is unavailable.'},503);
     return new Response(bytes,{headers:portraitHeaders(rows[0].content_type,size)});
    }
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    if(request.headers.get('origin')!==url.origin)return json({error:'This request could not be verified. Reload and try again.'},403);
    const type=request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase();
    if(!portraitMimeTypes.has(type))return json({error:'Choose a PNG, JPEG, WebP, or GIF image.'},415);
    if(Number(request.headers.get('content-length'))>portraitMaxBytes)return json({error:'Portraits must be 2 MiB or smaller.'},413);
    const bytes=await readPortraitBytes(request);
    if(!bytes)return json({error:'Portraits must be 2 MiB or smaller.'},413);
    if(!bytes.length||!matchesPortraitType(bytes,type))return json({error:'The selected file is not a valid '+type+' image.'},400);
    if(!await db.get(owner,characterId)&&!sampleCharacter(characterId))return json({error:'Character not found.'},404);
    const newImageId=crypto.randomUUID(),createdAt=new Date().toISOString(),statements=[];
    for(let offset=0,index=0;offset<bytes.length;offset+=portraitChunkBytes,index++){
     statements.push(env.DB.prepare('INSERT INTO character_images (image_id, chunk_index, owner_id, character_id, content_type, total_size, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(newImageId,index,owner,characterId,type,bytes.length,bytes.subarray(offset,offset+portraitChunkBytes),createdAt));
    }
    await env.DB.batch(statements);
    return json({url:'/api/characters/'+characterId+'/portraits/'+newImageId},201);
   }
   if(profile) {
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{'cache-control':'no-store'}});
    const record=await db.get(owner,profile[1])||sampleCharacter(profile[1]);
    if(!record) return new Response('Character not found. Return to /characters/',{status:404,headers:{'cache-control':'no-store'}});
    const headers={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
    if(request.method==='HEAD')return new Response(null,{headers});
    const factions=await factionCatalog(db,owner),character=attachFactionNames([record],factions)[0];
    const [savedCast,locations,countries,cities,lore]=await Promise.all([db.list(owner),locationCatalog(db,owner),db.listCountryProfiles(owner),db.listCityProfiles(owner),db.listLore(owner)]);
    const cast=attachFactionNames(characterCast(savedCast),factions);
    const countryMap=new Map(countries.map(p=>[p.id,p])),cityMap=new Map(cities.map(p=>[p.id,p]));
    const notes=characterMentions(character,{...locationProfileGroups(locations),lore,character:cast,faction:factions,country:locations.filter(l=>l.type==='country').map(l=>({...defaultCountry(l),...countryMap.get(l.id)})),city:locations.filter(l=>l.type==='city').map(l=>({...defaultCity(l),...cityMap.get(l.id)}))},{includeOwn:false});
    return new Response(renderProfile(character,cast,factions,locations,notes,lore),{headers});
   }
   const id=path.split('/')[3];
   if(id&&!idPattern.test(id)&&!sampleCharacter(id)) return json({error:'Character not found.'},404);
   if(request.method==='GET') {
    const factions=await factionCatalog(db,owner);
    if(!id){
     const saved=await db.list(owner),cast=attachFactionNames(characterCast(saved),factions);
     // Display projection replaces raw roles/relationships; never use it as a PUT body.
     if(url.searchParams.get('view')==='cards'){
      const [locations,countries,cities,lore]=await Promise.all([locationCatalog(db,owner),db.listCountryProfiles(owner),db.listCityProfiles(owner),db.listLore(owner)]);
      const cards=dashboardData({characters:saved,factions,locations,countries,cities,lore}).characters;
      return json({characters:cast.map(c=>({...c,...cards.find(card=>card.id===c.id)}))});
     }
     return json({characters:cast});
    }
    const character=await db.get(owner,id)||sampleCharacter(id);
    // Featured-item picker receives a writable document plus separate display options.
    if(character&&url.searchParams.get('view')==='connections'){
     const [saved,locations,countries,cities,lore]=await Promise.all([db.list(owner),locationCatalog(db,owner),db.listCountryProfiles(owner),db.listCityProfiles(owner),db.listLore(owner)]);
     const cast=characterCast(saved),countryProfiles=locations.filter(l=>l.type==='country').map(l=>({...defaultCountry(l),...countries.find(c=>c.id===l.id)})),cityProfiles=locations.filter(l=>l.type==='city').map(l=>({...defaultCity(l),...cities.find(c=>c.id===l.id)}));
     const context={cast,factions,locations,lore,countries:countryProfiles,profiles:{...locationProfileGroups(locations),lore,character:cast,faction:factions,country:countryProfiles,city:cityProfiles}};
     return json({character,defaultAffiliationCard:characterCardDetails(character,context).defaultAffiliationCard,options:cardConnectionOptions(character,{...context,cities:cityProfiles})});
    }
    return character?json(attachFactionNames([character],factions)[0]):json({error:'Character not found.'},404);
   }
   // Mutation envelope checks precede branch-specific field/reference validation.
   if(!['POST','PUT'].includes(request.method)) return json({error:'Method not allowed.'},405);
    if(!isSameOriginJson(request,url.origin)) return json({error:'This request could not be verified. Reload and try again.'},403);
   const body=await request.text();if(body.length>180000)return json({error:'Character is too large to save.'},413);
   let input;try{input=JSON.parse(body);}catch{return json({error:'Invalid character data.'},400);}
   if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Invalid character data.'},400);
   try{validateSchemaVersion(input);}catch(error){return json({error:error.message},400);}
   if(request.method==='POST'&&!id) {
    if(!idPattern.test(input.id))return json({error:'Invalid character ID.'},400);
    if(Object.hasOwn(input,'name')&&(typeof input.name!=='string'||!input.name.trim()||input.name.length>160))return json({error:'Enter a character name of 1–160 characters.'},400);
    const document=blankCharacter();if(input.name){document.firstName=input.name.trim();document.name=document.firstName;}
    const character=await db.create(owner,input.id,document);return character?json(character,201):json({error:'Could not create this character. Try again.'},409);
   }
   if(request.method==='PUT'&&id) {
    if(Object.hasOwn(input,'id')&&input.id!==id)return json({error:'A character’s ID cannot change.'},400);
    const current=await db.get(owner,id)||sampleCharacter(id);
    if(!current)return json({error:'Character not found.'},404);
    let document;try{document=validate(input,current,id);}catch(error){return json({error:error.message},400);}
    const imageId=ownedPortraitId(document.portraitUrl,id);
    if(imageId&&!await env.DB.prepare('SELECT 1 FROM character_images WHERE owner_id = ? AND character_id = ? AND image_id = ? AND chunk_index = 0').bind(owner,id,imageId).first())return json({error:'Choose a portrait uploaded to this character.'},400);
    const [factions,locations,savedCast,lore]=await Promise.all([factionCatalog(db,owner),locationCatalog(db,owner),db.list(owner),db.listLore(owner)]);
    if(document.factionId){
     const faction=factions.find(f=>f.id===document.factionId);
     if(!faction)return json({error:'Choose an existing faction or create one.'},400);
     document.affiliation=faction.name;
    }
    if(Object.values(document.nationalityContinents).some(id=>!locations.some(l=>l.id===id&&l.type==='continent')))return json({error:'Choose a continent from your locations for each custom nationality.'},400);
    for(const key of ['birthPlaceId','residenceId','citizenshipId'])if(document[key]&&!locations.some(l=>l.id===document[key]&&(key!=='citizenshipId'||l.type==='country')))return json({error:'Choose an existing location for birthplace or residence, and a country for citizenship.'},400);
    const cast=characterCast(savedCast);
    const allowed=new Set(cast.map(c=>c.id));
    // Include draft notes when validating links created within the same character save.
    const proposedCast=cast.map(c=>c.id===id?{...document,id}:c);
    try{
     const targets=noteTargets(proposedCast,factions,locations,lore);
     validateNoteConnections(document.notes,targets,current.notes||[],id);
     await validateCollectedNotes(env.DB,owner,current.id,document);
     if(document.cardConnection){
      const key=referenceKey(document.cardConnection);
      if(document.cardConnection.kind==='character'&&document.cardConnection.id===id)throw new Error('Choose another item to feature on this card.');
      if(key!==(current.cardConnection&&referenceKey(current.cardConnection))&&!targets.some(target=>referenceKey(target)===key))throw new Error('Choose an existing item from your world.');
     }
    }catch(error){return json({error:error.message},400);}
    if(document.relationships.some(r=>r.targetId===id||!allowed.has(r.targetId)))return json({error:'Choose another existing character for each relationship.'},400);
    if(!Number.isSafeInteger(input.version)||input.version<0||input.version===Number.MAX_SAFE_INTEGER)return json({error:'Reload this character before saving.'},400);
    // Repository performs the conditional write; a stale version cannot overwrite content.
    const updated=await db.save(owner,id,input.version,document);
    return updated?json(updated):json({error:'This character changed in another tab. Copy your unsaved text, then reload before saving.'},409);
   }
   return json({error:'Method not allowed.'},405);
  }catch(error){console.error('Character storage request failed',error.message);return json({error:'Your characters could not be saved or loaded. Please try again.'},503);}
 }
 // Static fallback is last. It needs no identity; directory data loads through private APIs.
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 let key=path.endsWith('/')?path+'index.html':path;
 if(!assets[key]&&assets[path+'/index.html'])return Response.redirect(url.origin+path+'/'+url.search,308);
 const asset=assets[key];
 if(!asset)return new Response('Page not found',{status:404});
 let body=null;
 if(request.method!=='HEAD'){
  if(asset.encoding==='base64'){
   if(!decodedAssets.has(key))decodedAssets.set(key,Uint8Array.from(atob(asset.content),character=>character.charCodeAt(0)));
   body=decodedAssets.get(key);
  }else body=asset.content;
 }
 return new Response(body,{headers:{'content-type':asset.type,'cache-control':assetCacheControl(url,asset.type),'x-content-type-options':'nosniff'}});
}};}


// Apply the same navigation shell to static directories and server-rendered profiles.
/**
 * Public build/test entry point. Decorate the inner response with workspace UI
 * only for non-HEAD HTML. JSON, redirects without HTML, and other content pass
 * through. Buffer HTML, preserve status/headers, and remove stale content-length.
 * workspaceShell is idempotent; entity renderers must not duplicate its markup.
 * @param {Record<string, {content: string, type: string, encoding?: string}>} assets Built text or base64 assets.
 * @returns {{fetch: function(Request, object, object): Promise<Response>}}
 */
export function createWorker(assets) {
 const app=createAppWorker(assets);
 return {async fetch(request,env,ctx) {
  let response;
  try{
   const invalidContext=await validateNovelContext(request,env);if(invalidContext)return invalidContext;
   response=await applyNovelContext(request,env,await app.fetch(request,env,ctx));
   response=await enhanceNovelAppearances(request,env,response);
  }catch(error){console.error('Workspace request failed',error.message);return json({error:'This workspace request could not be completed. Your draft is still here.'},503);}
  if(request.method==='HEAD'||!response.headers.get('content-type')?.includes('text/html'))return response;
  const headers=new Headers(response.headers);headers.delete('content-length');
  return new Response(workspaceShell(await response.text(),new URL(request.url).pathname),{status:response.status,headers});
 }};
}
