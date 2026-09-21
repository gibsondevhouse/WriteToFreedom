import { characters } from '../public/characters/data.js';
import { profiles } from '../public/characters/profile-data.js';
import { blankCharacter } from '../public/characters/template.js';
import { seedFactions } from '../public/characters/factions.js';
export function sampleCharacter(id) {
 const seed=characters.find(c=>c.id===id);if(!seed)return null;
 const profile=profiles[id];
 return {...blankCharacter(),...profile,id,version:0,name:seed.name,firstName:seed.name,title:seed.title,roles:seed.roles.join(' · '),affiliation:seed.affiliation,factionId:seedFactions.find(f=>f.name===seed.affiliation)?.id||'',storyRole:seed.attributes['Story role'],summary:seed.summary,biography:seed.biography,strength:seed.attributes.Strength,flaw:seed.attributes.Flaw,desire:seed.attributes.Desire,fear:seed.attributes.Fear,tendencies:seed.tendencies.join('\n'),questions:profile.questions.join('\n'),relationships:seed.relationships.map(r=>({targetId:r.id,type:r.type,description:r.text}))};
}
export function characterCast(saved) { const map=new Map(saved.map(c=>[c.id,c]));return [...characters.map(c=>map.get(c.id)||sampleCharacter(c.id)),...saved.filter(c=>!characters.some(seed=>seed.id===c.id))]; }
