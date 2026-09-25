import {validateSchemaVersion} from './document-storage.js';
import {repository} from './db.js';
import {characterCast} from './sample-characters.js';
import {factionCatalog} from './factions.js';
import {locationCatalog} from './countries.js';
import {locationHref,typeLabels} from '../public/locations/data.js';
import {idPattern} from '../public/characters/template.js';
import {readHiddenFields} from '../public/profiles/schema.js';
import {arcTypes,arcStatuses,arcBeats,pacingMetrics,blankStoryArc,storyArcFields,storyArcHideableFields} from '../public/story-arcs/template.js';
import {renderStoryArc} from './render-story-arc.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const targetKey=target=>target.kind+':'+target.id;
function entityTargets(characters,factions,locations){
 return [
  ...characters.map(record=>({kind:'character',id:record.id,label:record.name||'Untitled character',group:'Characters',href:'/characters/'+encodeURIComponent(record.id)+'/'})),
  ...factions.map(record=>({kind:'faction',id:record.id,label:record.name||'Untitled faction',group:'Factions',href:'/factions/'+encodeURIComponent(record.id)+'/'})),
  ...locations.map(record=>({kind:'location',id:record.id,label:record.name,group:typeLabels[record.type]||'Locations',href:locationHref(record)}))
 ];
}
function normalize(record){
 // Legacy scenes acquire deterministic, arc-scoped identities on read; the next
 // save persists them so edits and reordering never change a scene's identity.
 const keyScenes=(record.keyScenes||[]).map((scene,index)=>({...scene,id:scene.id||`${record.id}-scene-${index+1}`}));
 return {...blankStoryArc(),...record,pacing:{...blankStoryArc().pacing,...(record.pacing||{})},keyEntities:record.keyEntities||[],connectedArcIds:record.connectedArcIds||[],keyScenes,hiddenFields:record.hiddenFields||[]};
}
function validate(input,current,targets,arcs,allowBlankName=false){
 const document=blankStoryArc();
 for(const key of storyArcFields){const value=Object.hasOwn(input,key)?input[key]:current[key];if(typeof value!=='string'||value.length>(key==='name'?160:10000))throw new Error('One or more story arc fields exceed the allowed length.');document[key]=value;}
 document.name=document.name.trim().replace(/\s+/g,' ');if(!document.name&&!allowBlankName)throw new Error('Enter a story arc title.');
 if(!arcTypes.includes(document.arcType))throw new Error('Choose a valid story arc type.');
 if(!arcStatuses.includes(document.status))throw new Error('Choose a valid drafting status.');
 document.hiddenFields=readHiddenFields(input,current,storyArcHideableFields);if(!document.hiddenFields)throw new Error('Choose visible fields from this story arc template.');
 const pacing=Object.hasOwn(input,'pacing')?input.pacing:current.pacing;if(!pacing||typeof pacing!=='object'||Array.isArray(pacing))throw new Error('Check the tension tracker values.');
 document.pacing={};for(const beat of arcBeats){const source=pacing[beat.id];if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('Check the tension tracker values.');document.pacing[beat.id]={};for(const [metric] of pacingMetrics){const value=source[metric];if(!Number.isInteger(value)||value<0||value>99)throw new Error('Tension tracker values must be whole numbers from 0 to 99.');document.pacing[beat.id][metric]=value;}}
 const keyEntities=Object.hasOwn(input,'keyEntities')?input.keyEntities:current.keyEntities;if(!Array.isArray(keyEntities)||keyEntities.length>60)throw new Error('Keep at most 60 key entities.');
 const known=new Set(targets.map(targetKey)),old=new Set((current.keyEntities||[]).map(targetKey)),seen=new Set();document.keyEntities=keyEntities.map(reference=>{if(!reference||!['character','faction','location'].includes(reference.kind)||typeof reference.id!=='string')throw new Error('Choose key entities from your world.');const key=targetKey(reference);if(!known.has(key)&&!old.has(key))throw new Error('Choose key entities from your world.');if(seen.has(key))throw new Error('Choose each key entity once.');seen.add(key);return {kind:reference.kind,id:reference.id};});
 const connected=Object.hasOwn(input,'connectedArcIds')?input.connectedArcIds:current.connectedArcIds;if(!Array.isArray(connected)||connected.length>40)throw new Error('Keep at most 40 connected subplots.');const arcIds=new Set(arcs.map(arc=>arc.id));document.connectedArcIds=[...new Set(connected.map(id=>{if(typeof id!=='string'||id===current.id||!arcIds.has(id))throw new Error('Choose existing story arcs as connected subplots.');return id;}))];
 const scenes=Object.hasOwn(input,'keyScenes')?input.keyScenes:current.keyScenes;
 if(!Array.isArray(scenes)||scenes.length>60)throw new Error('Keep at most 60 key scenes.');
 const currentSceneIds=new Set(current.keyScenes.map(scene=>scene.id)),sceneIds=new Set();
 document.keyScenes=scenes.map(scene=>{
  if(!scene||typeof scene!=='object'||Array.isArray(scene))throw new Error('Check the key scene details.');
  // Older clients can create their first scenes, but cannot silently replace
  // established identities when saving an existing scene list.
  if(!Object.hasOwn(scene,'id')&&currentSceneIds.size)throw new Error('Reload this story arc to preserve its key scene IDs before saving.');
  const id=Object.hasOwn(scene,'id')?scene.id:crypto.randomUUID();
  if(typeof id!=='string'||(!idPattern.test(id)&&!currentSceneIds.has(id))||sceneIds.has(id))throw new Error('Give each key scene a unique valid ID.');
  sceneIds.add(id);
  const clean={id};
  for(const key of ['title','chapter','beat','summary']){if(typeof scene[key]!=='string'||scene[key].length>(key==='title'?160:10000))throw new Error('Check the key scene details.');clean[key]=scene[key].trim();}
  if(!clean.title)throw new Error('Give every key scene a title.');
  if(clean.beat&&!arcBeats.some(beat=>beat.id===clean.beat))throw new Error('Choose a valid narrative beat for every key scene.');
  return clean;
 });
 return document;
}
export async function storyArcRoute(request,env){
 const url=new URL(request.url),html=url.pathname.startsWith('/story-arcs/'),id=url.pathname.split('/')[html?2:3],owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Sign in to access your story arcs.'},401);
 if(!['GET','HEAD','POST','PUT'].includes(request.method)||html&&!['GET','HEAD'].includes(request.method)||!html&&request.method==='HEAD'||id&&request.method==='POST'||!id&&request.method==='PUT')return json({error:'Method not allowed.'},405);
 try{
  const db=repository(env.DB),arcs=(await db.listStoryArcs(owner)).map(normalize),current=id?arcs.find(arc=>arc.id===id):null;
  if(id&&!current)return json({error:'Story arc not found.'},404);
  if(request.method==='HEAD')return new Response(null,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(!html&&request.method==='GET')return json(id?current:{storyArcs:arcs});
  const [characters,factions,locations]=await Promise.all([db.list(owner),factionCatalog(db,owner),locationCatalog(db,owner)]),targets=entityTargets(characterCast(characters),factions,locations);
  if(html)return new Response(renderStoryArc(current,targets,arcs.filter(arc=>arc.id!==id)),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'This request could not be verified.'},403);
  const raw=await request.text();if(raw.length>550000)return json({error:'This story arc is too large to save.'},413);let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid story arc data.'},400);}if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Invalid story arc data.'},400);
  try{validateSchemaVersion(input);}catch(error){return json({error:error.message},400);}
  if(!id){
   if(!idPattern.test(input.id))return json({error:'Choose a valid story arc ID.'},400);
   const existing=arcs.find(arc=>arc.id===input.id);if(existing)return json(existing,201);
   let document;try{document=validate(input,{...blankStoryArc(),id:input.id},targets,arcs,!Object.hasOwn(input,'name'));}catch(error){return json({error:error.message},400);}
   const created=await db.createStoryArc(owner,input.id,document);return created?json(normalize(created),201):json({error:'This story arc could not be created.'},409);
  }
  if(Object.hasOwn(input,'id')&&input.id!==id)return json({error:'A story arc’s ID cannot change.'},400);
  if(!Number.isSafeInteger(input.version)||input.version>=Number.MAX_SAFE_INTEGER||input.version<1)return json({error:'Reload this story arc before saving.'},400);if(input.version!==current.version)return json({error:'This story arc changed in another tab. Copy your unsaved text, then reload before saving.'},409);
  let document;try{document=validate(input,current,targets,arcs);}catch(error){return json({error:error.message},400);}const saved=await db.saveStoryArc(owner,id,input.version,document);return saved?json(normalize(saved)):json({error:'This story arc changed in another tab. Reload before saving.'},409);
 }catch(error){console.error('Story arc request failed',error.message);return json({error:'Your story arcs could not be loaded or saved. Please try again.'},503);}
}
