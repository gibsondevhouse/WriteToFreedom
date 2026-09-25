import {hiddenFieldNames} from '../profiles/schema.js?v=__WTF_ASSET_REVISION__';
export {validImageUrl} from '../locations/countries/template.js?v=__WTF_ASSET_REVISION__';

export const loreTypes={note:'Note',artifact:'Artifact',relic:'Relic',book:'Book',jewel:'Jewel',species:'Species'};
export const loreCollections={notes:'Notes',artifacts:'Artifacts',relics:'Relics',books:'Books',jewels:'Jewels',species:'Species'};
export const primaryCollection={note:'notes',artifact:'artifacts',relic:'relics',book:'books',jewel:'jewels',species:'species'};
export const objectCollections=['artifacts','relics','books','jewels'];
export const loreHref=record=>'/lore/'+encodeURIComponent(record.id)+'/';
const field=(key,label,type='textarea')=>[key,label,type];
const section=(id,title,fields)=>({id,title,fields});
const common=[
 section('identity','Entry information',[field('name','Name','input'),field('alternateNames','Alternate names','input'),field('tags','Tags','input')]),
 section('symbols','Image',[field('imageUrl','Image URL','url')]),
 section('overview','Overview',[field('introduction','Description'),field('summary','Short description')]),
 section('story','Story significance',[field('significance','Why it matters'),field('conflict','Desire, conflict & consequences')]),
 section('truth','Truth & belief',[field('truth','What is true'),field('beliefs','What people believe'),field('knowledge','Who knows the difference')]),
 section('history','History',[field('history','History & origins')])
];
const objectSections=[
 section('object','Object details',[field('appearance','Appearance & materials'),field('purpose','Purpose'),field('creator','Creator / maker'),field('provenance','Provenance & ownership'),field('condition','Condition & whereabouts')]),
 section('powers','Abilities & costs',[field('powers','Abilities & unusual properties'),field('limits','Limits & weaknesses'),field('costs','Costs & consequences')])
];
const extras={
 note:[section('notes','Notes & sources',[field('body','Notes'),field('sources','Sources & research')])],
 artifact:[],
 relic:[section('relic','Legacy & reverence',[field('legend','Legends'),field('sacredSignificance','Sacred significance'),field('authenticity','Authenticity & disputed origins')])],
 book:[section('book','Text & knowledge',[field('author','Author / compiler','input'),field('language','Language / script','input'),field('contents','Contents & excerpts'),field('editions','Editions & alterations'),field('reliability','Reliability & omissions')])],
 jewel:[section('jewel','Gem & setting',[field('material','Gem / material','input'),field('cut','Cut, color & size','input'),field('setting','Setting & craftsmanship'),field('value','Rarity & value')])],
 species:[section('biology','Biology & lifecycle',[field('physiology','Physiology & appearance'),field('lifecycle','Lifecycle & reproduction'),field('lifespan','Lifespan','input'),field('diet','Diet & sustenance'),field('habitat','Habitat & distribution')]),
  section('abilities','Abilities & behavior',[field('abilities','Abilities'),field('limits','Limits & vulnerabilities'),field('behavior','Behavior & communication')]),
  section('relationships','Relationships & societies',[field('speciesRelations','Relationships with other species'),field('cultures','Cultures & societies')])]
};
export const loreTemplates=Object.fromEntries(Object.keys(loreTypes).map(type=>{
 const sections=[...common,...(!['note','species'].includes(type)?objectSections:[]),...extras[type],
  section('dates','Story dates',[field('originDate',type==='species'?'First appearance':type==='book'?'Written / published':'Origin / creation','date')]),
  section('questions','Open questions',[field('questions','Unresolved questions')])];
 return [type,{sections,fields:sections.flatMap(s=>s.fields.map(f=>f[0])),hideableFields:hiddenFieldNames(sections)}];
}));
// Union by field rather than section: species adds its own limits field.
export const loreMentionSections=[{fields:[...new Map(Object.values(loreTemplates).flatMap(t=>t.sections.flatMap(s=>s.fields)).map(f=>[f[0],f])).values()]}];
export function blankLore(type){return {...Object.fromEntries(loreTemplates[type].fields.map(k=>[k,''])),type,collections:[primaryCollection[type]],connections:[],hiddenFields:[],profileRatings:{},pinned:false,featured:false};}
export function allowedCollections(type){return ['note','species'].includes(type)?[primaryCollection[type]]:objectCollections;}
