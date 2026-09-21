export {validImageUrl} from '../countries/template.js';
export const citySections=[
 {id:'identity',title:'City information',fields:[['name','Name','input'],['officialName','Official name','input'],['parentId','Country','country'],['region','State / province / region','input'],['nickname','Nicknames','input'],['motto','Motto','input'],['settled','Settled','input'],['incorporated','Incorporated / chartered','input'],['founder','Founder','input'],['governmentType','Government','input'],['governingBody','Governing body','input'],['leaderId','Mayor / city leader','character'],['area','Area','input'],['elevation','Elevation','input'],['population','Population','input'],['populationDate','Population as of','input'],['demonym','Demonym','input'],['officialLanguages','Languages','input'],['timeZone','Time zone / calendar','input']]},
 {id:'symbols',title:'City images & map',fields:[['skylineUrl','City view image URL','url'],['flagUrl','Flag image URL','url'],['sealUrl','Seal image URL','url'],['mapUrl','Map image URL','url']]},
 {id:'overview',title:'Overview',fields:[['introduction','Introduction','textarea'],['summary','Short description','textarea']]},
 {id:'etymology',title:'Etymology',fields:[['etymology','Names & their origins','textarea']]},
 {id:'history',title:'History',fields:[['earlyHistory','Early settlement','textarea'],['founding','Founding & growth','textarea'],['history','Major events & eras','textarea'],['presentDay','Present circumstances','textarea']]},
 {id:'geography',title:'Geography',fields:[['geography','Setting & boundaries','textarea'],['climate','Climate','textarea'],['environment','Parks, waterways & environment','textarea']]},
 {id:'neighborhoods',title:'Boroughs & neighborhoods',fields:[['districts','Boroughs, districts & neighborhoods','textarea'],['architecture','Architecture & cityscape','textarea']]},
 {id:'government',title:'Government & politics',fields:[['government','Government & administration','textarea'],['politics','Factions & local politics','textarea'],['law','Law, crime & public safety','textarea']]},
 {id:'economy',title:'Economy',fields:[['economy','Industries, markets & trade','textarea'],['tourism','Tourism & visitors','textarea']]},
 {id:'demographics',title:'Demographics',fields:[['demographics','Peoples & communities','textarea'],['languages','Languages & dialects','textarea'],['religion','Religion & beliefs','textarea']]},
 {id:'culture',title:'Culture & daily life',fields:[['culture','Customs & city identity','textarea'],['arts','Arts, literature & entertainment','textarea'],['food','Food & daily life','textarea'],['festivals','Festivals, sports & recreation','textarea']]},
 {id:'infrastructure',title:'Infrastructure',fields:[['transport','Streets, transit & connections','textarea'],['utilities','Water, energy & communications','textarea'],['education','Education & libraries','textarea'],['health','Health & living conditions','textarea'],['technology','Science, technology & magic','textarea']]},
 {id:'places',title:'Areas & landmarks',fields:[]},
 {id:'notes',title:'Open questions',fields:[['questions','Unresolved questions','textarea']]}
];
export const cityFields=citySections.flatMap(s=>s.fields.map(f=>f[0]));
export const cityImageFields=['skylineUrl','flagUrl','sealUrl','mapUrl'];
export const blankCity=()=>Object.fromEntries(cityFields.map(k=>[k,'']));
