import {factionSections,factionHideableFields} from '../public/factions/template.js';
import {countrySections,countryHideableFields} from '../public/locations/countries/template.js';
import {citySections,cityHideableFields} from '../public/locations/cities/template.js';
import {locationTemplates} from '../public/locations/template.js';
import {locationHref} from '../public/locations/data.js';
import {ratingGroupsFor} from '../public/profiles/ratings.js';

// Drive the persistence matrix from the same templates that declare the UI.
// A newly added field therefore has to render, save, and reopen in these tests.
export const worldProfileCases=[
 {type:'faction',sections:factionSections,hideableFields:factionHideableFields,table:'faction_profiles',identityColumn:'faction_id'},
 {type:'country',sections:countrySections,hideableFields:countryHideableFields,table:'country_profiles',identityColumn:'location_id'},
 {type:'city',sections:citySections,hideableFields:cityHideableFields,table:'city_profiles',identityColumn:'location_id'},
 ...Object.entries(locationTemplates).map(([type,template])=>({type,sections:template.sections,hideableFields:template.hideableFields,table:'location_details',identityColumn:'location_id'}))
].map(profile=>({...profile,fields:profile.sections.flatMap(section=>section.fields),ratings:ratingGroupsFor(profile.type==='faction'?'faction':'location',profile.type)}));

export function profileEndpoint(type,id){return (type==='faction'?'/api/factions/':type==='country'?'/api/countries/':type==='city'?'/api/cities/':'/api/locations/')+id;}
export function profilePage(type,id){return type==='faction'?'/factions/'+id+'/':locationHref({type,id});}

/** request(path,method,body) returns decoded JSON after checking success. */
export async function createWorldProfile(type,request){
 const createLocation=(type,parentId=null)=>request('/api/locations','POST',{id:crypto.randomUUID(),name:'Persistence '+type+' '+crypto.randomUUID(),type,parentId,...(type==='area'?{areaType:'District'}:{})});
 if(type==='faction'){
  const created=await request('/api/factions','POST',{id:crypto.randomUUID(),blank:true});
  return {record:await request(profileEndpoint(type,created.id),'GET'),references:{}};
 }
 const parentTypes={galaxy:'universe','solar-system':'galaxy',planet:'solar-system',moon:'planet',continent:'planet',country:'continent',city:'country'};
 const parent=parentTypes[type]?await createLocation(parentTypes[type]):null;
 const created=await createLocation(type,parent?.id||(['area','landmark'].includes(type)?'sample-capital':null));
 const references={};
 if(type==='country'){
  references.capitalId=(await createLocation('city',created.id)).id;
  references.largestCityId=(await createLocation('city',created.id)).id;
 }
 return {record:await request(profileEndpoint(type,created.id),'GET'),references};
}

export function populatedWorldProfile(profile,record,references={}){
 /** @type {Record<string, unknown>} */
 const result={};
 for(const [key,,control] of profile.fields){
  result[key]=key==='name'?'Written '+profile.type+' '+record.id
   :key==='parentId'?record.parentId
   :Object.hasOwn(references,key)?references[key]
   :control==='character'?'claude'
   :control==='select'?(key==='type'?'Secret society':'In hiding')
   :control==='area-type'?'Ward'
   :control==='url'?'https://example.invalid/'+profile.type+'/'+key+'.png?detail=one&size=two'
   :control==='date'?(key==='populationDate'?'c. 1200 BCE':key==='founded'?'After the silver eclipse':'1400-Q3')
   :key==='officialLanguages'?'French · River speech'
   :key==='governmentType'?'Council of seven houses'
   :control==='textarea'?`${profile.type}.${key}: first paragraph <archive> & testimony.\nSecond paragraph — preserved exactly.`
   :`${profile.type}.${key}: measured value <one> & “two”`;
 }
 result.hiddenFields=[...profile.hideableFields];
 result.profileRatings=Object.fromEntries(profile.ratings.flatMap(group=>group.fields).map(([key],index)=>[key,index%3===0?0:index%3===1?99:37]));
 return result;
}
