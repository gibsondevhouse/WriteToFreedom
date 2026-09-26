import {repository} from './db.js';
import {writingRepository} from './writing-repository.js';
import {characterCast} from './sample-characters.js';
import {factionCatalog} from './factions.js';
import {locationCatalog} from './countries.js';
import {locationHref,ancestors,typeLabels} from '../public/locations/data.js';
import {loreTypes} from '../public/lore/template.js';

// Collections deliberately have their own typed reference contract. Existing
// note/link consumers keep their established allowlists and serializers.
export const libraryKinds=['character','faction','location','lore','story_arc','note','novel','series','chapter','scene'];
export const libraryKey=ref=>[ref.kind,ref.characterId||'',ref.id].join(':');
export function cleanLibraryReference(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!libraryKinds.includes(input.kind)||typeof input.id!=='string'||!input.id||input.id.length>160)throw new Error('Choose an existing library entry.');
 if(input.kind==='note'){
  if(typeof input.characterId!=='string'||!input.characterId||input.characterId.length>160)throw new Error('A character note needs its parent character.');
  return {kind:input.kind,id:input.id,characterId:input.characterId};
 }
 return {kind:input.kind,id:input.id};
}

/** Resolve current labels from canonical owner-scoped records, never copies. */
export async function libraryEntries(binding,owner){
 const db=repository(binding),writing=writingRepository(binding);
 const [saved,factions,locations,lore,arcs,novels,series,chapters,scenes]=await Promise.all([db.list(owner),factionCatalog(db,owner),locationCatalog(db,owner),db.listLore(owner),db.listStoryArcs(owner),db.listNovels(owner),db.listSeries(owner),writing.listChapters(owner),writing.listScenes(owner)]);
 const cast=characterCast(saved),chapterMap=new Map(chapters.map(item=>[item.id,item]));
 const card=(kind,item,href,label,extra={})=>({kind,id:item.id,name:item.name||item.title||'Untitled '+label.toLowerCase(),label,href,summary:item.summary||item.synopsis||'',image:item.portraitUrl||item.coverUrl||item.imageUrl||item.skylineUrl||item.flagUrl||'',...extra});
 return [
  ...cast.map(item=>card('character',item,'/characters/'+encodeURIComponent(item.id)+'/','Character')),
  ...factions.map(item=>card('faction',item,'/factions/'+encodeURIComponent(item.id)+'/','Faction')),
  ...locations.map(item=>card('location',item,locationHref(item),typeLabels[item.type]||'Location',{type:item.type,parent:ancestors(item,locations).map(parent=>parent.name).join(' / ')})),
  ...lore.map(item=>card('lore',item,'/lore/'+encodeURIComponent(item.id)+'/','Lore '+(loreTypes[item.type]||'entry').toLowerCase(),{type:item.type})),
  ...arcs.map(item=>card('story_arc',item,'/story-arcs/'+encodeURIComponent(item.id)+'/','Story arc')),
  ...cast.flatMap(character=>(character.notes||[]).map(note=>({kind:'note',id:note.id,characterId:character.id,name:note.title||'Note on '+character.name,label:'Character note',href:'/characters/'+encodeURIComponent(character.id)+'/#note-'+encodeURIComponent(note.id),summary:note.text||'',image:'',parent:character.name}))),
  ...novels.map(item=>card('novel',item,'/novels/'+encodeURIComponent(item.id)+'/','Novel',{seriesId:item.seriesId||'',status:item.status})),
  ...series.map(item=>card('series',item,'/series/'+encodeURIComponent(item.id)+'/','Series')),
  ...chapters.map(item=>card('chapter',item,'/scenes/?'+new URLSearchParams({novel:item.novelId||'',chapter:item.id}),'Chapter',{novelId:item.novelId})),
  ...scenes.map(item=>card('scene',item,'/scenes/?'+new URLSearchParams({novel:chapterMap.get(item.chapterId)?.novelId||'',chapter:item.chapterId,scene:item.id}),'Scene',{novelId:chapterMap.get(item.chapterId)?.novelId}))
 ];
}
