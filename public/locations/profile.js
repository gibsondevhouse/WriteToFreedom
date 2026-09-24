import {locationTemplates,validImageUrl} from './template.js';
import {initProfileEditor} from '../profiles/editor.js?v=location-profiles-1';

const record=JSON.parse(document.querySelector('#profile-data').textContent),template=locationTemplates[record.type];
initProfileEditor({fieldNames:template.fields,endpoint:'/api/locations',type:record.type,imageFields:template.imageFields,validImageUrl,
 onSaved(data){
  const path=document.querySelector('[data-location-ancestry]');
  path.replaceChildren();
  for(const [index,parent] of data.ancestry.entries()){
   if(index)path.append(document.createTextNode(' › '));
   const link=document.createElement('a');link.href=parent.href;link.textContent=parent.name;path.append(link);
  }
  if(!data.ancestry.length)path.textContent='No parent location';
 }
});
