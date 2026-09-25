# Component boundaries and extension contracts

This project uses ES modules, HTML string renderers, and DOM factories rather than a UI framework. Componentization means a module owns a defined piece of rendering or behavior with explicit inputs and effects. It does not imply that every page is a reusable component or that all initializers support repeated mounting.

See the [README](../README.md) for setup, [routing guide](routing.md) for handler contracts, and [character-card reference](../public/components/character-card/README.md) for a minimal card integration example.

## Layers and dependency direction

```text
HTTP handlers + owner-scoped repository
    |
    +--> catalogs/defaults + derived data (server; no DOM)
    |       +--> dashboardData / characterCardDetails / noteTargets
    |
    +--> entity renderer
            +--> shared profile HTML components
                    +--> complete profile document
                              |
                      workspaceShell (outer Worker)
                              |
                    browser page adapter
                      +--> shared profile controls
                      +--> specialized note/attribute UI
                      +--> API saves

renderDirectoryPage / renderDashboardPage / legacy static pages + workspaceShell
    |
    +--> page controller fetches data and owns list/rail layout
            +--> createCharacterCard (reusable DOM factory)
                    +--> dialog controller -> fresh document -> API save
```

Shared data modules such as templates, dates, notes validation, attribute validation, and graph/timeline models can be imported by both Worker and browser code because their model functions do not need the DOM. Browser controllers may access `document` during module evaluation and must not be imported into server execution paths. Placement under `public/` alone does not make a file browser-only or server-safe; inspect its imports and top-level effects.

Standalone Lore notes are the first React/TypeScript pilot. `frontend/lore-profile.tsx` mounts into a dedicated region selected by `server/render-lore.js`, with one React owner for the complete profile and save lifecycle. The workspace shell remains outside it. The legacy profile controller contracts below still apply to other profiles; do not initialize them inside the React region. See [frontend migration](frontend-migration.md) for build, typing, verification and retirement boundaries.

Chapters/Scenes use the second typed entry, `frontend/writing-workspace.tsx`. `Workspace.tsx` owns per-scene drafts, explicit saves, metadata and panels; `Editor.tsx` owns each mounted Tiptap instance, selection and undo history. Visited scenes remain mounted while hidden, and successful saves do not reset their editor content. The versioned rich-text schema and owner-scoped API contract are documented in [writing workspace](writing-workspace.md).

## Ownership map

| Concern | Authoritative modules | Consumers |
| --- | --- | --- |
| Workspace navigation HTML | `server/workspace-shell.js` | Outer `createWorker`, every HTML page. |
| Workspace layout/preferences/search UI | `public/workspace-shell.css`, `public/workspace-state.js`, `public/dashboard/workspace.js` | Dashboard, directories, profiles, timeline. |
| Dashboard data projection | `server/dashboard-routes.js`, `server/character-card-data.js` | Dashboard endpoint and character cards view. |
| Complete dashboard frame and lifecycle | `server/dashboard-shell.js`, `server/dashboard-pages.js`, `public/dashboard/shell.js`, `shell.css` | Home, Lore, and future dashboard pages; see [shell contract](dashboard-shell.md). |
| Shared dashboard cards/rails and question rotation | `public/dashboard/components.js`, `question-banner.js`, `dashboard.css` | Home and Lore dashboards. |
| Lore dashboard and profile composition | `public/lore/`, `server/lore.js`, `server/render-lore.js` | Standalone Lore, collections and contextual character-note projections. |
| Directory frame and lifecycle | `server/directory-shell.js`, `public/directory/` | Characters, Factions, Locations; reusable for other collection pages. |
| Character-card markup and dialogs | `public/components/character-card/` | Dashboard and character directory. |
| Profile HTML primitives | `server/profile-components.js` | Shared character, faction, country, city, location, and Lore renderers. |
| Field lists/defaults/options | Entity `template.js` files; `public/profiles/choices.js` | Renderers, validators, editors, derived models. |
| Shared profile interaction | `public/profiles/controls.js`, `viewport.js`, `date-picker.js` | All profile editors. |
| Shared profile ratings | `public/profiles/ratings.js`, `ratings-controls.js`, `ratings.css` | Factions, all ten location types, and all six Lore types. |
| Generic profile saving | `public/profiles/editor.js` | Faction, country, city, shared location, and Lore adapters. |
| Character-specific saving | `public/characters/profile-editor.js` | Character profile only. |
| Authored notes and links | `public/characters/note-*.js`, `notes.js`, `server/note-connections.js` | Character editor, linked-note displays, card projections. |
| Attributes and derived power | `public/characters/attributes.js`, `attribute-controls.js`, `power.js` | Character profile and card dialogs. |
| Place ancestry | `public/locations/data.js`, `server/countries.js` | Location routes, profiles, cards, dashboard. |
| Story-date interpretation | `public/profiles/dates.js` | Date picker and timeline. |
| Timeline derivation/view math | `public/timeline/model.js` | Timeline/dashboard routes and timeline browser controller. |

## Workspace shell

### `workspaceShell(html, path)`

Source: [server/workspace-shell.js](../server/workspace-shell.js).

This synchronous function accepts a full HTML document and request pathname and returns an HTML string. It adds the sidebar, topbar search, `.workspace-canvas`, and `.workspace-page`, plus stylesheet and script tags. It performs no fetching or authentication.

It leaves input unchanged when it lacks `<body` or already contains `data-app-shell`. The latter marker prevents double wrapping. The implementation uses string replacement and expects the project's normal lowercase `<body>`, `</head>`, and `</body>` structure; it is not a general HTML parser.

Active navigation is selected by path prefix; `/` and `/index.html` use the Dashboard section. Canonical `/locations/.../` profiles therefore keep Locations active. Add navigation entries to the shell's `sections` definition instead of copying a sidebar into each page.

### Shell browser contract

`public/workspace-state.js` runs as a classic script in the head to restore `data-sidebar` before layout. It reads `wtf-sidebar-collapsed` from localStorage and tolerates blocked storage. This is a device presentation preference, not stored novel content.

`public/dashboard/workspace.js` is a shared page-lifetime controller despite its directory name. It assumes shell elements already exist, including:

| Hook | Role |
| --- | --- |
| `#novel-search`, `.workspace-search` | Query input and shortcut display. |
| `#search-results`, `#search-list`, `#search-status` | Results, accessible status, and result links. |
| `.sidebar-toggle`, `#workspace-sidebar` | Navigation expansion and focus behavior. |
| `document.documentElement.dataset.sidebar` | Persistent desktop expanded/collapsed state. |
| `document.documentElement.dataset.mobileNav` | Temporary mobile drawer state. |

Search loads `/api/dashboard` lazily on input/focus, caches the catalog in module memory, and retries after a failed load. `updateWorkspace(data)` lets the dashboard provide its already-fetched catalog. A `workspace:changed` event invalidates the cache after an in-page save. `searchCatalog(data, query)` searches characters, factions, locations, and standalone Lore using all query terms; the UI shows at most 50 results. Lore includes authored field text in its search projection; embedded character notes are searched within the Lore dashboard. Workspace search does not scan every character field or timeline event.

Desktop collapse persists across navigation and storage events. Mobile expansion is independent and closes on Escape, outside clicks, and breakpoint changes. The controller installs document/window listeners once and has no teardown API; do not initialize duplicate copies on the same page.

## Server-rendered profile components

Source: [server/profile-components.js](../server/profile-components.js). These functions return strings and do not query storage or attach browser listeners.

### Escaping and trusted inputs

- `escape(value)` converts nullish values to empty text and escapes HTML text/attribute characters.
- `jsonData(value)` serializes embedded JSON and escapes `<`, `>`, and `&` so user text cannot terminate the JSON script element.
- Field keys, section IDs, route prefixes, script/style paths, and supplied markup fragments come from developer-controlled templates. They are not automatically safe destinations for arbitrary user strings.
- `renderFieldWrapper`, `renderSection`, `renderInfoGroup`, and `renderProfilePage` accept already-rendered HTML fragments. Escape user text before interpolating it into these fragments; escaping a label does not sanitize an entire fragment.

### Function-level contracts

| Function | Inputs and output | Extension constraints |
| --- | --- | --- |
| `renderFieldWrapper(record, key, label, type, control)` | Wraps control HTML with a label, `data-profile-field`, and saved visibility. | Choice labels target `choice-{key}`; other labels target `field-{key}`. Hidden controls stay mounted. |
| `renderChoice(key, label, val, attrs, context)` | Hidden named input, single/multiple selection UI, custom editor; optional continent context. | `key` must exist in `profileChoices`; `attrs` is trusted attribute markup. Multiple values serialize with ` · `. |
| `renderDateControl(key, label, val, attrs)` | Read-only text input marked `data-date-input`, plus picker icon. | Uses shared `profile-date-picker`; read-only input is edited through the picker. |
| `createFieldRenderer(record, config)` | Returns a renderer for `[key, label, type]` tuples. | Config provides `options`, `required`, and linked-profile prefixes. `options` should return a fresh array because the renderer can append a preserved custom value. |
| `renderSection(section, content, record, options)` | Article section, collapsible heading, optional visibility menu and create-note button. | Stable section IDs define `aria-controls`, body IDs, and deep links. `menuFields` can differ from rendered fields. |
| `renderInfoGroup(title, id, content)` | Collapsible group inside the infobox. | ID is the controlled region's stable identifier. |
| `renderProfileName(record, type, { official })` | Name heading and `#edit-name` focus button. | Official names use `#official-heading`; normal names use `data-display-name`. |
| `renderProfilePage(config)` | Full HTML document with form, save bar, infobox, article, footer and initial JSON. | Does not add the workspace shell; outer Worker does that. One profile form is assumed per page. |
| `renderRatingsHost(groups, sectionId)` | Client mount for rating groups assigned to an existing article section. | The first assigned group supplies the stable `#ratings` card-menu target. |

`renderProfilePage` requires `record`, `type`, `collection`, `collectionUrl`, `infobox`, `content`, and `script`; optional `styles`, `initial`, and `boxClass` customize it. `initial` defaults to the record. It includes shared profile/editor/date-picker styles and the entity script with `profileRevision` query values. The revision is an asset URL/cache marker, unrelated to a persisted document's optimistic `version`.

### Markup is an interface

Browser editors depend on these exact hooks:

| Hook | Contract |
| --- | --- |
| `#profile-form[data-id][data-version]` | Entity identity and initial write version. |
| `#editor-fields` | Fieldset disabled during shared-editor saves. |
| `#save-character`, `#save-status`, `#editor-error` | Shared save button/status/error; historical character naming is intentional compatibility. |
| `#profile-data` | Safely serialized initial JSON for entity-specific consumers. |
| `#edit-name`, `[data-display-name]` | Name editing focus and live display updates. |
| `[name="fieldName"]`, `#field-{key}` | Serialization and stable deep-link anchors. |
| `[data-collapse-target]`, `.collapsible-region` | Accessible section/infobox disclosure. |
| `[data-profile-field]`, `[data-visibility]` | Saved visibility controls mapped to mounted fields. |
| `.choice-control`, `[data-choice-field]` | Choice initialization and separate serialized values. |
| `.article-bar`, `.current-view`, `.profile-content`, `.infobox` | Sticky reading layout and active heading. |
| `[data-image]`, `[data-image-error]` | Preview and failure feedback for configured image fields. |

Renaming a hook is an interface change spanning server markup, CSS, browser controls, and tests. Entity-specific classes extend the shared layout; they should not duplicate the page skeleton.

## Entity composition and editor adapters

### Renderers

`renderFaction`, `renderCountry`, and `renderCity` configure `createFieldRenderer`, compose infobox and article sections, append derived linked notes, and delegate the complete document to `renderProfilePage`. Their adapters choose valid option lists: faction founders/leaders from the cast, country cities from that country's locations, and city parents from countries.

`renderProfile` for characters uses the same shared primitives but retains specialized field composition, relationship controls, attributes, and authored notes. Its `initial` JSON contains `character`, `locations`, `noteTargets`, `noteBacklinks`, a compact `{ id, name }` cast, and factions. It is intentionally richer than the ordinary record embedded in the other profiles.

Renderers receive already owner-scoped data from routes; they do not authenticate or persist. UI option restrictions supplement server validation and cannot replace it.

### Shared location registry and renderer

`public/locations/template.js` holds the eight location templates other than country/city. The registry derives field names, blank defaults, hideable article fields, image fields, infobox groups, and timeline mappings from each type's definition. `server/render-location.js` uses the same shared HTML primitives as country/city profiles and lists immediate children by type. `public/locations/profile.js` configures the shared editor once using the embedded record's immutable type. Parent options come from the existing hierarchy helpers; ancestry and child links use `locationHref`.

`locationProfileGroups` produces the eight defaulted groups for dashboard questions, timeline events, and character mentions. Saved detail content already arrives through the owner-scoped location catalog. All ten location types share `locationPaths`/`locationHref` for directory rows, note targets, featured connections, derived cards, and source links.

### Story arc profiles

`public/story-arcs/template.js` defines the shared arc fields, three guided questions for each of the six narrative beats, drafting metadata, and default tension/pace/action values. `server/render-story-arc.js` composes these into the standard profile shell: logistics and linked key entities stay in the right infobox, while the central article begins with an editable SVG pacing graph followed by collapsible beat, stakes, subplot, scene, and question sections. `public/story-arcs/profile.js` owns the pacing projection and the dynamic connected-arc and key-scene rows, then passes their serialized values through `initProfileEditor.readExtra()`.

Story arc documents are owner-scoped and versioned in `story_arcs`. Start and end dates use the shared story-date picker and feed the derived global timeline. Arc titles, summaries, dates, type, and status are included in workspace search.

### `initProfileControls(form, markDirty, options)`

Source: [public/profiles/controls.js](../public/profiles/controls.js).

Call once per profile form. It initializes the date picker, choices, disclosures, field visibility, name focus, hash reveal, validation reveal, textarea sizing, and reading viewport. It returns:

| Property | Meaning |
| --- | --- |
| `choiceValues` | Map of serialized strings for choice fields. |
| `commitChoices()` | Commits pending custom editors; returns false when a value cannot be committed. |
| `hiddenFields()` | Current unchecked visibility keys. |
| `revealAncestors(target)` | Opens collapsed ancestor regions/details for navigation or validation. |

Options select the name input (`nameField`, default `name`) and pass the mutable `nationalityContinents` map used by custom nationality choices. Character editing uses `firstName` for name focus.

Visibility changes mark the draft dirty through form events or explicit callbacks. Normal hash reveal opens collapsed ancestors but does not generally force a saved hidden field visible. Validation and authored-note source navigation have explicit reveal paths that can change visibility. Derived links to hidden question/mention fields omit the field hash so navigation does not silently undo an author's preference.

The initializer installs page/global listeners and observers indirectly and does not return a destroy function. Its lifetime is the document's lifetime, not repeated rendering into a single-page application.

### `initProfileEditor(config)`

Source: [public/profiles/editor.js](../public/profiles/editor.js).

The faction, country, city, Lore, and shared location profile scripts pass `fieldNames`, API collection `endpoint`, singular `type`, and optional `imageFields`/`validImageUrl`. The initializer reads the page's form hooks, calls shared controls, and holds `version`, `dirty`, and `saving` in its closure. It returns no controller object. An optional `readExtra()` hook serializes domain-specific controls before the request. An optional `onSaved(data)` callback receives the successful response; the shared location adapter uses its derived ancestry to refresh navigation without reloading.

`ratingGroupsFor(kind, type)` selects a declarative rating definition. Each group names the existing article section that owns it. `initProfileRatings(record, groups)` distributes the common 0–99 dial controls across those section hosts while retaining one draft and returns a `readExtra()` compatible function. Location definitions distinguish inhabited places, cosmic places, and landmarks; Lore definitions distinguish notes, objects, and species. Route handlers validate allowlisted integer values from 0 through 99 and preserve saved ratings when an older client omits the property.

Submit commits custom choices, checks native validity, serializes configured fields plus `hiddenFields` and `version`, disables editing, and sends PUT to `endpoint + '/' + form.dataset.id`. It verifies JSON responses, retains the returned version, updates names/links, and clears dirty state only after success. Errors preserve field values. Finally it restores the controls. Ctrl/Cmd+S submits and `beforeunload` warns for unsaved changes.

The character adapter implements its own save flow because it also serializes relationships, notes, nationality-continent assignments, and attribute ratings, and coordinates inline faction creation. It uses the same controls and page hooks. A new shared save behavior must be reviewed in both save implementations.

## Reusable story cards

Canonical shell: [public/components/story-card](../public/components/story-card). Character-specific behavior is documented in [public/components/character-card](../public/components/character-card/README.md).

`story-card/card.js` owns the complete card frame: safe artwork, deterministic tones, title hierarchy, context row, consistent action sizing, accessible labels, and the overflow menu. The native disclosure menu closes after an action and supports Escape with focus restoration. `story-card/profile-card.js` adapts profile-backed records and provides section links in both the footer and menu. Domain adapters supply content and callbacks while the component retains the interaction chrome.

Character, faction, location, Jewel, and Species cards use the complete shell. Notes retain their review-card composition, and Artifacts, Books, and Relics retain their media-specific landscape or cover proportions; all use the shared action and menu primitives. `character-card/frame.js` and `character-card/card.css` are compatibility entry points.

### Data preparation

`server/character-card-data.js` owns derived card data, not DOM markup:

| Function | Responsibility |
| --- | --- |
| `characterCardDetails(character, context)` | Artwork, alignment, attributes, default/featured affiliation, enriched relationships and mentions. |
| `characterMentions(character, profiles, options)` | Own notes when enabled, name mentions in textarea fields, explicitly linked character notes, and relationship prose. |
| `cardConnectionOptions(character, context)` | Available character/faction/location/note/lore references, labels, links, and images. |

Default affiliation prioritizes faction, then citizenship or residence-derived country, then free-text affiliation/Independent. `cardConnection` overrides presentation only; it does not change membership or citizenship. References resolve by stable IDs, and missing featured targets fall back to automatic affiliation.

Use `/api/characters?view=cards` or dashboard `characters` for cards. Ordinary character relationships contain `{ targetId, type, description }`; card relationships are one record per connected person with nested directional details. The two shapes are not interchangeable.

### `createCharacterCard(data, options = {})`

This DOM factory returns an `HTMLElement` (`article.story-character-card`). The shared `createStoryCardFrame` in `public/components/story-card/card.js` owns its artwork, title, detail row and action footer; the Character adapter supplies power, affiliation and dialog actions. The Lore and profile adapters reuse that frame and canonical CSS. The adapter normalizes input, assigns a stable ID-based tone, and builds character-specific content. Mounting the card performs no API request; remote image elements may load their URLs.

| Option | Meaning |
| --- | --- |
| `headingLevel` | Exactly `2` selects h2; all other values currently use h3. |
| `tone` | Optional allowlisted `clay`, `jade`, `blue`, `violet`, or `gold`. |
| `onAction(view, record)` | Replaces built-in dialog handling for all action views. |
| `onUpdate(record)` | Called after a built-in dialog saves and the mounted card refreshes. |

Views are `morality`, `relationships`, `mentions`, `attributes`, and `connection`. The fifth is triggered by the featured-item portrait, outside the four-action footer. `onAction` takes over dialog/update responsibility; the factory does not automatically save custom actions.

The factory holds its own normalized record. A built-in save merges returned card state and replaces the original article's children, preserving the article node and its stable ID/tone. There is no public `update()` or `destroy()` method. Hosts that replace catalogs should recreate cards or maintain state through `onUpdate`; do not assume an event bus synchronizes every mounted instance.

Include both `card.css` and `details.css` for default dialogs. Card selectors are scoped to `.story-character-card`; the host owns rail/grid layout. CSS variables control width/height. Legacy `public/dashboard/character-cards.js`, `character-cards.css`, `connections-map.js`, and `connections-model.js` are compatibility adapters/imports; new consumers should use canonical component modules.

### Dialog ownership and save flow

`openCharacter(record, view, onUpdate)` in `details.js` owns one active dialog at module scope. It appends to `document.body`, records the opener, manages dirty/saving state, restores focus on close, removes its unload listener, and clears the active-dialog guard. It returns no public dialog handle.

| View | Data source | Persistence |
| --- | --- | --- |
| `mentions` | Existing card `mentions` | Read-only; no refresh request on open. |
| `relationships` | Fresh `/api/characters?view=cards` | Read-only interactive connections map. |
| `connection` | Fresh item `?view=connections` | PUT the plain `character` with new `cardConnection`. |
| `morality` | Fresh ordinary character item | PUT document with new alignment. |
| `attributes` | Fresh ordinary character item | PUT document with ratings and portrait URL. |

Editable dialogs spread the fetched document into the update, preserving its version and unrelated fields. They do not save the enriched card projection. Conflict errors remain visible in the dialog with the draft retained. Alignment/featured-item dialogs close after success; attributes remain open. Closing a dirty dialog asks whether to discard the unsaved changes.

### Graph and attributes

`connectionGraph(characters, focusId)` accepts rich card records, deduplicates undirected edges while retaining directional details, and returns only the connected component reachable from the focused character. `layoutConnections(graph, focusId)` adds deterministic initial/relaxed coordinates. `createConnectionsMap` returns an interactive DOM subtree with SVG pan, zoom, dragging, selection, and accessible detail controls. These transformations do not write relationships or store graph positions.

`createAttributeControls(draft, markDirty, selectedGroups)` mutates the supplied ratings draft and calls the dirty callback. The profile and dialog own persistence. `characterPower` derives a capped score from the 20 ratings; it is not a saved field. Missing ratings result in provisional display, so consumers must retain the accompanying status rather than displaying a score as complete.

## Notes, links, and source anchors

Character notes, including existing notes with the `lore` type, live in the character document. Standalone Lore entries have separate `/api/lore` endpoints and `lore_entries` storage. The Lore dashboard can display both while preserving the character notes’ original identities and save boundaries.

| Module / function | Boundary |
| --- | --- |
| `notes.js`: `validateNotes`, `cleanNoteReference`, `referenceKey`, `moveNoteAnchors` | Model validation, canonical references and source-position adjustments; shared with server where appropriate. |
| `note-content.js` | Structured content/plain text conversion and unique linked references. |
| `note-editor.js`: `initCharacterNotes` | Source placement, composer lifecycle, marker renumbering, local draft/list rendering. |
| `note-connections.js`: `createNoteConnections` | Picker metadata, structured links, and rendered linked note details. |
| `inline-note-editor.js` | Browser rich-text editing and conversion to structured pieces. |
| `create-note-item.js` | Creation actions offered from the note composer. |
| `server/note-connections.js` | Catalog targets, explicit backlinks, linked-note HTML, and reference validation. |

`initCharacterNotes` returns `{ notes, readyToSave() }`. The parent character editor includes that notes array in its normal PUT payload. `readyToSave()` blocks profile saving while the composer is open and stops an unfinished placement mode otherwise. Adding a note does not by itself issue a character save.

Composer creation of characters, factions, places, and standalone Lore uses their API endpoints and persists those entities immediately. Creating another character note within the composer adds to the current character draft and still requires saving the character. Do not present every composer action as having the same persistence boundary.

Source markers `[1]`, `[2]`, etc. are positional references into textarea fields. Editing text moves anchors where possible; an invalidated anchor becomes unplaced instead of deleting the note. Removing notes renumbers later markers while updating positions. Preserve stable note UUIDs separately from displayed numbering.

`noteTargets` derives available references from the owner's cast/factions/locations, standalone Lore, and character notes. `connectedNotes` derives explicit backlinks. `validateNoteConnections` rejects newly selected unavailable targets and self-note links while allowing existing unresolved links to survive edits. Card mentions additionally use textual name matching; explicit backlinks and inferred mentions are different projections.

## Dates, reading viewport, and timeline

`createDateControl(options)` creates the standard read-only input and calendar trigger for dynamically rendered interfaces. `initDatePicker(root, options)` attaches one shared date dialog to every `data-date-input` beneath a form, dialog, or other root. It dispatches input/change events into the owning draft and returns a controller with `destroy()` for dynamic overlays; it does not write to an API. Server-rendered profiles use the matching `renderDateControl` markup. `datePickerPlacement` is pure placement math suitable for unit tests. Date parsing and formatting live in `dates.js` so picker output and timeline interpretation share precision and BCE rules. All editable story-date fields use this control rather than a plain text or native date input.

`initProfileViewport(form)` observes headings, the sticky bar, content, and infobox. It schedules layout updates with animation frames, updates `--profile-header-height`, toggles `.profile-reading`, and animates the current heading with reduced-motion handling. It registers window/form listeners and a `ResizeObserver` but exposes no teardown API. `sectionAtHeader` is the pure selection helper tested independently.

The timeline page controller owns its filters, viewport, DOM virtualization, refresh requests, and user gestures. `workspace-events.js` announces successful saves to the current document and other same-origin tabs using a content-free storage revision; the timeline also refreshes on `pageshow`, focus, and visibility restoration. The shared model owns `collectTimeline`, filtering, row grouping, anchored zoom, fitting, and ruler density. Keep new rendering behavior out of the server projection, and keep new date semantics out of one-off browser handlers.

## Lifecycle inventory

| Module | State lifetime | Cleanup contract |
| --- | --- | --- |
| Workspace controller | Document | No teardown; import once in shell. |
| Profile controls/editor/viewport/picker | Document/form | No public teardown; initialize once. |
| Character card | Mounted article and closure | No public teardown; local event handlers leave with nodes. |
| Card dialog | One open dialog | Close removes DOM/unload listener and restores focus. |
| Connections map | Returned subtree | No public teardown; interactions belong to subtree. |
| Question banner | Mounted banner with timers/observers | Returns `{ element, destroy }`; call `destroy()` before replacing. |
| Dashboard shell controller | Document plus replaceable views | Disposes banners/rails, queues refresh, preserves slots, aborts reads and removes shell listeners on destroy. |

Question rotation pauses according to reduced motion, visibility, hover/focus, and explicit controls. It owns timers, animations, an intersection observer, and document/media listeners; omitting `destroy()` leaks work after a dashboard refresh. This explicit cleanup contract is not present on every other initializer.

## Extending without duplicating responsibilities

For a new field, change the entity template/defaults, its renderer and validation, visibility allowlist, and serialization as required. Verify old documents and samples as well as fresh records. Reuse shared field primitives so deep links, choices, date controls, and visibility keep working.

For a new profile type, supply a renderer composed from shared profile functions, an owner-scoped handler, a template, and an appropriate browser adapter. Use `initProfileEditor` only if its assumptions fit the new entity. Add the route before static fallback and let the outer Worker add navigation. Avoid adding a second profile form to an existing page without first removing singleton DOM-ID assumptions.

For a reusable visual component, define its data shape, returned DOM or HTML, state ownership, callbacks, CSS scope, network effects, and cleanup. Put cross-page components under `public/components/` or their established shared module. For searchable collection pages, use the complete [directory shell](directory-shell.md). For dashboards, use the complete [dashboard shell](dashboard-shell.md) for headings, status, rails and lifecycle; page adapters retain filtering and domain actions. For a new action that writes, start from a fresh plain document and preserve optimistic concurrency.

Verify server rendering and save/reopen in `tests/profile-standard.test.mjs`, shared navigation in `tests/workspace-shell.test.mjs`, card behavior in `tests/character-cards.test.mjs`, graph math in `tests/connections-map.test.mjs`, notes in `tests/cursor-notes.test.mjs`, and dashboard/search in their dedicated suites. These are Node tests and DOM stubs where used; visual behavior, focus, and responsive layout still need browser verification when those behaviors change.


## Lore dashboard and profile adapters

`server/dashboard-pages.js` configures Home and Lore through `renderDashboardPage`. The shared browser shell owns `createRails()` and `createQuestionBanner` instances, status, retry, refresh and disposal. Its required stylesheet includes the dashboard theme and canonical card/dialog dependencies in order. Lore adds its capture/filter/dialog styles, and follows Home’s question-banner-then-rails composition. All six collection rows remain visible when empty, with type-specific creation actions. Search and quick-note drafts occupy a persistent toolbar; View all filters the replaceable rows. See the [complete shell contract](dashboard-shell.md) before adding another dashboard.

`public/lore/dashboard.js` loads `/api/lore`, filters six collection projections, captures quick notes, and creates named entries. Collection rows sort pinned entries first, then by most recent save. Featured entries use an explicit profile flag. Quick-note creation uses a retained UUID for safe retries and clears text only after confirmed persistence. Existing character notes link back to their original character anchors. Quick capture expands on demand and retains its draft when collapsed. Questions and all six collections remain visible when empty; featured entries appear when present.

`noteCard(record)` in `public/dashboard/components.js` owns the shared Notes presentation, with styling in `public/components/note-card/card.css`. Three independent regions match the review-card proportions: a 144px image/excerpt preview with its title at the bottom, a 53px source/date row with an ellipsis disclosure, and a 48px icon-action row. The outer article contains separate links for reading, pin/feature settings, and the actual connection count. The menu stays inside the card and closes on Escape. Dispatch on `type === 'note'` for both standalone and character notes. Home, Lore collections, featured entries and filtered results use this renderer. Preserve each character note’s original anchor for its actions; only standalone notes show their own updated date, since character notes have no independent save timestamp.

`loreEntryCard(record, { collection })` centralizes presentation selection for Home and Lore, including featured and filtered rows. Notes use `noteCard`. Explicit Books and Relics shelves use `bookCoverCard`; explicit Artifacts shelves use `artifactCard`; explicit Jewels and Species shelves use `createLoreCard`. Mixed rails choose the shared story frame for primary Jewels and Species, portrait covers for primary Book/Relic types, then landscape tiles for artifacts and other entries included in Artifacts. The same entry retains its name, actual type and profile URL on every shelf. Its shared stylesheet, `public/components/artifact-card/card.css`, provides 280px landscape tiles with 16:9 artwork, a badge showing the real entry type, a decorative gold accent, and a separate name/summary caption. HTTPS images and failed-image fallbacks reuse `cover()`. Other Lore types retain their existing cards.

`bookCoverCard(record)` uses `public/components/book-cover-card/card.css`: 165px-wide, 2:3 covers with 4px corners, a separate single-line title and muted type/status caption, HTTPS images and the shared failed-image monogram. Full titles remain available to assistive technology and on hover. Lore marks its Books/Relics collection rows with `book-cover-shelf` for 30px gaps; scrolling, arrow states and disposal stay in the shared rail. Filtered collection results preserve that shelf format, while Home, Featured and unscoped search use primary-type dispatch. Empty collections keep their real creation action without fabricated entries.

`createLoreCard(record)` in `public/components/lore-card/card.js` uses the same `createStoryCardFrame` and character-card CSS as Home’s characters. It supplies real type/pin/feature metadata, image/name, a description row, and links to pin/feature settings, the actual connection count, story significance and the full Lore profile. Jewels and Species share this component, with a gem or sprout icon and their actual type label. Its minimal stylesheet only adapts these icons and narrow-screen width. The former `jewel-card` paths remain compatibility exports/imports. It performs no writes or character-dialog actions, and its common profile anchors work for other object types placed on the Jewels shelf.

`public/lore/template.js` is the field/default/visibility authority for all six Lore types. `renderLore` composes the existing infobox, article sections, image controls, dates, and save bar. The Lore adapter configures `initProfileEditor`; its `readExtra()` hook serializes collections, pin/feature choices, and typed connections before the shared save begins. The shared editor owns version, dirty state, errors, draft retention, and save shortcuts. Connection search is temporary UI state and must not mark the document dirty.

One object may appear on multiple collection shelves without creating additional records. `noteTargets` exposes its single stable Lore reference; `connectedNotes` adds incoming Lore connections to existing character-note backlinks. Character note composers can create a standalone Lore entry immediately, but adding the reference to the current character remains part of the character’s explicit save.
