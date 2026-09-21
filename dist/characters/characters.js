import { characters, selectCharacters } from './data.js';

const list = document.querySelector('#character-list');
const search = document.querySelector('#character-search');
const sort = document.querySelector('#sort-order');
const direction = document.querySelector('#sort-direction');
const clear = document.querySelector('#clear-search');
const count = document.querySelector('#result-count');
const empty = document.querySelector('#empty-state');
let reversed = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createCharacter(character, index) {
  const row = element('li', 'character-row');
  const article = element('article', 'character');
  article.id = character.id;
  const summary = element('a', 'character-summary profile-link');
  summary.href = `${character.id}/`;
  const heading = element('div', 'character-heading');
  const avatar = element('span', `avatar ${character.color}`, character.initials);
  avatar.setAttribute('aria-hidden', 'true');
  const info = element('div', 'character-info');
  info.append(element('h2', '', `${index + 1}. ${character.name}`), element('p', 'roles', `${character.roles.join(' · ')} · ${character.provider}`), element('p', 'character-title', character.title));
  const icon = element('span', 'profile-arrow', '›');
  icon.setAttribute('aria-hidden', 'true');
  heading.append(avatar, info, icon);
  summary.append(heading, element('p', 'biography-preview', character.summary));
  article.append(summary); row.append(article);
  return row;
}

function render() {
  const matches = selectCharacters(search.value, sort.value, reversed);
  list.replaceChildren(...matches.map(createCharacter));
  count.textContent = search.value.trim() ? `${matches.length} of ${characters.length} characters` : `1–${characters.length} of ${characters.length} characters`;
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
