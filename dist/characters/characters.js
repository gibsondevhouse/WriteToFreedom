import { characters, selectCharacters } from './data.js';

const list = document.querySelector('#character-list');
const search = document.querySelector('#character-search');
const sort = document.querySelector('#sort-order');
const direction = document.querySelector('#sort-direction');
const clear = document.querySelector('#clear-search');
const count = document.querySelector('#result-count');
const empty = document.querySelector('#empty-state');
const openCharacters = new Set();
let reversed = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createCharacter(character, index) {
  const row = element('li', 'character-row');
  const details = element('details', 'character');
  details.id = character.id;
  details.open = openCharacters.has(character.id);
  details.addEventListener('toggle', () => {
    if (!details.isConnected) return;
    if (details.open) openCharacters.add(character.id); else openCharacters.delete(character.id);
  });
  const summary = element('summary', 'character-summary');
  const heading = element('div', 'character-heading');
  const avatar = element('span', `avatar ${character.color}`, character.initials);
  avatar.setAttribute('aria-hidden', 'true');
  const info = element('div', 'character-info');
  info.append(element('h2', '', `${index + 1}. ${character.name}`), element('p', 'roles', `${character.roles.join(' · ')} · ${character.provider}`), element('p', 'character-title', character.title));
  const icon = element('span', 'expand-icon');
  icon.setAttribute('aria-hidden', 'true');
  heading.append(avatar, info, icon);
  summary.append(heading, element('p', 'biography-preview', character.summary));
  const content = element('div', 'character-content');
  const bio = element('section', 'biography');
  bio.append(element('h3', '', 'Biography'), element('p', '', character.biography), element('p', 'affiliation', `Affiliation: ${character.affiliation}`));
  const grid = element('div', 'detail-grid');
  const attributes = element('section', 'attributes');
  const dl = element('dl');
  for (const [key, value] of Object.entries(character.attributes)) {
    const pair = element('div'); pair.append(element('dt', '', key), element('dd', '', value)); dl.append(pair);
  }
  attributes.append(element('h3', '', 'Attributes'), dl);
  const tendencies = element('section', 'tendencies');
  const tendencyList = element('ul');
  character.tendencies.forEach(item => tendencyList.append(element('li', '', item)));
  tendencies.append(element('h3', '', 'Tendencies'), tendencyList);
  grid.append(attributes, tendencies);
  const relationships = element('section', 'relationships');
  const relationshipList = element('ul', 'relationship-list');
  character.relationships.forEach(relationship => {
    const related = characters.find(item => item.id === relationship.id);
    const item = element('li');
    const link = element('a', '', related.name); link.href = `#${related.id}`;
    const line = element('p'); line.append(link, element('span', 'relationship-type', relationship.type));
    item.append(line, element('p', 'relationship-description', relationship.text)); relationshipList.append(item);
  });
  relationships.append(element('h3', '', 'Relationships'), relationshipList);
  content.append(bio, grid, relationships); details.append(summary, content); row.append(details);
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
  search.value = '';
  openCharacters.add(id);
  render();
  const target = document.getElementById(id);
  target.querySelector('summary').focus({ preventScroll: true });
  target.scrollIntoView({ block: 'start' });
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
list.addEventListener('click', event => {
  const link = event.target.closest('.relationship-list a');
  if (!link) return;
  event.preventDefault();
  history.pushState(null, '', link.getAttribute('href'));
  showLinkedCharacter();
});
window.addEventListener('hashchange', showLinkedCharacter);
render();
showLinkedCharacter();
