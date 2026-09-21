import {cityFields,cityImageFields,validImageUrl} from './template.js?v=profile-standard-1';
import {initProfileEditor} from '../../profiles/editor.js?v=profile-standard-1';
initProfileEditor({fieldNames:cityFields,endpoint:'/api/cities',type:'city',imageFields:cityImageFields,validImageUrl});
