import {renderConnectedNotes} from './note-connections.js';
import {ancestors,parentChoices,locationHref} from '../public/locations/data.js';
import {escape,createFieldRenderer,renderSection,renderInfoGroup,renderProfileName,renderProfilePage} from './profile-components.js';
import {countrySections,validImageUrl} from '../public/locations/countries/template.js';
/** Compose country HTML with scoped world/city choices, descendants and linked notes; no persistence. */
export function renderCountry(country,locations,cast,lore=[]){
 const cities=locations.filter(l=>l.type==='city'&&l.parentId===country.id),cityIds=new Set(cities.map(c=>c.id)),landmarks=locations.filter(l=>l.type==='landmark'&&ancestors(l,locations).some(a=>cityIds.has(a.id)));
 const field=createFieldRenderer(country,{required:['name'],options:(key,type)=>{const list=type==='world'?parentChoices('country',locations,country.id):type==='city'?cities:type==='character'?cast:null;return list?list.map(c=>[c.id,c.name||'Untitled character']):null;},links:{leaderId:'/characters/'}});
 function media(key,label){const value=country[key]||'',visible=value&&validImageUrl(value);return `<figure class="country-media${key==='mapUrl'?' country-map':''}"><img data-image="${key}" alt="${escape(label)}" referrerpolicy="no-referrer"${visible?` src="${escape(value)}"`:' hidden'}><figcaption><details${visible?'':' open'}><summary>${label}</summary>${field([key,label+' image URL','url'])}</details><small class="image-error" data-image-error="${key}" hidden>Image unavailable. Check its URL.</small></figcaption></figure>`;}
 const places=cities.length?`<div class="table-scroll"><table class="country-places"><thead><tr><th scope="col">City</th><th scope="col">Landmarks</th></tr></thead><tbody>${cities.map(city=>`<tr><th scope="row"><a href="${escape(locationHref(city))}">${escape(city.name)}</a></th><td>${landmarks.filter(l=>ancestors(l,locations).some(a=>a.id===city.id)).map(l=>`<a href="${escape(locationHref(l))}">${escape(l.name)}</a>`).join('<br>')||'None recorded'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="section-note">No cities recorded yet. Add a city in Locations and choose this country.</p>';
 const body=countrySections.filter(s=>!['identity','symbols'].includes(s.id)).map(s=>renderSection(s,
 (s.id==='places'?places+'<p class="section-note"><a href="/locations/">Manage locations</a></p>':'')+s.fields.map(field).join(''),country,{fullWidth:s.id==='places'})).join('');
 const fields=(keys)=>keys.map(key=>field(countrySections[0].fields.find(f=>f[0]===key))).join('');
 const infobox=renderProfileName(country,'country',{official:true})+
  renderInfoGroup('National symbols & map','symbols',`<div class="country-symbols">${media('flagUrl','Flag')}${media('coatOfArmsUrl','Coat of arms')}</div><div class="epithet-field">${fields(['motto'])}</div>${fields(['anthem'])}${media('mapUrl','Map')}`)+
  renderInfoGroup('Country information','identity-information',fields(['name','officialName','officialLanguages','demonym','founded']))+
  renderInfoGroup('Government','identity-government',fields(['governmentType','leaderId','legislature']))+
  renderInfoGroup('Geography & population','identity-geography',fields(['parentId','capitalId','largestCityId','area','population','populationDate']))+
  renderInfoGroup('Economy & time','identity-economy',fields(['currency','timeZone']))+
  `<a class="places-count" href="#places">${cities.length} ${cities.length===1?'city':'cities'} · ${landmarks.length} ${landmarks.length===1?'landmark':'landmarks'}</a>`;
 return renderProfilePage({record:country,type:'country',collection:'Locations',collectionUrl:'/locations/',infobox,content:body+renderConnectedNotes(cast,{kind:'location',id:country.id},country,lore),script:'/locations/countries/profile.js',styles:['/characters/profile-notes.css','/locations/countries/profile.css'],boxClass:'country-infobox'});
}
