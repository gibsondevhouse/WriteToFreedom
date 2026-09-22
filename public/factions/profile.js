import {factionFields} from './template.js?v=character-cards-1';
import {initProfileEditor} from '../profiles/editor.js?v=profile-reading-1';
initProfileEditor({fieldNames:factionFields,endpoint:'/api/factions',type:'faction'});
