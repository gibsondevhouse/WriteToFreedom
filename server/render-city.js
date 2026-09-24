import {renderConnectedNotes} from './note-connections.js';
import {ancestors,locationHref} from '../public/locations/data.js';
import {escape,createFieldRenderer,renderSection,renderInfoGroup,renderProfileName,renderProfilePage} from './profile-components.js';
import {citySections,validImageUrl} from '../public/locations/cities/template.js';
/** Compose city HTML with required country choices, descendants and linked notes; no persistence. */
export function renderCity(city,locations,cast,lore=[]){
 const countries=locations.filter(l=>l.type==='country'),parent=countries.find(l=>l.id===city.parentId),landmarks=locations.filter(l=>l.type==='landmark'&&ancestors(l,locations).some(a=>a.id===city.id));
 const field=createFieldRenderer(city,{required:['name', 'parentId'],options:(key,type)=>{const list=type==='country'?countries:type==='character'?cast:null;return list?list.map(c=>[c.id,c.name||'Untitled character']):null;},links:{leaderId:'/characters/'}});
 function media(key,label){const value=city[key]||'',visible=value&&validImageUrl(value);return `<figure class="country-media${key==='mapUrl'?' country-map':key==='skylineUrl'?' city-view':''}"><img data-image="${key}" alt="${escape(label)}" referrerpolicy="no-referrer"${visible?` src="${escape(value)}"`:' hidden'}><figcaption><details${visible?'':' open'}><summary>${label}</summary>${field([key,label+' image URL','url'])}</details><small class="image-error" data-image-error="${key}" hidden>Image unavailable. Check its URL.</small></figcaption></figure>`;}
 const areas=locations.filter(l=>l.type==='area'&&ancestors(l,locations).some(a=>a.id===city.id));
 const areaList=areas.length?`<h3>Areas</h3><ul class="city-landmarks">${areas.map(a=>`<li><a href="${escape(locationHref(a))}">${escape(a.name)}</a> <small>(${escape(a.areaType||'Area')})</small></li>`).join('')}</ul>`:'';
 const places=areaList+(landmarks.length?`<ul class="city-landmarks">${landmarks.map(l=>`<li><a href="${escape(locationHref(l))}">${escape(l.name)}</a>${l.parentId!==city.id?` <small>— ${escape(ancestors(l,locations).filter(a=>a.type==='area').map(a=>a.name).join(' › '))}</small>`:''}</li>`).join('')}</ul>`:'<p class="section-note">No landmarks recorded yet. Add a landmark in Locations and choose this city or one of its areas.</p>');
 const body=citySections.filter(s=>!['identity','symbols'].includes(s.id)).map(s=>renderSection(s,
 (s.id==='places'?places+'<p class="section-note"><a href="/locations/">Manage locations</a></p>':'')+s.fields.map(field).join(''),city,{fullWidth:s.id==='places'})).join('');
 const fields=(keys)=>keys.map(key=>field(citySections[0].fields.find(f=>f[0]===key))).join('');
 const infobox=renderProfileName(city,'city',{official:true})+`<p class="country-assignment">City in <a data-country-link href="${escape(locationHref({type:'country',id:city.parentId}))}">${escape(parent?.name||'Country')}</a></p>`+
  renderInfoGroup('City images & map','symbols',`${media('skylineUrl','City view')}<div class="country-symbols">${media('flagUrl','Flag')}${media('sealUrl','Seal')}</div><div class="epithet-field">${fields(['motto'])}</div>${media('mapUrl','Map')}`)+
  renderInfoGroup('City information','identity-information',fields(['name','officialName','parentId','region','nickname','settled','incorporated','founder']))+
  renderInfoGroup('Government','identity-government',fields(['governmentType','governingBody','leaderId']))+
  renderInfoGroup('Geography & population','identity-geography',fields(['area','elevation','population','populationDate','demonym','officialLanguages','timeZone']))+
  `<a class="places-count" href="#places">${landmarks.length} ${landmarks.length===1?'landmark':'landmarks'}</a>`;
 return renderProfilePage({record:city,type:'city',collection:'Locations',collectionUrl:'/locations/',infobox,content:body+renderConnectedNotes(cast,{kind:'location',id:city.id},city,lore),script:'/locations/cities/profile.js',styles:['/characters/profile-notes.css','/locations/countries/profile.css','/locations/cities/profile.css'],boxClass:'country-infobox city-infobox'});
}
