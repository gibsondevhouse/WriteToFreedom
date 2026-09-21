import {escape,createFieldRenderer,renderSection,renderInfoGroup,renderProfileName,renderProfilePage} from './profile-components.js';
import { factionSections, factionTypes, factionStatuses } from '../public/factions/template.js';
export function renderFaction(faction,cast){
 const initials=escape((faction.name||'?').replace(/^The /,'').split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase());
 const field=createFieldRenderer(faction,{options:(key,type)=>type==='character'?cast.map(c=>[c.id,c.name||'Untitled character']):type==='select'?(key==='type'?factionTypes:factionStatuses).map(v=>[v,v]):null,links:{founderId:'/characters/',leaderId:'/characters/'}});
 const members=cast.filter(c=>c.factionId===faction.id);
 const roster=members.length?`<ul class="member-list">${members.map(c=>`<li><a href="/characters/${escape(c.id)}/">${escape(c.name||'Untitled character')}</a><span>${escape(c.roles||c.title||'')}</span></li>`).join('')}</ul>`:'<p class="section-note">No characters are affiliated yet.</p>';
 const body=factionSections.filter(s=>!['identity','symbols'].includes(s.id)).map(s=>renderSection(s,
 (s.id==='members'?roster+'<p class="section-note">Choose this faction on a character’s profile to add them here.</p>':'')+s.fields.map(field).join(''),faction,{fullWidth:s.id==='ideology'})).join('');
 const fields=(keys)=>keys.map(key=>field(factionSections[0].fields.find(f=>f[0]===key))).join('');
 const infobox=renderProfileName(faction,'faction')+`<div class="epithet-field">${fields(['motto'])}</div><div class="identity-panel blue"><span id="monogram" class="monogram">${initials}</span></div>`+
  renderInfoGroup('Faction information','identity-information',fields(['name','type','status','founded']))+
  renderInfoGroup('Leadership','identity-leadership',fields(['founderId','leaderId']))+
  renderInfoGroup('Location & headquarters','identity-location',fields(['location','headquarters']))+
  `<a class="member-count" href="#members">${members.length} affiliated ${members.length===1?'character':'characters'}</a>`;
 return renderProfilePage({record:faction,type:'faction',collection:'Factions',collectionUrl:'/factions/',infobox,content:body,script:'/factions/profile.js',styles:['/factions/profile.css']});
}
