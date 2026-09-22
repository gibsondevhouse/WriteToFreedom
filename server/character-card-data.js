import {templateSections} from '../public/characters/template.js';
import {factionSections} from '../public/factions/template.js';
import {countrySections} from '../public/locations/countries/template.js';
import {citySections} from '../public/locations/cities/template.js';
import {ancestors} from '../public/locations/data.js';

const schemas={character:templateSections,faction:factionSections,country:countrySections,city:citySections};
const paths={character:'/characters/',faction:'/factions/',country:'/locations/countries/',city:'/locations/cities/'};
const href=(kind,id)=>paths[kind]+encodeURIComponent(id)+'/';
function mentionsName(text,name) {
  if (!name?.trim()) return false;
  const escaped=name.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(^|[^\\p{L}\\p{N}_])'+escaped+'(?=$|[^\\p{L}\\p{N}_])','iu').test(text);
}
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
  const mentions=characterMentions(character,profiles);
  return {image:character.portraitUrl||'',alignment:character.alignment||'',attributeRatings:character.attributeRatings||{},affiliationCard:affiliation,relationships,mentions};
}

export function characterMentions(character,profiles,{includeOwn=true}={}){
  const mentions=[];
  if(includeOwn)for(const note of character.notes||[])mentions.push({source:character.name||'Untitled character',label:'Note',kind:'character',text:note.text,href:href('character',character.id)+'#note-'+note.id});
  for(const [kind,records] of Object.entries(profiles))for(const source of records){
    if(kind==='character'&&source.id===character.id)continue;
    for(const section of schemas[kind])for(const [key,label,type] of section.fields){
      if(type!=='textarea'||!source[key]?.trim()||!mentionsName(source[key],character.name))continue;
      mentions.push({source:source.name||'Untitled '+kind,label,kind,text:source[key],href:href(kind,source.id)+(source.hiddenFields?.includes(key)?'':'#field-'+key)});
    }
    if(kind==='character')for(const note of source.notes||[]){if(mentionsName(note.text,character.name))mentions.push({source:source.name||'Untitled character',label:'Note',kind,text:note.text,href:href(kind,source.id)+'#note-'+note.id});}
    if(kind==='character')for(const relationship of source.relationships||[]){
      if(relationship.description?.trim()&&(relationship.targetId===character.id||mentionsName(relationship.description,character.name)))mentions.push({source:source.name||'Untitled character',label:'Relationship notes',kind,text:relationship.description,href:href(kind,source.id)+(source.hiddenFields?.includes('relationships')?'':'#relationships')});
    }
  }
  return mentions;
}
