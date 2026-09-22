import {hiddenFieldNames} from '../profiles/schema.js';
export const factionTypes=['Family','House','Guild','Alliance','Order','Government','Military','Religion','Secret society','Organization','Other'];
export const factionStatuses=['Active','Emerging','Disbanded','Destroyed','In hiding','Unknown'];
export const factionSections=[
 {id:'identity',title:'Faction information',fields:[['name','Name','input'],['motto','Motto / epithet','input'],['imageUrl','House / alliance image URL','url'],['type','Type','select'],['status','Status','select'],['founded','Founded','date'],['founderId','Founder','character'],['leaderId','Leader','character'],['location','Location','input'],['headquarters','Headquarters','input']]},
 {id:'overview',title:'Overview',fields:[['introduction','Introduction','textarea'],['summary','Short description','textarea']]},
 {id:'history',title:'History',fields:[['origins','Origins','textarea'],['history','Major events','textarea'],['presentDay','Present circumstances','textarea']]},
 {id:'ideology',title:'Ideology & purpose',fields:[['purpose','Purpose & goals','textarea'],['ideology','Beliefs & values','textarea']]},
 {id:'organization',title:'Organization',fields:[['hierarchy','Hierarchy & ranks','textarea'],['recruitment','Membership & recruitment','textarea']]},
 {id:'members',title:'Notable members',fields:[['keyPeople','Key people & their influence','textarea']]},
 {id:'powers',title:'Powers & resources',fields:[['powers','Powers & methods','textarea'],['resources','Resources & influence','textarea']]},
 {id:'culture',title:'Symbols & traditions',fields:[['symbols','Symbols & appearance','textarea'],['traditions','Traditions & customs','textarea']]},
 {id:'relations',title:'Alliances & rivalries',fields:[['allies','Allies','textarea'],['enemies','Enemies & rivalries','textarea']]},
 {id:'notes',title:'Open questions',fields:[['questions','Unresolved questions','textarea']]}
];
export const factionFields=factionSections.flatMap(s=>s.fields.map(f=>f[0]));
export const blankFaction=()=>({...Object.fromEntries(factionFields.map(k=>[k,''])),hiddenFields:[]});
export const factionHideableFields=hiddenFieldNames(factionSections);
