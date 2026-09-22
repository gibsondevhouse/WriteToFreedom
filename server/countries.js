import {seedLocations} from '../public/locations/data.js';
import {blankCountry} from '../public/locations/countries/template.js';
export async function locationCatalog(db,owner){
 const [locations,countries,cities,details]=await Promise.all([db.listLocations(owner),db.listCountryProfiles(owner),db.listCityProfiles(owner),db.listLocationDetails(owner)]);
 const countryProfiles=new Map(countries.map(p=>[p.id,p])),cityProfiles=new Map(cities.map(p=>[p.id,p]));
 const locationDetails=new Map(details.map(p=>[p.id,p]));
 return [...seedLocations,...locations].map(r=>{if(!['country','city'].includes(r.type)){const detail=locationDetails.get(r.id);return {...r,version:0,...detail};}const profile=cityProfiles.get(r.id);return r.type==='city'&&profile?{...r,name:profile.name,parentId:profile.parentId}:{...r,name:countryProfiles.get(r.id)?.name??r.name,parentId:countryProfiles.get(r.id)?.parentId??r.parentId};});
}
export function defaultCountry(location){return {...blankCountry(),...(location.id==='sample-kingdom'?{
 capitalId:'sample-capital',governmentType:'Kingdom',
 introduction:'The Fractured Kingdom is a realm of rival houses whose uneasy peace depends on old treaties. Its capital holds the Royal Archive, the river workshops, and the remains of an older city beneath its foundations.',
 summary:'A divided kingdom held together by promises, threatened by the disappearance of a royal accord.',
 history:'The kingdom’s accepted founding account is being challenged by discoveries in the ruins beneath its capital.',
 presentDay:'A sealed treaty has vanished. Archivists, inventors, scholars, and explorers are drawn into a dispute that could change the relationships between the houses.',
 government:'The houses maintain their agreements through negotiation and the work of mediators. The House of Ember preserves the treaties that define their obligations.',
 infrastructure:'Travel between isolated cities remains difficult. The Lantern Guild is developing a transport network that could reconnect them.',
 questions:'What first united the houses?\nWhich parts of the founding history have been concealed?'
 }:{}),name:location.name,parentId:location.parentId||'',id:location.id,version:0};}
