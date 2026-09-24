import {factionCard,locationCard,loreEntryCard,eventCard} from './components.js?v=species-cards-1';
import {createCharacterCard} from '../components/character-card/card.js?v=2';
import {updateWorkspace} from './workspace.js?v=shared-1';
import {initDashboardShell} from './shell.js?v=shell-2';

initDashboardShell({
 endpoint:'/api/dashboard',onData:updateWorkspace,
 render(data,view){
  view.questions(data.questions);
  view.rail({id:'characters',title:'Characters',records:data.characters,card:createCharacterCard,href:'/characters/',emptyText:'Your characters will appear here.'});
  view.rail({id:'factions',title:'Factions',records:data.factions,card:factionCard,href:'/factions/',emptyText:'Your houses, families, and alliances will appear here.'});
  view.rail({id:'locations',title:'Locations',records:data.locations,card:locationCard,href:'/locations/',emptyText:'Your places will appear here.'});
  view.rail({id:'lore',title:'Lore',records:data.lore||[],card:loreEntryCard,href:'/lore/',emptyText:'Your notes, objects, and species will appear here.'});
  view.rail({id:'timeline',title:'Through time',records:[...data.timeline.events,...data.timeline.unplaced],card:eventCard,href:'/timeline/',emptyText:'No dates yet. Add birth dates, founding dates, or other dates to your profiles to populate your timeline.'});
 }
});
