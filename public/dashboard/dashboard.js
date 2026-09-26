import {factionCard,locationCard,loreEntryCard,eventCard,bookCoverCard} from './components.js?v=__WTF_ASSET_REVISION__';
import {createCharacterCard} from '../components/character-card/card.js?v=__WTF_ASSET_REVISION__';
import {updateWorkspace} from './workspace.js?v=__WTF_ASSET_REVISION__';
import {initDashboardShell} from './shell.js?v=__WTF_ASSET_REVISION__';

initDashboardShell({
 endpoint:'/api/dashboard',onData:updateWorkspace,
 render(data,view){
  view.questions(data.questions);
  view.rail({id:'novels',title:'My novels',records:data.novels||[],card:record=>bookCoverCard(record,{menuItems:[{label:'Open profile',href:record.href},{label:'Write scenes',href:'/scenes/?novel='+encodeURIComponent(record.id)}]}),href:'/novels/',emptyText:'Your novels will appear here.'});
  view.rail({id:'series',title:'Series',records:data.series||[],card:record=>bookCoverCard(record,{menuItems:[{label:'Open profile',href:record.href}]}),href:'/series/',emptyText:'Your series will appear here.',hideWhenEmpty:true});
  view.rail({id:'collections',title:'Collections',records:data.collections||[],card:record=>bookCoverCard(record,{menuItems:[{label:'Open collection',href:record.href}]}),href:'/collections/',emptyText:'Group saved material in manual or smart collections.',hideWhenEmpty:true});
  view.rail({id:'characters',title:'Characters',records:data.characters,card:createCharacterCard,href:'/characters/',emptyText:'Your characters will appear here.'});
  view.rail({id:'factions',title:'Factions',records:data.factions,card:factionCard,href:'/factions/',emptyText:'Your houses, families, and alliances will appear here.'});
  view.rail({id:'locations',title:'Locations',records:data.locations,card:locationCard,href:'/locations/',emptyText:'Your places will appear here.'});
  view.rail({id:'lore',title:'Lore',records:data.lore||[],card:loreEntryCard,href:'/lore/',emptyText:'Your notes, objects, and species will appear here.'});
  view.rail({id:'timeline',title:'Through time',records:[...data.timeline.events,...data.timeline.unplaced],card:eventCard,href:'/timeline/',emptyText:'No dates yet. Add birth dates, founding dates, or other dates to your profiles to populate your timeline.'});
 }
});
