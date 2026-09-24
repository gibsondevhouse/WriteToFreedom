# Directory shell

Use this shell for searchable collection pages. Characters, Factions, and Locations share the Characters layout: breadcrumb/title, introduction, leading action, centered search, primary action, result count, view/sort controls and responsive results. Characters uses a card grid; Factions and Locations preserve their detailed list entries. Dashboard carousels continue to use the separate [dashboard shell](dashboard-shell.md).

## Responsibilities

| Layer | Owner |
| --- | --- |
| Complete HTML, labels, IDs, controls, statuses, empty states and slots | `server/directory-shell.js` → `renderDirectoryPage(config)` |
| Page definitions and route aliases | `server/directory-pages.js`; exact GET/HEAD routing in `server/app.js` |
| Layout, responsive behavior and focus styling | `public/directory/shell.css` |
| Search/sort/view state, list replacement, result count, load/retry and lifecycle | `public/directory/shell.js` → `initDirectoryShell(options)` |
| Entity loading/projection, filtering, entry factory, creation and legacy links | Page adapters in `public/characters/`, `public/factions/` and `public/locations/` |
| Sidebar and global search | Existing workspace shell |

## Add a directory

Add a definition and aliases to `directoryPages`, including its stable `id`, `title`, singular/plural nouns, intro copy, script and card styles. The shell always includes its own stylesheet. `views` and `sorts` are ordered `{value,label}` arrays; empty arrays omit those controls. The adapter must implement each offered view and sorting choice. Leading and primary actions support a label, optional stable ID, icon text (or `archive`), local link, or disabled button with an accessible description.

Page-owned HTML can occupy `leadingActions`, `primaryActions`, `filters`, `beforeList`, `afterList` and `dialogs` slots. These are trusted source-authored HTML, not user data. Other configuration text is escaped; assets and action links must be local absolute URLs. Dialogs remain outside main and all slots remain outside the replaceable results list.

```js
import {initDirectoryShell,fetchDirectory} from '/directory/shell.js';

const directory=initDirectoryShell({
  async load({signal}) {
    return (await fetchDirectory('/api/research',{signal})).entries;
  },
  select(records,{query,sort,reversed,view}) {
    return selectResearch(records,{query,sort,reversed,view});
  },
  renderItem(record,{view}) {
    return createResearchCard(record,{view});
  }
});
```

The renderer receives `(record,state,index)` and returns one entry element; the shell supplies the list item. Stateful renderers can return `{element,destroy}`. The shell disposes replaced items, staged items after a render failure, and all mounted items on teardown. Grid items set `--character-card-width:100%`; card-specific layout belongs to each component stylesheet. `data-view="list"` provides the shared single-column list surface; other view styles belong to the adapter.

The controller returns `refresh()`, `render()`, `showError(error)`, `clearError()`, `destroy()`, and getters for `records` and `state`. `refresh()` resolves to whether fresh results loaded successfully, allowing creation dialogs to require a current catalog. State contains `query`, `sort`, `view`, and `reversed`. An optional `onData(records)` observes successful reads. `isFiltered(state)` reports page-owned filters for result counts and empty states. Show all calls `onReset()` after clearing search; Clear search preserves page-owned filters. Both restore search focus. Use `autoload:false` for controlled initialization or tests.

## Behavior and persistence

Only collection reads belong to the controller. They use same-origin credentials, no-store and cancellation. A refresh during an active read queues a fresh request and discards the stale result. Failed refreshes retain the last good cards and control values. Initial errors remain distinct from genuinely empty collections. Independent action errors survive a subsequent successful read; retry only clears the load error. Rendering failures retain the previously mounted items.

The shell refreshes on a persisted `pageshow`; non-persisted `pagehide` destroys it, aborts reads and removes listeners. Do not initialize a second shell on the same root. Custom controls in slots are owned by their adapter and can call `render()` or `refresh()`.

Characters still uses `selectCharacters` and `/api/characters?view=cards`, including provider normalization. Its card saves update the original record for later filtering/sorting; the card manages its own immediate display and dialog focus. Creation retains a UUID across retries, excludes double submissions, and navigates to the canonical profile after success. Archive stays disabled. Legacy sample hashes redirect to absolute profile URLs even from `/characters/index.html`.

Factions keeps its full-text search, name/type sorting, detailed summaries and idempotent blank creation. Locations keeps all ten type filters, ancestor search, child summaries, note backlinks and direct profile/Edit links. `?type=` selects a type; legacy `#location-ID` links clear filters and focus the corresponding heading. Creation refreshes the available parents first and retains the existing type, required-parent and area-subtype rules. Returning from a created profile refreshes the collection and closes the previous creation dialog.

All three directories are generated from the registry. Their slash and `index.html` aliases render the same shell; missing-slash redirects preserve query strings. Their old static HTML is removed, and the adapters no longer depend on the legacy Characters layout stylesheet.

## Verification

`tests/directory-shell.test.mjs` covers all three directories' routes, metadata escaping, optional controls, external filters, counts, focus restoration, disposal, failed and overlapping reads, cancellation, back navigation, character/faction creation retry IDs, and card-update retention. Check real entry controls, location parent selection, desktop/mobile sizing and shared navigation in the browser when changing layout.
