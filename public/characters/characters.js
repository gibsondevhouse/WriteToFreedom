import {createCharacterCard} from '../components/character-card/card.js?v=1';
import { characters, selectCharacters } from './data.js';

const list = document.querySelector('#character-list');
const search = document.querySelector('#character-search');
const sort = document.querySelector('#sort-order');
const direction = document.querySelector('#sort-direction');
const clear = document.querySelector('#clear-search');
const count = document.querySelector('#result-count');
const empty = document.querySelector('#empty-state');
let reversed = false;
let records = [];
const newButton = document.querySelector('#new-character');
const storageError = document.querySelector('#storage-error');
let pendingId;
function showStorageError(message) { storageError.textContent=message;storageError.hidden=false; }
async function api(url,options={}) {
 const response=await fetch(url,{credentials:'same-origin',...options});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load your characters.');return data;
}
function normalize(character){return {...character,provider:characters.find(c=>c.id===character.id)?.provider||''};}
async function loadSavedCharacters(){list.setAttribute('aria-busy','true');storageError.hidden=true;document.querySelector('#retry-characters').hidden=true;try{const data=await api('/api/characters?view=cards');records=data.characters.map(normalize);render();}catch(e){showStorageError(e.message);document.querySelector('#retry-characters').hidden=false;if(!records.length){count.textContent='Unable to load characters';empty.hidden=true;}}finally{list.setAttribute('aria-busy','false');}}
newButton.addEventListener('click',async()=>{
 newButton.disabled=true;newButton.textContent='Creating…';storageError.hidden=true;pendingId??=crypto.randomUUID();
 try{const character=await api('/api/characters',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:pendingId})});location.assign('/characters/'+encodeURIComponent(character.id)+'/');}
 catch(e){showStorageError(e.message);newButton.disabled=false;newButton.textContent='+ New character';}
});

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createCharacter(character){
 const row=element('li','character-card-item');
 row.append(createCharacterCard(character,{headingLevel:2,onUpdate:updated=>Object.assign(character,updated)}));return row;
}

function render() {
  const matches = selectCharacters(search.value, sort.value, reversed, records);
  list.replaceChildren(...matches.map(createCharacter));
  count.textContent = search.value.trim() ? `${matches.length} of ${records.length} characters` : (records.length?`1–${records.length} of ${records.length} characters`:'0 characters');
  clear.hidden = !search.value;
  empty.hidden = matches.length > 0;
  list.hidden = matches.length === 0;
}

function showLinkedCharacter() {
  const id = window.location.hash.slice(1);
  if (!characters.some(character => character.id === id)) return;
  window.location.replace(`${id}/`);
}

search.addEventListener('input', render);
sort.addEventListener('change', render);
direction.addEventListener('click', () => {
  reversed = !reversed;
  direction.setAttribute('aria-pressed', String(reversed));
  direction.setAttribute('aria-label', reversed ? 'Restore forward list order' : 'Reverse list order');
  direction.title = reversed ? 'Restore forward list order' : 'Reverse list order';
  render();
});
function resetSearch() { search.value = ''; render(); search.focus(); }
clear.addEventListener('click', resetSearch);
document.querySelector('#reset-search').addEventListener('click', resetSearch);
window.addEventListener('hashchange', showLinkedCharacter);
count.textContent='Loading characters…';
document.querySelector('#retry-characters').addEventListener('click',loadSavedCharacters);
showLinkedCharacter();
loadSavedCharacters();
window.addEventListener('pageshow',event=>{if(event.persisted){newButton.disabled=false;newButton.textContent='+ New character';pendingId=undefined;loadSavedCharacters();}});
