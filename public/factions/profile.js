import {factionFields} from './template.js?v=profile-dates-1';
import {initProfileEditor} from '../profiles/editor.js?v=profile-dates-1';
initProfileEditor({fieldNames:factionFields,endpoint:'/api/factions',type:'faction'});
