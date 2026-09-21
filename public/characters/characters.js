import { characters, selectCharacters } from './data.js';

const list = document.querySelector('#character-list');
const search = document.querySelector('#character-search');
const sort = document.querySelector('#sort-order');
const direction = document.querySelector('#sort-direction');
const clear = document.querySelector('#clear-search');
const count = document.querySelector('#result-count');
const empty = document.querySelector('#empty-state');
let reversed = false;
let records = [...characters];
const newButton = document.querySelector('#new-character');
const storageError = document.querySelector('#storage-error');
let pendingId;
function showStorageError(message) { storageError.textContent=message;storageError.hidden=false; }
async function api(url,options={}) {
 const response=await fetch(url,{credentials:'same-origin',...options});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load your characters.');return data;
}
function normalize(character) { const seed=characters.find(c=>c.id===character.id);return {...character,name:character.name.trim()||'Untitled character',initials:character.name.trim().split(/\s+/).slice(0,2).map(p=>p[0]||'').join('').toUpperCase()||'?',roles:character.roles.trim()?character.roles.split(/\s*[·,;]\s*/).filter(Boolean):['Draft character'],provider:seed?.provider||'',color:seed?.color||'blue',title:character.title||'Character in development',summary:character.summary||'A blank character, ready for you to bring to life.'}; }
async function loadSavedCharacters() {try{const data=await api('/api/characters');records=data.characters.map(normalize);render();}catch(e){showStorageError(e.message+' Your sample cast is still available.');}}
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

function createCharacter(character, index) {
  const row = element('li', 'character-row character-card');
  const article = element('article', 'character');
  article.id = character.id;
  const summary = element('a', 'character-summary profile-link');
  summary.href = `${character.id}/`;
  const heading = element('div', 'character-heading');
  const avatar = element('span', `avatar ${character.color}`, character.initials);
  avatar.setAttribute('aria-hidden', 'true');
  const info = element('div', 'character-info');
  const labels = element('div', 'character-labels');
  [...character.roles,character.provider].filter(Boolean).forEach(label => labels.append(element('span', 'character-label', label)));
  info.append(element('h2', '', `${index + 1}. ${character.name}`), labels);
  const affiliationImage = element('span', 'affiliation-placeholder');
  affiliationImage.setAttribute('role', 'img');
  affiliationImage.setAttribute('aria-label', (character.affiliation || 'House, alliance, or family') + ' image placeholder');
  affiliationImage.title = (character.affiliation || 'House / alliance / family') + ' — image placeholder';
  affiliationImage.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m4 18 5-5 3 3 4-6 5 8"/></svg>';
  heading.append(avatar, info, affiliationImage);
  summary.append(heading);
  article.append(summary); row.append(article);
  return row;
}

function render() {
  const matches = selectCharacters(search.value, sort.value, reversed, records);
  list.replaceChildren(...matches.map(createCharacter));
  count.textContent = search.value.trim() ? `${matches.length} of ${records.length} characters` : `1–${records.length} of ${records.length} characters`;
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
render();
showLinkedCharacter();
loadSavedCharacters();
window.addEventListener('pageshow',event=>{if(event.persisted){newButton.disabled=false;newButton.textContent='+ New character';pendingId=undefined;loadSavedCharacters();}});
