import { countryRoute } from './country-routes.js';
import { locationRoute } from './location-routes.js';
import { factionRoute } from './faction-routes.js';
import { factionCatalog, attachFactionNames } from './factions.js';
import { repository } from './db.js';
import { blankCharacter, fieldNames, idPattern, nameFields, fullName, storyRoles, alignments } from '../public/characters/template.js';
import { characters as seeds } from '../public/characters/data.js';
import { renderProfile } from './render-profile.js';
import { sampleCharacter, characterCast } from './sample-characters.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
function validate(input,current) {
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
 return output;
}
export function createWorker(assets) { return {async fetch(request,env) {
 const url=new URL(request.url);const path=url.pathname;
 if(/^\/locations\/countries\/(?:sample-kingdom|[0-9a-f-]{36})$/i.test(path))return Response.redirect(url.origin+path+'/',308);
 if(/^\/locations\/countries\/[^/]+\/$/.test(path)||path.startsWith('/api/countries/'))return countryRoute(request,env);
 if(path==='/api/locations')return locationRoute(request,env);
 if(path==='/characters/edit/'||path==='/characters/edit/index.html') {
  const legacyId=url.searchParams.get('id');
  return Response.redirect(url.origin+(idPattern.test(legacyId)||sampleCharacter(legacyId)?'/characters/'+legacyId+'/':'/characters/'),302);
 }
 if(/^\/characters\/([0-9a-f-]{36}|claude|gpt|deepseek|gemini)(?:\/index.html)?$/i.test(path))return Response.redirect(url.origin+path.replace(/\/index.html$/,'')+'/',308);
 if(/^\/factions\/(?:sample-(?:ember|lantern|archive|horizon)|[0-9a-f-]{36})(?:\/index.html)?$/i.test(path))return Response.redirect(url.origin+path.replace(/\/index.html$/,'')+'/',308);
 if(path==='/api/factions'||path.startsWith('/api/factions/')||/^\/factions\/[^/]+\/$/.test(path))return factionRoute(request,env);
 const api=path==='/api/characters'||path.startsWith('/api/characters/');
 const profile=path.match(/^\/characters\/([0-9a-f-]{36}|claude|gpt|deepseek|gemini)\/$/i);
 if(api||profile) {
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner) return json({error:'Sign in to access your characters.'},401);
  try {
   const db=repository(env.DB);
   if(profile) {
    const factions=await factionCatalog(db,owner);
    const character=attachFactionNames([await db.get(owner,profile[1])||sampleCharacter(profile[1])].filter(Boolean),factions)[0];
    if(!character) return new Response('Character not found. Return to /characters/',{status:404,headers:{'cache-control':'no-store'}});
    return new Response(renderProfile(character,attachFactionNames(characterCast(await db.list(owner)),factions),factions),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
   }
   const id=path.split('/')[3];
   if(id&&!idPattern.test(id)&&!sampleCharacter(id)) return json({error:'Character not found.'},404);
   if(request.method==='GET') {
    const factions=await factionCatalog(db,owner);
    if(!id) return json({characters:attachFactionNames(characterCast(await db.list(owner)),factions)});
    const character=await db.get(owner,id)||sampleCharacter(id);return character?json(attachFactionNames([character],factions)[0]):json({error:'Character not found.'},404);
   }
   if(!['POST','PUT'].includes(request.method)) return json({error:'Method not allowed.'},405);
   if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json')) return json({error:'This request could not be verified. Reload and try again.'},403);
   const body=await request.text();if(body.length>180000)return json({error:'Character is too large to save.'},413);
   let input;try{input=JSON.parse(body);}catch{return json({error:'Invalid character data.'},400);}
   if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Invalid character data.'},400);
   if(request.method==='POST'&&!id) {
    if(!idPattern.test(input.id))return json({error:'Invalid character ID.'},400);
    const character=await db.create(owner,input.id,blankCharacter());return character?json(character,201):json({error:'Could not create this character. Try again.'},409);
   }
   if(request.method==='PUT'&&id) {
    const current=await db.get(owner,id)||sampleCharacter(id);
    if(!current)return json({error:'Character not found.'},404);
    let document;try{document=validate(input,current);}catch(error){return json({error:error.message},400);}
    if(document.factionId){
     const faction=(await factionCatalog(db,owner)).find(f=>f.id===document.factionId);
     if(!faction)return json({error:'Choose an existing faction or create one.'},400);
     document.affiliation=faction.name;
    }
    const allowed=new Set([...seeds.map(c=>c.id),...(await db.list(owner)).map(c=>c.id)]);
    if(document.relationships.some(r=>r.targetId===id||!allowed.has(r.targetId)))return json({error:'Choose another existing character for each relationship.'},400);
    if(!Number.isInteger(input.version))return json({error:'Reload this character before saving.'},400);
    const updated=await db.save(owner,id,input.version,document);
    return updated?json(updated):json({error:'This character changed in another tab. Copy your unsaved text, then reload before saving.'},409);
   }
   return json({error:'Method not allowed.'},405);
  }catch(error){console.error('Character storage request failed',error.message);return json({error:'Your characters could not be saved or loaded. Please try again.'},503);}
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 let key=path.endsWith('/')?path+'index.html':path;
 if(!assets[key]&&assets[path+'/index.html'])return Response.redirect(url.origin+path+'/'+url.search,308);
 const asset=assets[key];
 if(!asset)return new Response('Page not found',{status:404});
 return new Response(request.method==='HEAD'?null:asset.content,{headers:{'content-type':asset.type,'cache-control':'no-cache','x-content-type-options':'nosniff'}});
}};}
