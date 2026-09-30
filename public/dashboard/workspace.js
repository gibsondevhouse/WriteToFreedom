import {searchCatalog} from './search.js?v=__WTF_ASSET_REVISION__';
import {observeWorkspaceChanges} from '../profiles/workspace-events.js?v=__WTF_ASSET_REVISION__';
import {requestJSON} from '../profiles/request.js?v=__WTF_ASSET_REVISION__';

const input = document.querySelector('#novel-search');
const results = document.querySelector('#search-results');
const list = document.querySelector('#search-list');
const status = document.querySelector('#search-status');
let catalog;
let loadingCatalog;
let searchError;

function search() {
  const query = input.value.trim();
  results.hidden = !query;
  list.replaceChildren();
  if (!query) return;
  if (!catalog) {
    status.textContent = searchError || 'Searching all material…';
    return;
  }
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

async function ensureCatalog() {
  if (catalog || loadingCatalog) return loadingCatalog;
  searchError = '';
  loadingCatalog = (async () => {
    try {
      updateWorkspace(await requestJSON('/api/dashboard'));
    } catch {
      searchError = 'Search could not load. Type again to retry.';
      search();
    } finally { loadingCatalog = null; }
  })();
  return loadingCatalog;
}
input.addEventListener('focus', () => { ensureCatalog(); search(); });
input.addEventListener('input', () => { ensureCatalog(); search(); });
document.addEventListener('click', event => {
  if (!results.contains(event.target) && !event.target.closest('.workspace-search')) results.hidden = true;
});
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

const menu = document.querySelector('.sidebar-toggle');
const sidebar = document.querySelector('#workspace-sidebar');
const root = document.documentElement;
const narrow = matchMedia('(max-width: 760px)');
function adaptNavigation() {
  const expanded = narrow.matches ? root.dataset.mobileNav === 'open' : root.dataset.sidebar !== 'collapsed';
  menu.setAttribute('aria-expanded', String(expanded));
  const label = `${expanded ? 'Collapse' : 'Expand'} sidebar`;
  menu.setAttribute('aria-label', label);
  menu.title = label;
  if (narrow.matches && !expanded && sidebar.contains(document.activeElement)) menu.focus();
}
menu.addEventListener('click', () => {
  if (narrow.matches) {
    root.dataset.mobileNav = root.dataset.mobileNav === 'open' ? 'closed' : 'open';
  } else {
    const collapsed = root.dataset.sidebar !== 'collapsed';
    root.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
    try { localStorage.setItem('wtf-sidebar-collapsed', String(collapsed)); } catch {}
  }
  adaptNavigation();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && narrow.matches && root.dataset.mobileNav === 'open') {
    root.dataset.mobileNav = 'closed';
    adaptNavigation();
    menu.focus();
  }
});
document.addEventListener('click', event => {
  if (narrow.matches && root.dataset.mobileNav === 'open' && !sidebar.contains(event.target) && !menu.contains(event.target)) {
    root.dataset.mobileNav = 'closed';
    adaptNavigation();
  }
});
narrow.addEventListener('change', () => {
  root.dataset.mobileNav = 'closed';
  adaptNavigation();
});
window.addEventListener('storage', event => {
  if (event.key === 'wtf-sidebar-collapsed') {
    root.dataset.sidebar = event.newValue === 'true' ? 'collapsed' : 'expanded';
    adaptNavigation();
  }
});
adaptNavigation();

// Route/query context survives refreshes and copied links. Library search stays
// global, while manuscript navigation carries the selected novel explicitly.
let selectedNovelId='';
let selectedNovelLink;
let novelContextRevision=0;
async function refreshNovelContext(){
 if(!selectedNovelId||!selectedNovelLink)return;
 const revision=++novelContextRevision;
 try{
  const novel=await requestJSON('/api/novels/'+encodeURIComponent(selectedNovelId));
  if(revision!==novelContextRevision)return;
  selectedNovelLink.textContent=novel.title||'Untitled novel';
  selectedNovelLink.title=novel.title||'Untitled novel';
 }catch{}
}
function showNovelContext(){
 const context=document.querySelector('.workspace-context');if(!context)return;
 const url=new URL(location.href),profile=url.pathname.match(/^\/novels\/([0-9a-f-]{36})(?:\/|$)/i);
 let chapterNovel='';
 if(document.body.classList.contains('chapter-profile')){
  try{chapterNovel=JSON.parse(document.querySelector('#profile-data').textContent).novelId||'';}catch{}
 }
 const novelId=profile?.[1]||url.searchParams.get('novel')||chapterNovel;
 if(!novelId||!/^[0-9a-f-]{36}$/i.test(novelId))return;
 selectedNovelId=novelId;
 const library=document.createElement('a'),current=document.createElement('a'),separator=document.createElement('span');
 library.href='/novels/';library.textContent='My library';library.dataset.libraryLink='';
 current.href='/novels/'+encodeURIComponent(novelId)+'/';current.textContent='Selected novel';current.dataset.currentNovel='';
 selectedNovelLink=current;
 separator.textContent='/';separator.setAttribute('aria-hidden','true');
 context.replaceChildren(library,separator,current);
 for(const path of ['/dashboard/','/characters/','/factions/','/locations/','/lore/','/chapters/','/scenes/','/timeline/','/story-arcs/']){
  const link=document.querySelector('#workspace-navigation a[href="'+path+'"]');if(link)link.href=path+'?novel='+encodeURIComponent(novelId);
 }
 refreshNovelContext();
}
showNovelContext();

export function updateWorkspace(data) {
  if(data.scope)return;
  catalog = data;
  searchError = '';
  search();
}

// Profiles can save in this document or another tab. Let an in-flight search
// settle before invalidating its potentially stale result.
async function refreshSavedWorkspace(){
 refreshNovelContext();
 await loadingCatalog;
 catalog = undefined;
 searchError = '';
 search();
 if (input.value.trim()) ensureCatalog();
}
const stopObservingWorkspace=observeWorkspaceChanges(refreshSavedWorkspace);
let hasShownPage=false;
window.addEventListener('pageshow',event=>{if(hasShownPage||event.persisted)refreshSavedWorkspace();hasShownPage=true;});
window.addEventListener('pagehide',event=>{if(!event.persisted)stopObservingWorkspace();});
