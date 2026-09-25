import {countryFields,countryImageFields,validImageUrl} from './template.js?v=worlds-1';
import {initProfileEditor} from '../../profiles/editor.js?v=profile-reading-1';
import {ratingGroupsFor} from '../../profiles/ratings.js?v=__WTF_ASSET_REVISION__';
import {initProfileRatings} from '../../profiles/ratings-controls.js?v=__WTF_ASSET_REVISION__';
const record=JSON.parse(document.querySelector('#profile-data').textContent),readRatings=initProfileRatings(record,ratingGroupsFor('location','country'));
initProfileEditor({fieldNames:countryFields,endpoint:'/api/countries',type:'country',imageFields:countryImageFields,validImageUrl,readExtra:readRatings});
