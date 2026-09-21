import {countryFields,countryImageFields,validImageUrl} from './template.js?v=profile-reading-1';
import {initProfileEditor} from '../../profiles/editor.js?v=profile-reading-1';
initProfileEditor({fieldNames:countryFields,endpoint:'/api/countries',type:'country',imageFields:countryImageFields,validImageUrl});
