import {hiddenFieldNames} from '../../profiles/schema.js';
export const countrySections=[
 {id:'identity',title:'Country information',fields:[['name','Name','input'],['officialName','Official name','input'],['motto','Motto','input'],['anthem','Anthem','input'],['capitalId','Capital','city'],['largestCityId','Largest city','city'],['officialLanguages','Official languages','choice'],['demonym','Demonym','input'],['governmentType','Government','choice'],['leaderId','Head of state','character'],['legislature','Legislature','input'],['founded','Established','date'],['area','Area','input'],['population','Population','input'],['populationDate','Population as of','date'],['currency','Currency','input'],['timeZone','Time zone / calendar','input']]},
 {id:'symbols',title:'National symbols & map',fields:[['flagUrl','Flag image URL','url'],['coatOfArmsUrl','Coat of arms image URL','url'],['mapUrl','Map image URL','url']]},
 {id:'overview',title:'Overview',fields:[['introduction','Introduction','textarea'],['summary','Short description','textarea']]},
 {id:'etymology',title:'Etymology',fields:[['etymology','Names & their origins','textarea']]},
 {id:'history',title:'History',fields:[['earlyHistory','Early history','textarea'],['founding','Founding & unification','textarea'],['history','Major events & eras','textarea'],['presentDay','Present circumstances','textarea']]},
 {id:'geography',title:'Geography',fields:[['geography','Landscape & borders','textarea'],['climate','Climate','textarea'],['biodiversity','Wildlife & natural resources','textarea']]},
 {id:'government',title:'Government & politics',fields:[['government','Government & political system','textarea'],['divisions','Administrative divisions','textarea'],['law','Law & justice','textarea'],['foreignRelations','Foreign relations','textarea'],['military','Military & defense','textarea']]},
 {id:'economy',title:'Economy',fields:[['economy','Industries, trade & wealth','textarea'],['infrastructure','Infrastructure & transport','textarea'],['technology','Science, technology & magic','textarea']]},
 {id:'demographics',title:'Demographics',fields:[['demographics','Peoples & settlement','textarea'],['languages','Languages','textarea'],['religion','Religion & beliefs','textarea'],['education','Education','textarea'],['health','Health & living conditions','textarea']]},
 {id:'culture',title:'Culture',fields:[['culture','Customs & national identity','textarea'],['arts','Arts & literature','textarea'],['food','Food & daily life','textarea'],['festivals','Festivals & recreation','textarea']]},
 {id:'places',title:'Cities & landmarks',fields:[]},
 {id:'notes',title:'Open questions',fields:[['questions','Unresolved questions','textarea']]}
];
export const countryFields=countrySections.flatMap(s=>s.fields.map(f=>f[0]));
export const countryImageFields=['flagUrl','coatOfArmsUrl','mapUrl'];
export const blankCountry=()=>({...Object.fromEntries(countryFields.map(k=>[k,''])),hiddenFields:[]});
export const countryHideableFields=hiddenFieldNames(countrySections);
export function validImageUrl(value){if(!value)return true;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}
