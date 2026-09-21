import {seedLocations} from '../public/locations/data.js';
import {blankCountry} from '../public/locations/countries/template.js';
export async function locationCatalog(db,owner){const [locations,profiles]=await Promise.all([db.listLocations(owner),db.listCountryProfiles(owner)]);const overrides=new Map(profiles.map(p=>[p.id,p.name]));return [...seedLocations,...locations].map(r=>({...r,name:overrides.get(r.id)??r.name}));}
export function defaultCountry(location){return {...blankCountry(),...(location.id==='sample-kingdom'?{
 capitalId:'sample-capital',governmentType:'Kingdom',
 introduction:'The Fractured Kingdom is a realm of rival houses whose uneasy peace depends on old treaties. Its capital holds the Royal Archive, the river workshops, and the remains of an older city beneath its foundations.',
 summary:'A divided kingdom held together by promises, threatened by the disappearance of a royal accord.',
 history:'The kingdom’s accepted founding account is being challenged by discoveries in the ruins beneath its capital.',
 presentDay:'A sealed treaty has vanished. Archivists, inventors, scholars, and explorers are drawn into a dispute that could change the relationships between the houses.',
 government:'The houses maintain their agreements through negotiation and the work of mediators. The House of Ember preserves the treaties that define their obligations.',
 infrastructure:'Travel between isolated cities remains difficult. The Lantern Guild is developing a transport network that could reconnect them.',
 questions:'What first united the houses?\nWhich parts of the founding history have been concealed?'
 }:{}),name:location.name,id:location.id,version:0};}
