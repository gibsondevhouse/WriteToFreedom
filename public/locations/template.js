import {hiddenFieldNames} from '../profiles/schema.js';
import {typeLabels,parentTypes} from './data.js';
export {validImageUrl} from './countries/template.js';

const input=(key,label)=>[key,label,'input'];
const date=(key,label)=>[key,label,'date'];
const prose=(key,label)=>[key,label,'textarea'];
const section=(id,title,fields)=>({id,title,fields});
const formation=[date('formed','Formation date'),date('discovered','Discovery date')];
const population=[input('population','Population'),date('populationDate','Population as of')];
const classification=input('classification','Classification');
const dimensions=[input('diameter','Diameter'),input('mass','Mass'),input('gravity','Gravity')];
const formationEvents=[['formed','formation','Formed'],['discovered','discovery','Discovered']];
const populationEvents=[['populationDate','population','Population recorded']];

// One declarative definition per type; rendering, validation and timeline use it.
const definitions={
 universe:{facts:[classification,input('scale','Scale'),input('age','Age'),date('formed','Formation date')],dates:formationEvents.slice(0,1),sections:[
  section('cosmology','Cosmology & origins',[prose('cosmology','Cosmology'),prose('origins','Origins'),prose('physicalLaws','Physical laws'),prose('metaphysics','Magic & metaphysics'),prose('dimensions','Dimensions')]),
  section('inhabitants','Life & powers',[prose('inhabitants','Inhabitants'),prose('majorPowers','Major powers')]),
  section('travel','Travel & threats',[prose('travel','Travel between worlds'),prose('threats','Existential threats')])]},
 galaxy:{facts:[classification,input('diameter','Diameter'),input('age','Age'),...formation],dates:formationEvents,sections:[
  section('structure','Galactic structure',[prose('structure','Structure'),prose('core','Core'),prose('regions','Regions'),prose('stellarPopulations','Stellar populations')]),
  section('civilizations','Civilizations & resources',[prose('civilizations','Civilizations'),prose('resources','Resources')]),
  section('travel','Travel & phenomena',[prose('travel','Travel routes'),prose('anomalies','Anomalies'),prose('hazards','Hazards')])]},
 'solar-system':{facts:[classification,input('centralStars','Central stars'),input('extent','Extent'),input('age','Age'),...formation],dates:formationEvents,sections:[
  section('structure','System structure',[prose('orbits','Orbital arrangement'),prose('habitableZones','Habitable zones'),prose('celestialBodies','Celestial bodies')]),
  section('settlements','Settlements & powers',[prose('settlements','Settlements'),prose('controllingPowers','Controlling powers'),prose('resources','Resources')]),
  section('travel','Travel & hazards',[prose('travel','Travel routes'),prose('hazards','Hazards')])]},
 planet:{facts:[classification,...dimensions,input('dayLength','Day length'),input('yearLength','Year length'),...population,...formation],dates:[...formationEvents,...populationEvents],sections:[
  section('environment','Planetary environment',[prose('orbit','Orbit'),prose('atmosphere','Atmosphere'),prose('climate','Climate'),prose('geology','Geology'),prose('oceans','Oceans'),prose('ecosystems','Ecosystems')]),
  section('civilizations','Peoples & governments',[prose('peoples','Peoples'),prose('governments','Governments'),prose('resources','Resources')]),
  section('travel','Travel & hazards',[prose('travel','Travel'),prose('hazards','Hazards')])]},
 moon:{facts:[classification,...dimensions,input('orbitalPeriod','Orbital period'),input('rotationPeriod','Rotation period'),...population,...formation],dates:[...formationEvents,...populationEvents],sections:[
  section('environment','Lunar environment',[prose('orbit','Orbit & tides'),prose('atmosphere','Atmosphere'),prose('climate','Climate'),prose('geology','Geology'),prose('ecosystems','Ecosystems')]),
  section('settlements','Settlements & resources',[prose('settlements','Settlements'),prose('resources','Resources')]),
  section('travel','Access & hazards',[prose('access','Access'),prose('hazards','Hazards')])]},
 continent:{facts:[input('area','Area'),...population,input('demonym','Demonym'),input('languages','Languages')],dates:populationEvents,sections:[
  section('geography','Geography & environment',[prose('boundaries','Boundaries'),prose('terrain','Terrain'),prose('climate','Climate'),prose('waterways','Waterways'),prose('ecosystems','Ecosystems')]),
  section('society','Peoples & cultures',[prose('peoples','Peoples'),prose('cultures','Cultures'),prose('politicalRegions','Political regions')]),
  section('economy','Economy & connections',[prose('economy','Economy'),prose('transport','Transport'),prose('conflicts','Conflicts')])]},
 area:{facts:[['areaType','Area type','area-type'],input('area','Area'),...population,date('founded','Founding date'),['leaderId','Leader','character']],dates:[['founded','founded','Founded'],...populationEvents],sections:[
  section('geography','Setting & neighborhoods',[prose('boundaries','Boundaries'),prose('neighborhoods','Neighborhoods'),prose('architecture','Architecture')]),
  section('society','Community & daily life',[prose('community','Community'),prose('government','Government'),prose('economy','Economy'),prose('culture','Culture')]),
  section('infrastructure','Services & safety',[prose('services','Services'),prose('transport','Transport'),prose('safety','Safety')])]},
 landmark:{facts:[classification,input('status','Status'),date('founded','Construction / founding date'),date('abandoned','Abandonment date'),date('restored','Restoration date'),input('founder','Founder / architect'),input('custodian','Owner / custodian'),input('dimensions','Dimensions')],dates:[['founded','founded','Built / founded'],['abandoned','abandonment','Abandoned'],['restored','restoration','Restored']],sections:[
  section('setting','Setting & design',[prose('setting','Setting'),prose('architecture','Architecture'),prose('purpose','Purpose'),prose('access','Access')]),
  section('significance','Culture & legends',[prose('culturalSignificance','Cultural significance'),prose('legends','Legends'),prose('events','Events')]),
  section('condition','Condition & hazards',[prose('condition','Condition'),prose('hazards','Hazards')])]}
};

export const locationTemplates=Object.fromEntries(Object.entries(definitions).map(([type,definition])=>{
 const identity=[input('name','Name'),input('officialName','Official name'),input('alternateNames','Alternate names'),...(parentTypes[type].length?[['parentId','Belongs to','location']]:[])];
 const sections=[section('identity',typeLabels[type]+' information',[...identity,...definition.facts]),
  section('symbols','Images & map',[['imageUrl','Image URL','url'],['mapUrl','Map image URL','url']]),
  section('overview','Overview',[prose('introduction','Introduction'),prose('summary','Short description')]),
  section('etymology','Etymology',[prose('etymology','Names & their origins')]),
  section('history','History',[prose('history','History'),prose('presentDay','Present circumstances')]),
  ...definition.sections,
  section('story','Story significance',[prose('storySignificance','Story significance')]),
  section('places','Locations within',[]),section('notes','Open questions',[prose('questions','Unresolved questions')])];
 return [type,{sections,fields:sections.flatMap(s=>s.fields.map(f=>f[0])),hideableFields:hiddenFieldNames(sections),imageFields:['imageUrl','mapUrl'],dates:definition.dates,
  infoGroups:[{id:'identity-information',title:typeLabels[type]+' information',fields:identity},{id:'identity-details',title:'Details',fields:definition.facts}]}];
}));

export function defaultLocation(location){
 const template=locationTemplates[location.type];
 return {...Object.fromEntries(template.fields.map(key=>[key,''])),hiddenFields:[],version:0,schemaVersion:1,...location,profileRatings:{...(location.profileRatings||{})},parentId:location.parentId||''};
}
export function locationProfileGroups(locations){
 return Object.fromEntries(Object.keys(locationTemplates).map(type=>[type,locations.filter(l=>l.type===type).map(defaultLocation)]));
}
