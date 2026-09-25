import {blankCity} from '../public/locations/cities/template.js';
export function defaultCity(location){const record={...blankCity(),...(location.id==='sample-capital'?{
 introduction:'The Capital is the seat of the Fractured Kingdom, a city where royal treaties, restless invention, and buried history meet.',
 summary:'A capital built over the remains of an older city, with the Royal Archive at the center of a growing political crisis.',
 history:'An older city lies beneath the capital. Its surviving foundations hold evidence that could challenge the kingdom’s founding story.',
 presentDay:'The disappearance of a sealed accord from the Royal Archive has drawn attention to the city’s institutions and the secrets beneath them.',
 architecture:'The present city stands above abandoned chambers and the ruins of earlier settlements.',
 economy:'The river workshops are a center of invention. The Lantern Guild hopes to reconnect the kingdom’s isolated cities.',
 questions:'How did the older city fall?\nWho holds authority over the districts?'
 }:{}),id:location.id,name:location.name,parentId:location.parentId,version:0};return {...record,profileRatings:{...(record.profileRatings||{})}};}
