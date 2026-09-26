import {assetUrl} from './asset-url.js';

const sections = [
  ['My workspace', [['Dashboard', '/dashboard/', 'dashboard'], ['My novels', '/novels/', 'novels'], ['Series', '/series/', 'series'], ['Collections', '/collections/', 'collections']]],
  ['Worldbuilding', [['Characters', '/characters/', 'characters'], ['Factions', '/factions/', 'factions'], ['Locations', '/locations/', 'locations'], ['Lore', '/lore/', 'lore']]],
  ['Structure', [['Chapters', '/chapters/', 'chapters'], ['Scenes', '/scenes/', 'scenes'], ['Timeline', '/timeline/', 'timeline'], ['Story Arcs', '/story-arcs/', 'storyArcs']]],
];

const iconPaths = {
 novels:'<path d="M4 3h12a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3Zm0 15a3 3 0 0 1 3-3h12M8 7h7M8 10h5"/>',
 series:'<rect x="3" y="6" width="5" height="15" rx="1"/><rect x="9.5" y="3" width="5" height="18" rx="1"/><path d="m17 6 4-1 2 14-4 1Z"/>',
 collections:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M7 6V3h10v3M3 11h18M9 15h6"/>',
 chapters:'<path d="M4 3h12a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3Zm0 15a3 3 0 0 1 3-3h12M8 7h7M8 10h5"/>',
 scenes:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 4 6 9m9-5-3 5m7-4-3 4M9 13l5 2-5 2Z"/>',
 lore:'<path d="M3 4h6a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H3Zm18 0h-6a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h6Z"/>',
 dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 characters:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/>',
 factions:'<path d="M5 21V4m0 0c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
 locations:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 timeline:'<path d="M4 4v16m8-16v16m8-16v16"/><rect x="2" y="6" width="10" height="4" rx="1"/><rect x="12" y="14" width="10" height="4" rx="1"/>',
 storyArcs:'<path d="M4 18 9 9l5 5 6-10"/><path d="M4 21h16M4 4v17"/><circle cx="9" cy="9" r="1.5"/><circle cx="14" cy="14" r="1.5"/>',
 sidebar:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
};
function shellIcon(name){return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;}

/**
 * Wrap a complete project HTML document once with shared navigation/search.
 * Pure string transform: no DB, authentication, or browser state. Requires the
 * normal lowercase head/body closing tags; this is not a general HTML parser.
 * data-app-shell prevents duplicate injection. Root paths activate Dashboard.
 * Browser behavior is initialized by the injected workspace scripts.
 * @param {string} html Full document; fragments without a body pass through.
 * @param {string} path Request pathname, used only for active navigation.
 * @returns {string} Decorated HTML, or the unchanged input if already wrapped.
 */
export function workspaceShell(html, path) {
  if (!html.includes('<body') || html.includes('data-app-shell')) return html;
  // Manifest hashes already identify Vite assets. Keep preload/import URLs identical.
  html=html.replace(/\b(href|src)="(\/(?!\/)[^"]+\.(?:css|js)(?:\?[^"#]*)?(?:#[^"]*)?)"/g,(_,attribute,asset)=>`${attribute}="${asset.startsWith('/frontend/')?asset:assetUrl(asset)}"`);
  const current = path === '/' || path === '/index.html' ? '/dashboard/' : path;
  const navigation = sections.map(([group, links]) => `<div class="nav-group"><p class="nav-label">${group}</p>${links.map(([label, href, icon]) => `<a class="nav-link${current.startsWith(href) ? ' active' : ''}" href="${href}" aria-label="${label}" title="${label}"${current.startsWith(href) ? ' aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${shellIcon(icon)}</span><span class="nav-text">${label}</span></a>`).join('')}</div>`).join('');
  const shell = `<aside id="workspace-sidebar" class="workspace-sidebar" aria-label="Workspace sidebar">
    <a class="workspace-brand" href="/" aria-label="Write to Freedom home"><img src="/crest.svg" width="26" height="26" alt=""><span>Write to Freedom</span></a>
    <nav id="workspace-navigation" aria-label="Novel sections">${navigation}<details class="upcoming"><summary>Upcoming modules</summary><p>Still in development</p><ul><li>Story Beats</li></ul></details></nav>
  </aside><div class="workspace-canvas">
    <header class="workspace-topbar">
      <button class="sidebar-toggle" type="button" aria-label="Collapse sidebar" title="Collapse sidebar" aria-expanded="true" aria-controls="workspace-sidebar">${shellIcon('sidebar')}</button>
      <span class="workspace-context"><a href="/novels/">My library</a></span>
      <search class="workspace-search" aria-label="Search all material"><label class="shell-sr-only" for="novel-search">Search all novels, series, collections, characters, factions, locations, lore, and story arcs</label><span class="search-symbol" aria-hidden="true">${shellIcon('search')}</span><input id="novel-search" type="search" placeholder="Search all material…" aria-controls="search-results" autocomplete="off"><kbd aria-hidden="true">⌘ K</kbd></search>
      <section id="search-results" class="search-results" aria-label="Search results" hidden><p id="search-status" role="status"></p><ul id="search-list"></ul></section>
    </header><div class="workspace-page">`;
  return html.replace('</head>', `<link rel="stylesheet" href="${assetUrl('/workspace-shell.css')}"><link rel="stylesheet" href="${assetUrl('/editorial-theme.css')}"><script src="${assetUrl('/workspace-state.js')}"></script><script type="module" src="${assetUrl('/dashboard/workspace.js')}"></script></head>`)
    .replace(/<body([^>]*)>/, (_, attrs) => `<body${attrs} data-app-shell>${shell}`)
    .replace('</body>', '</div></div></body>');
}
