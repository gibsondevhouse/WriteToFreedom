import {attributeGroups} from './attributes.js?v=__WTF_ASSET_REVISION__';
import {createRatingControls} from '../profiles/ratings-controls.js?v=__WTF_ASSET_REVISION__';

// Mutates the supplied ratings draft; an empty numeric input leaves an attribute unrated.
/** Render controls that mutate the supplied ratings draft; caller owns saving and dirty state. */
export function createAttributeControls(draft,markDirty,selectedGroups=attributeGroups){
 return createRatingControls(draft,markDirty,selectedGroups,{profile:false,idPrefix:'rating-'});
}
