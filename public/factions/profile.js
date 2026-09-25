import {factionFields} from './template.js?v=character-cards-1';
import {initProfileEditor} from '../profiles/editor.js?v=profile-reading-1';
import {factionRatingGroups} from '../profiles/ratings.js?v=__WTF_ASSET_REVISION__';
import {initProfileRatings} from '../profiles/ratings-controls.js?v=__WTF_ASSET_REVISION__';
const record=JSON.parse(document.querySelector('#profile-data').textContent),readRatings=initProfileRatings(record,factionRatingGroups);
initProfileEditor({fieldNames:factionFields,endpoint:'/api/factions',type:'faction',readExtra:readRatings});
