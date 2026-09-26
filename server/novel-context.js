import {repository} from './db.js';
import {libraryEntries} from './library-targets.js';
const catalogs={'/api/characters':['characters','character'],'/api/factions':['factions','faction'],'/api/locations':['locations','location'],'/api/lore':['entries','lore'],'/api/story-arcs':['storyArcs','story_arc']};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kind=type=>type==='storyArc'?'story_arc':['character','faction','lore'].includes(type)?type:'location';
export async function validateNovelContext(request,env){
 const url=new URL(request.url),id=url.searchParams.get('novelId');
 if(!url.searchParams.has('novelId')||!catalogs[url.pathname]&&!['/api/dashboard','/api/timeline'].includes(url.pathname))return null;
 const owner=request.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'Sign in to access this novel.'},401);
 if(!uuid.test(id)||!await repository(env.DB).getNovel(owner,id))return json({error:'Novel not found.'},404);
 return null;
}
/** Scope visible catalogs, while canonical profiles and reference pickers stay global. */
export async function applyNovelContext(request,env,response){
 const url=new URL(request.url),novelId=url.searchParams.get('novelId'),owner=request.headers.get('oai-authenticated-user-id');
 if(!novelId||!owner||!response.ok||!response.headers.get('content-type')?.includes('application/json'))return response;
 const selection=catalogs[url.pathname];
 if(!selection&&!['/api/dashboard','/api/timeline'].includes(url.pathname))return response;
 const db=repository(env.DB),novel=await db.getNovel(owner,novelId);if(!novel)return json({error:'Novel not found.'},404);
 const body=await response.json();
 if(request.method==='POST'&&selection&&response.status===201){
  // Source creation has already committed in its domain route. If linking fails,
  // the worker returns 503; retrying the same source ID repairs the association
  // without replacing the source document. Invalid selectors were rejected first.
  const association=await db.createNovelAssociation(owner,crypto.randomUUID(),novelId,selection[1],body.id,['lore','story_arc'].includes(selection[1])?'referenced_by':'appears_in','');
  if(!association)throw new Error('The new article could not be linked to this novel. Retry with the same article ID.');
  return json(body,response.status);
 }
 if(request.method!=='GET')return json(body,response.status);
 const associations=await db.listNovelAssociations(owner,novelId),keys=new Set(associations.map(item=>item.targetKind+':'+item.targetId));
 const contextual=item=>{if(typeof item.href!=='string')return item;const href=new URL(item.href,url);href.searchParams.set('novel',novelId);return {...item,href:href.origin===url.origin?href.pathname+href.search+href.hash:href.href};};
 const selected=(records,targetKind)=>records.filter(item=>keys.has(targetKind+':'+item.id)).map(contextual);
 const scope={novelId,title:novel.title,label:'Linked material',note:'Dates describe shared articles. A novel link does not assert when an event occurs in this manuscript.'};
 if(selection){
  if(url.pathname==='/api/locations')body.contextLocations=(body.locations||[]).map(({id,name,type,parentId})=>({id,name,type,parentId}));
  body[selection[0]]=selected(body[selection[0]]||[],selection[1]);if(url.pathname==='/api/lore'){body.questions=selected(body.questions||[],'lore');const characters=new Set(associations.filter(item=>item.targetKind==='character').map(item=>item.targetId));body.notes=(body.notes||[]).filter(note=>{const match=note.href.match(/^\/characters\/([^/]+)\//);return match&&characters.has(decodeURIComponent(match[1]));}).map(contextual);}
 }
 const scopedTimeline=async timeline=>{
  const linkedEntries=(await libraryEntries(env.DB,owner)).filter(entry=>keys.has(entry.kind+':'+entry.id)),counts={};
  for(const entry of linkedEntries){const type=entry.kind==='location'?entry.type:entry.kind==='story_arc'?'storyArc':entry.kind;counts[type]=(counts[type]||0)+1;}
  const filter=event=>{const colon=event.entityId.indexOf(':');return keys.has(kind(event.entityId.slice(0,colon))+':'+event.entityId.slice(colon+1));};
  const events=timeline.events.filter(filter).map(contextual),unplaced=timeline.unplaced.filter(filter).map(contextual),dated=new Set([...events,...unplaced].map(event=>event.entityId));
  return {...timeline,events,unplaced,counts,undated:Math.max(0,linkedEntries.length-dated.size),scope};
 };
 if(url.pathname==='/api/dashboard'){
  for(const [key,targetKind] of [['characters','character'],['factions','faction'],['locations','location'],['lore','lore'],['storyArcs','story_arc']])body[key]=selected(body[key]||[],targetKind);
  body.questions=(body.questions||[]).filter(item=>keys.has(kind(item.kind)+':'+item.id)).map(contextual);body.novels=(body.novels||[]).filter(item=>item.id===novelId);body.series=(body.series||[]).filter(item=>item.id===novel.seriesId);body.timeline=await scopedTimeline(body.timeline);
 }
 if(url.pathname==='/api/timeline')return json(await scopedTimeline(body));
 body.scope=scope;return json(body,response.status);
}
