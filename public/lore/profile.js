import {initProfileEditor} from '../profiles/editor.js?v=lore-1';
import {loreTemplates,primaryCollection,validImageUrl} from './template.js';
import {referenceKey,cleanNoteReference} from '../characters/notes.js';
import {el} from '../dashboard/components.js';
import {ratingGroupsFor} from '../profiles/ratings.js?v=__WTF_ASSET_REVISION__';
import {initProfileRatings} from '../profiles/ratings-controls.js?v=__WTF_ASSET_REVISION__';

const {record,targets}=JSON.parse(document.querySelector('#profile-data').textContent),form=document.querySelector('#profile-form'),host=document.querySelector('#lore-connections');
const readRatings=initProfileRatings(record,ratingGroupsFor('lore',record.type));
const rows=[];
function dirty(){form.dispatchEvent(new Event('change',{bubbles:true}));}
function addConnection(connection={target:null,relationship:''},focus=false){
 const row=el('div','lore-connection'),search=el('input'),select=el('select'),relationship=el('input'),open=el('a','lore-connected-link','Open entry →'),remove=el('button','lore-remove','Remove');
 search.type='search';search.placeholder='Find an entry…';search.setAttribute('aria-label','Find a connected entry');
 select.required=true;select.setAttribute('aria-label','Connected entry');relationship.required=true;relationship.maxLength=160;relationship.placeholder='e.g. owned by';relationship.value=connection.relationship;relationship.setAttribute('aria-label','Connection description');remove.type='button';
 let selected=connection.target?referenceKey(connection.target):'';
 const source={row,select,relationship,original:connection.target};rows.push(source);
 function populate(){const query=search.value.toLocaleLowerCase().trim();select.replaceChildren(new Option('Choose an entry',''));for(const target of targets.filter(t=>referenceKey(t)===selected||[t.label,t.group,t.detail].join(' ').toLocaleLowerCase().includes(query)))select.append(new Option(target.label+' · '+target.group,referenceKey(target)));if(selected&&!targets.some(t=>referenceKey(t)===selected))select.append(new Option('Unavailable entry (existing connection)',selected));select.value=selected;}
 function update(){const target=targets.find(t=>referenceKey(t)===selected);open.hidden=!target;if(target)open.href=target.href;}
 search.addEventListener('input',event=>{event.stopPropagation();populate();});search.addEventListener('change',event=>event.stopPropagation());select.addEventListener('change',()=>{selected=select.value;update();});
 remove.addEventListener('click',()=>{rows.splice(rows.indexOf(source),1);row.remove();dirty();document.querySelector('#add-lore-connection').focus();});
 populate();update();row.append(search,select,relationship,open,remove);host.append(row);if(focus){search.focus();dirty();}
}
for(const connection of record.connections)addConnection(connection);
document.querySelector('#add-lore-connection').addEventListener('click',()=>addConnection(undefined,true));
initProfileEditor({fieldNames:loreTemplates[record.type].fields,endpoint:'/api/lore',type:'lore',imageFields:['imageUrl'],validImageUrl,
 readExtra(){
  const connections=rows.map(({select,relationship,original})=>{const target=targets.find(t=>referenceKey(t)===select.value)||original;if(!target)throw new Error('Choose a connected entry.');return {target:cleanNoteReference(target),relationship:relationship.value};});
  if(new Set(connections.map(c=>referenceKey(c.target))).size!==connections.length)throw new Error('Each connected entry should appear only once.');
  return {...readRatings(),collections:[...new Set([primaryCollection[record.type],...Array.from(form.querySelectorAll('[data-collection]:checked'),n=>n.dataset.collection)])],pinned:document.querySelector('#lore-pinned').checked,featured:document.querySelector('#lore-featured').checked,connections};
 }
});
