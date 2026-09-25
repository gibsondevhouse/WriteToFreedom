import {loreMentionSections,loreTypes,loreHref} from '../public/lore/template.js';
import {locationTemplates} from '../public/locations/template.js';
import {locationPaths} from '../public/locations/data.js';
import {noteTargets} from './note-connections.js';
import {referenceKey,cleanNoteReference} from '../public/characters/notes.js';
import {templateSections} from '../public/characters/template.js';
import {factionSections} from '../public/factions/template.js';
import {countrySections} from '../public/locations/countries/template.js';
import {citySections} from '../public/locations/cities/template.js';
import {ancestors} from '../public/locations/data.js';
import {storyArcSections} from '../public/story-arcs/template.js';

const schemas={lore:loreMentionSections,storyArc:storyArcSections,...Object.fromEntries(Object.entries(locationTemplates).map(([type,template])=>[type,template.sections])),character:templateSections,faction:factionSections,country:countrySections,city:citySections};
const paths={...locationPaths,lore:'/lore/',storyArc:'/story-arcs/',character:'/characters/',faction:'/factions/'};
const href=(kind,id)=>paths[kind]+encodeURIComponent(id)+'/';
function mentionsName(text,name) {
  if (!name?.trim()) return false;
  const escaped=name.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(^|[^\\p{L}\\p{N}_])'+escaped+'(?=$|[^\\p{L}\\p{N}_])','iu').test(text);
}
/**
 * Derive display-only card data from owner-scoped catalogs: automatic or featured
 * affiliation, incoming/outgoing relationships, artwork, ratings and mentions.
 * No DB/DOM effects. Enriched relationships replace the writable document shape;
 * consumers must fetch an ordinary character document before editing.
 */
export function characterCardDetails(character,{cast,factions,countries,locations,profiles}) {
  const faction=factions.find(f=>f.id===character.factionId);
  const residence=locations.find(l=>l.id===character.residenceId);
  const countryId=character.citizenshipId||(residence?.type==='country'?residence.id:residence&&ancestors(residence,locations).find(l=>l.type==='country')?.id);
  const country=countries.find(c=>c.id===countryId);
  const affiliation=faction?{name:faction.name||'Untitled faction',label:faction.type||'Faction',image:faction.imageUrl||'',href:href('faction',faction.id)}:country?{name:country.name,label:'Country',image:country.flagUrl||country.coatOfArmsUrl||'',href:href('country',country.id)}:{name:character.affiliation||'Independent',label:character.affiliation?'Affiliation':'No affiliation',image:'',href:null};
  const relationships=cast.filter(other=>other.id!==character.id).flatMap(other=>{
    const outgoing=(character.relationships||[]).filter(r=>r.targetId===other.id);
    const incoming=(other.relationships||[]).filter(r=>r.targetId===character.id);
    if(!outgoing.length&&!incoming.length)return [];
    return [{id:other.id,name:other.name||'Untitled character',image:other.portraitUrl||'',href:href('character',other.id),connections:[...outgoing.map(r=>({type:r.type||'Connection',description:r.description,direction:'outgoing'})),...incoming.map(r=>({type:r.type||'Connection',description:r.description,direction:'incoming'}))]}];
  });
  const featured=character.cardConnection&&cardConnectionOptions(character,{cast,factions,locations,countries,cities:profiles.city,lore:profiles.lore||[]}).find(option=>referenceKey(option.ref)===referenceKey(character.cardConnection));
  const mentions=characterMentions(character,profiles);
  return {image:character.portraitUrl||'',alignment:character.alignment||'',attributeRatings:character.attributeRatings||{},cardConnection:character.cardConnection||null,defaultAffiliationCard:affiliation,affiliationCard:featured||affiliation,relationships,mentions};
}

/** Collect own notes (optional), textual name mentions and explicit links with safe profile anchors. */
export function characterMentions(character,profiles,{includeOwn=true}={}){
  const mentions=[];
  if(includeOwn)for(const note of character.notes||[])mentions.push({source:character.name||'Untitled character',label:'Note',kind:'character',text:note.text,href:href('character',character.id)+'#note-'+note.id});
  for(const [kind,records] of Object.entries(profiles))for(const source of records){
    if(kind==='character'&&source.id===character.id)continue;
    for(const section of schemas[kind])for(const [key,label,type] of section.fields){
      if(type!=='textarea'||!source[key]?.trim()||!mentionsName(source[key],character.name))continue;
      mentions.push({source:source.name||'Untitled '+kind,label,kind,text:source[key],href:href(kind,source.id)+(source.hiddenFields?.includes(key)?'':'#field-'+key)});
    }
    if(kind==='lore')for(const connection of source.connections||[])if(connection.target.kind==='character'&&connection.target.id===character.id)mentions.push({source:source.name,label:connection.relationship,kind,text:source.summary||source.introduction||connection.relationship,href:loreHref(source)+'#connections'});
    if(kind==='character')for(const note of source.notes||[]){if(mentionsName(note.text,character.name)||(note.links||[]).some(l=>l.kind==='character'&&l.id===character.id))mentions.push({source:source.name||'Untitled character',label:note.title||'Note',kind,text:note.text,...(note.content?{content:note.content,links:note.links}:{}),href:href(kind,source.id)+'#note-'+note.id});}
    if(kind==='character')for(const relationship of source.relationships||[]){
      if(relationship.description?.trim()&&(relationship.targetId===character.id||mentionsName(relationship.description,character.name)))mentions.push({source:source.name||'Untitled character',label:'Relationship notes',kind,text:relationship.description,href:href(kind,source.id)+(source.hiddenFields?.includes('relationships')?'':'#relationships')});
    }
  }
  return mentions;
}

// A presentation choice, independent of the character's faction and relationships.
/** Build available featured-item references from the owner's catalogs; excludes the character itself. */
export function cardConnectionOptions(character,{cast,factions,locations,countries=[],cities=[],lore=[]}) {
 return noteTargets(cast,factions,locations,lore).filter(item=>!(item.kind==='character'&&item.id===character.id)).map(item=>{
  const source=item.kind==='character'?cast.find(c=>c.id===item.id):item.kind==='faction'?factions.find(f=>f.id===item.id):item.kind==='lore'?lore.find(r=>r.id===item.id):item.kind==='location'?[...countries,...cities, ...locations].find(l=>l.id===item.id):null;
  return {ref:cleanNoteReference(item),name:item.label,label:item.kind==='lore'?loreTypes[source.type]:item.kind==='character'?'Character':item.kind==='faction'?(source?.type||'Faction'):item.kind==='location'?(item.detail||'Place'):item.group==='Lore'?'Lore':'Note',group:item.group,image:source?.portraitUrl||source?.imageUrl||source?.flagUrl||source?.coatOfArmsUrl||source?.skylineUrl||'',href:item.href};
 });
}
