# Reusable dashboard shell

Home and Lore use the same complete main-area shell. The selected dashboard design is the baseline for future dashboards. The outer workspace sidebar, topbar, search, and navigation preferences remain owned by `server/workspace-shell.js`.

## Boundaries

| Module | Owns |
| --- | --- |
| `server/dashboard-shell.js` | HTML document, metadata, skip link, main landmark, heading, optional breadcrumbs/description/actions, stable slots, loading/error/retry and empty states. |
| `server/dashboard-pages.js` | Page definitions and their routes; Home and Lore content, adapter paths and optional styles. |
| `public/dashboard/shell.css` | Required dashboard theme, cards and dialog styles in the correct cascade order; shared shell layout. |
| `public/dashboard/shell.js` | Authenticated JSON loading, status, retry, persisted-page refresh, queued refreshes, cancellation, content replacement and cleanup. |
| `public/dashboard/components.js` | Shared cards and scrolling rails. |
| `public/dashboard/question-banner.js` | Question carousel and its controls, accessibility, reduced motion and lifecycle. |
| Page adapter | Data interpretation, filtering, collection navigation, editing/capture, creation and draft protection. |

There are no copied Home/Lore HTML documents in `public/`. `/`, `/index.html`, `/dashboard/`, and `/dashboard/index.html` use the same Home definition. Lore uses `/lore/` and `/lore/index.html`. The Worker handles GET/HEAD and canonical trailing-slash redirects before static assets. HTML frames contain no private data; the owner-scoped APIs remain the data boundary.

## Add a dashboard

Add a page definition and route to `server/dashboard-pages.js`:

```js
const research = {
  id: 'research-dashboard',
  title: 'Research',
  heading: 'Your research',
  eyebrow: 'Writing',
  description: 'Sources and ideas for your story.',
  script: '/research/dashboard.js',
  actions: [{id: 'new-source', label: 'New source', icon: '＋'}],
  empty: {
    title: 'Keep your first source.',
    description: 'Saved sources will appear here.',
    actions: [{id: 'first-source', label: 'Add a source'}]
  }
};
dashboardPages.set('/research/', research);
dashboardPages.set('/research/index.html', research);
```

Add the corresponding owner-scoped endpoint and page adapter as part of that feature. A minimal adapter looks like:

```js
import {initDashboardShell} from '../dashboard/shell.js';
import {locationCard} from '../dashboard/components.js';

const dashboard = initDashboardShell({
  endpoint: '/api/research',
  render(data, view) {
    if (!data.entries.length) view.empty();
    view.questions(data.questions, {hideWhenEmpty: true});
    view.rail({
      id: 'sources', title: 'Sources', records: data.entries,
      card: locationCard, hideWhenEmpty: true
    });
  }
});
```

Card records must match the selected component’s contract. `locationCard` expects `id`, `name`, `href`, `kind`, `label`, and optional `image`, `summary`, and `parent`. Use `createCharacterCard` for character cards. The shell includes both canonical character-card and dialog styles automatically.

## Page definition

Required metadata is `title` and a local absolute `script` URL. Supply a stable unique `id`; the default is `dashboard`. Optional `heading`, `eyebrow`, `description`, `metaDescription`, `loadingText`, and `noscript` customize text without duplicating the frame. Text is escaped. `styles` adds local styles after the required shell dependency.

`actions` and `empty.actions` accept `{id?, label, icon?, href?, disabled?}`. An action with `href` is a link; otherwise it is a button whose handler belongs to the adapter. `breadcrumbs` accepts `{label, href?}`; the current item omits `href`. URLs must be local absolute paths. Avoid putting private user data in page definitions.

`slots` accepts source-authored HTML:

- `toolbar`: search, filters, capture controls, or other persistent tools below the heading.
- `beforeContent`: collection navigation or other content above the changing rows.
- `afterContent`: footer/context below those rows.
- `dialogs`: page-owned dialogs outside the main landmark.

Slots are trusted markup, not a place to interpolate unescaped user input. Their controls are mounted once and survive refreshes. Each control needs its own label and stable ID. Root-scoped `data-dashboard-*` hooks belong to the shell and should not be duplicated by slots.

## Rendering and refresh

`render(data, view)` is synchronous. It describes one replaceable view:

- `view.rail({id, title, records, card, href?, emptyText?, emptyAction?, hideWhenEmpty?})` adds a shared scrolling row and returns its section, or `null` if hidden. Use a stable section ID. `href` supplies the View all action. `emptyAction: {label, onClick}` gives an empty row a real creation action.
- `view.questions(records, {hideWhenEmpty?, emptyState?})` adds the shared question banner. With no questions it keeps the banner layout, displays a zero count and explanatory copy, and starts no carousel timers. Optional `emptyState: {title, description, action: {label, onClick}}` tailors that copy and action.
- `view.append(...nodes)` adds page-specific DOM, such as a grid. The adapter owns cleanup for listeners outside that DOM.
- `view.empty()` reveals the configured shared empty state. Other sections can still be present.

The shell disposes the previous view’s rail observers/animation frames and carousel timers/listeners when committing its replacement. A failed render disposes only the unfinished view, retaining the last successful content. Section and carousel IDs are scoped to the dashboard.

Lore keeps its question banner and six collection rails visible even before an entry exists. Each empty rail opens creation with the corresponding type selected. Populated rails use the shared cards and scrolling controls; Notes includes contextual character notes. View all filters the existing page without replacing the capture draft, and Show all restores the overview.

The returned controller exposes:

- `refresh()`: re-fetch data and render it. Concurrent requests share a completion promise; a refresh requested during a read queues a fresh read and skips the superseded response. Use this after a mutation.
- `render()`: re-render the last successful data after a filter changes, without fetching.
- `data`: the last accepted payload.
- `root` and `rows`: the mounted shell and replaceable content root.
- `destroy()`: abort the active read, suppress late results, dispose the view, and remove shell event listeners. It is idempotent.

Use `load({signal})` instead of `endpoint` when loading requires custom logic. Forward its abort signal. `autoload: false` is available for explicitly controlled mounting. Optional `onData(data)` runs once after an accepted read; use it to update persistent controls or publish a compatible catalog. Home passes `updateWorkspace` here; Lore must not, because its endpoint returns a different data shape.

Loading is announced, the content region exposes `aria-busy`, and failures show a retry action without removing previous content. Back-forward cache restoration refreshes data. A normal page exit destroys the controller; cached pages keep their mounted controls and drafts.

## Verification

`tests/dashboard-shell.test.mjs` covers page aliases, required styling, metadata escaping, action/slot variants, queued refreshes, retained drafts/content on errors, retry, empty states, renderer failures, cancellation, scoped identifiers and disposal. These are server and controller tests with DOM stubs, not visual browser checks. Run the full suite and build when changing the shared contract.
