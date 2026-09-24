import {locationTemplates,validImageUrl} from '../public/locations/template.js';
import {ancestors,parentChoices,requiresParent,areaTypes,locationHref,locationTypes,typePlurals,typeLabels} from '../public/locations/data.js';
import {escape,createFieldRenderer,renderInfoGroup,renderProfileName,renderProfilePage,renderSection} from './profile-components.js';
import {renderConnectedNotes} from './note-connections.js';

export function renderLocationAncestry(record,locations){
 const path=ancestors(record,locations);
 return path.length?path.map(l=>`<a href="${escape(locationHref(l))}">${escape(l.name)}</a>`).join(' <span aria-hidden="true">›</span> '):'No parent location';
}

/** All eight types share this shell; the template owns their field differences. */
export function renderLocation(record,locations,cast,lore=[]){
 const template=locationTemplates[record.type];
 const field=createFieldRenderer(record,{
  required:['name',...(requiresParent(record.type)?['parentId']:[]),...(record.type==='area'?['areaType']:[])],
  options:(key,type)=>type==='location'?parentChoices(record.type,locations,record.id).map(l=>[l.id,l.name+(ancestors(l,locations).length?' — '+ancestors(l,locations).map(p=>p.name).join(' › '):'')]):type==='character'?cast.map(c=>[c.id,c.name||'Untitled character']):type==='area-type'?areaTypes.map(a=>[a,a]):null,
  links:{leaderId:'/characters/'}
 });
 const media=(key,label)=>{
  const value=record[key],visible=value&&validImageUrl(value);
  return `<figure class="country-media country-map"><img data-image="${key}" alt="${escape(record.name+' — '+label)}" referrerpolicy="no-referrer"${visible?` src="${escape(value)}"`:' hidden'}><figcaption><details${visible?'':' open'}><summary>${label}</summary>${field([key,label+' URL','url'])}</details><small class="image-error" data-image-error="${key}" hidden>Image unavailable. Check its URL.</small></figcaption></figure>`;
 };
 const children=locations.filter(l=>l.parentId===record.id);
 const places=children.length?locationTypes.map(type=>{
  const items=children.filter(l=>l.type===type);
  return items.length?`<h3>${typePlurals[type]}</h3><ul class="location-children-list">${items.map(l=>`<li><a href="${escape(locationHref(l))}">${escape(l.name)}</a>${l.areaType?` <small>(${escape(l.areaType)})</small>`:''}</li>`).join('')}</ul>`:'';
 }).join(''):'<p class="section-note">No locations recorded within this '+typeLabels[record.type].toLowerCase()+' yet.</p>';
 const content=template.sections.filter(s=>!['identity','symbols'].includes(s.id)).map(s=>renderSection(s,s.id==='places'?places+'<p class="section-note"><a href="/locations/">Manage locations</a></p>':s.fields.map(field).join(''),record,{fullWidth:s.id==='places'})).join('');
 const infobox=renderProfileName(record,record.type,{official:true})+
  `<nav class="location-ancestry" data-location-ancestry aria-label="Location ancestry">${renderLocationAncestry(record,locations)}</nav>`+
  renderInfoGroup('Images & map','symbols',media('imageUrl','Image')+media('mapUrl','Map'))+
  template.infoGroups.map(group=>renderInfoGroup(group.title,group.id,group.fields.map(field).join(''))).join('')+
  `<a class="places-count" href="#places">${children.length} ${children.length===1?'location':'locations'} within</a>`;
 return renderProfilePage({record,type:record.type,collection:'Locations',collectionUrl:'/locations/',infobox,
  content:content+renderConnectedNotes(cast,{kind:'location',id:record.id},record,lore),script:'/locations/profile.js',
  styles:['/characters/profile-notes.css','/locations/countries/profile.css','/locations/profile.css'],boxClass:'country-infobox location-infobox'});
}
