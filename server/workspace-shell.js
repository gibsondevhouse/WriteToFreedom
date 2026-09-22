const sections = [
  ['Overview', [['Dashboard', '/dashboard/', '▦']]],
  ['Worldbuilding', [['Characters', '/characters/', '♙'], ['Factions', '/factions/', '⚑'], ['Locations', '/locations/', '⌖']]],
  ['Structure', [['Timeline', '/timeline/', '↔']]],
];

export function workspaceShell(html, path) {
  if (!html.includes('<body') || html.includes('data-app-shell')) return html;
  const current = path === '/' || path === '/index.html' ? '/dashboard/' : path;
  const navigation = sections.map(([group, links]) => `<div class="nav-group"><p class="nav-label">${group}</p>${links.map(([label, href, icon]) => `<a class="nav-link${current.startsWith(href) ? ' active' : ''}" href="${href}" aria-label="${label}" title="${label}"${current.startsWith(href) ? ' aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-text">${label}</span></a>`).join('')}</div>`).join('');
  const shell = `<aside id="workspace-sidebar" class="workspace-sidebar" aria-label="Workspace sidebar">
    <a class="workspace-brand" href="/" aria-label="Write to Freedom home"><img src="/crest.svg" width="32" height="36" alt=""><span>Write to<br>Freedom</span></a>
    <nav id="workspace-navigation" aria-label="Novel sections">${navigation}<details class="upcoming"><summary>Upcoming modules</summary><p>Still in development</p><ul><li>Chapters</li><li>Scenes</li><li>Story Arcs</li><li>Story Beats</li><li>Lore</li></ul></details></nav>
    <p class="sidebar-note">Your novel. One workspace.</p>
  </aside><div class="workspace-canvas">
    <header class="workspace-topbar">
      <button class="sidebar-toggle" type="button" aria-label="Collapse sidebar" title="Collapse sidebar" aria-expanded="true" aria-controls="workspace-sidebar"><span aria-hidden="true">☰</span></button>
      <span class="workspace-context">My workspace</span>
      <search class="workspace-search" aria-label="Search your novel"><label class="shell-sr-only" for="novel-search">Search characters, factions, and locations</label><span class="search-symbol" aria-hidden="true">⌕</span><input id="novel-search" type="search" placeholder="Search your novel…" aria-controls="search-results" autocomplete="off"><kbd aria-hidden="true">⌘ K</kbd></search>
      <section id="search-results" class="search-results" aria-label="Search results" hidden><p id="search-status" role="status"></p><ul id="search-list"></ul></section>
    </header><div class="workspace-page">`;
  return html.replace('</head>', '<link rel="stylesheet" href="/workspace-shell.css?v=1"><script src="/workspace-state.js?v=1"></script><script type="module" src="/dashboard/workspace.js?v=shared-1"></script></head>')
    .replace(/<body([^>]*)>/, (_, attrs) => `<body${attrs} data-app-shell>${shell}`)
    .replace('</body>', '</div></div></body>');
}
