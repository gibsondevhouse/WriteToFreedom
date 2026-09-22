import {searchCatalog} from './search.js';

const input = document.querySelector('#novel-search');
const results = document.querySelector('#search-results');
const content = document.querySelector('#dashboard-content');
const list = document.querySelector('#search-list');
const status = document.querySelector('#search-status');
let catalog;

function search() {
  const query = input.value.trim();
  results.hidden = !query;
  content.hidden = Boolean(query);
  list.replaceChildren();
  if (!query || !catalog) return;
  const matches = searchCatalog(catalog, query);
  const shown = matches.slice(0, 50);
  status.textContent = matches.length
    ? `${matches.length} result${matches.length === 1 ? '' : 's'}${matches.length > 50 ? ' · Showing the first 50. Refine your search to see more.' : ''}`
    : 'No matches. Try another name, place, or keyword.';
  for (const record of shown) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'search-result';
    link.href = record.href;
    const copy = document.createElement('span');
    copy.className = 'search-result-copy';
    const name = document.createElement('strong');
    name.textContent = record.name;
    copy.append(name);
    const description = record.summary || record.parent || record.title;
    if (description) {
      const text = document.createElement('p');
      text.textContent = description;
      copy.append(text);
    }
    const kind = document.createElement('span');
    kind.className = 'search-result-kind';
    kind.textContent = record.label;
    link.append(copy, kind);
    item.append(link);
    list.append(item);
  }
}

input.addEventListener('input', search);
input.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    input.value = '';
    search();
  }
  if (event.key === 'ArrowDown' && list.firstElementChild) {
    event.preventDefault();
    list.querySelector('a').focus();
  }
});
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !input.disabled) {
    event.preventDefault();
    input.focus();
    input.select();
  }
  if (event.key === 'Escape' && results.contains(document.activeElement)) {
    input.value = '';
    search();
    input.focus();
  }
});
document.querySelector('.workspace-search kbd').textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#workspace-navigation');
const narrow = matchMedia('(max-width: 760px)');
function adaptNavigation() {
  // Move focus before hiding a focused navigation item during a resize.
  if (narrow.matches) menu.hidden = false;
  if (narrow.matches && navigation.contains(document.activeElement)) menu.focus();
  if (!narrow.matches && document.activeElement === menu) document.querySelector('.workspace-brand').focus();
  menu.hidden = !narrow.matches;
  navigation.hidden = narrow.matches;
  menu.setAttribute('aria-expanded', String(!navigation.hidden));
}
menu.addEventListener('click', () => {
  navigation.hidden = !navigation.hidden;
  menu.setAttribute('aria-expanded', String(!navigation.hidden));
});
navigation.addEventListener('keydown', event => {
  if (event.key === 'Escape' && narrow.matches) {
    navigation.hidden = true;
    menu.setAttribute('aria-expanded', 'false');
    menu.focus();
  }
});
narrow.addEventListener('change', adaptNavigation);
adaptNavigation();

export function updateWorkspace(data) {
  catalog = data;
  const counts = {
    characters: data.characters.length,
    factions: data.factions.length,
    locations: data.locations.length,
    dates: data.timeline.events.length + data.timeline.unplaced.length,
  };
  for (const node of document.querySelectorAll('[data-count]')) node.textContent = counts[node.dataset.count].toLocaleString();
  document.querySelector('#workspace-stats').hidden = false;
  input.disabled = false;
  search();
}
