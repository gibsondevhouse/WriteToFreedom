import {cityFields,cityImageFields,validImageUrl} from './template.js?v=profile-reading-1';
import {initProfileEditor} from '../../profiles/editor.js?v=profile-reading-1';
initProfileEditor({fieldNames:cityFields,endpoint:'/api/cities',type:'city',imageFields:cityImageFields,validImageUrl});
