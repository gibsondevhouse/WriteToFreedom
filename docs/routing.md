# Routing and request contracts

Novels, series, and collections have HTML directories and profiles at `/novels/`, `/series/`, and `/collections/`. Private JSON routes live under `/api/novels`, `/api/series`, `/api/novel-associations`, `/api/collections`, and `/api/library`. HTML dispatch is limited to indexes and UUID profile paths so adjacent JavaScript/CSS assets reach the static fallback. The outer Worker validates optional novel catalog context, filters declared links, enhances canonical profiles with separately edited appearances, and applies the workspace shell once. See [novels and collections](novels-and-collections.md) for scope and write contracts.

Chapters/Scenes add public workspace shells at `/chapters/` and `/scenes/`, with private JSON data at `/api/chapters` and `/api/scenes`. Their item reads and versioned mutations are owner-scoped through `server/writing-routes.js`; scene catalogs exclude prose. See [writing workspace](writing-workspace.md) for the full schema, size limits and request contract. These routes are dispatched before existing domain handlers and the static-asset fallback.

This guide describes the routing implemented in `server/`, including dispatch order, dependencies, mutation boundaries, and current edge cases. Start with the [developer README](../README.md) for setup and the [component guide](components.md) for rendering and browser behavior. Comments beside the functions summarize these contracts without changing runtime behavior.

## Entry points and layers

| Function | Source | Responsibility |
| --- | --- | --- |
| `createWorker(assets)` | [server/app.js](../server/app.js) | Public Worker factory; wraps HTML responses with shared workspace navigation. |
| `createAppWorker(assets)` | [server/app.js](../server/app.js) | Internal ordered dispatcher; owns redirects, character handling, and static asset fallback. |
| `renderDashboardPage(config)` | [server/dashboard-shell.js](../server/dashboard-shell.js) | Complete public dashboard frame from registered page definitions; data loads through private APIs. |
| `renderDirectoryPage(config)` | [server/directory-shell.js](../server/directory-shell.js) | Complete public directory frame from registered page definitions; data loads through private APIs. |
| `validate(input, current)` | [server/app.js](../server/app.js) | Builds a character document and validates its shape; throws validation errors for the caller to return as `400`. |
| `factionRoute(request, env)` | [server/faction-routes.js](../server/faction-routes.js) | Faction collection, profile JSON, and profile HTML. |
| `locationProfileRoute(request, env)` | [server/location-profile-routes.js](../server/location-profile-routes.js) | Shared full profiles for the eight location types other than country/city. |
| `locationRoute(request, env)` | [server/location-routes.js](../server/location-routes.js) | All location creation/listing and directory-editor updates. |
| `countryRoute(request, env)` | [server/country-routes.js](../server/country-routes.js) | Existing country profile reads, rendering, and updates. |
| `cityRoute(request, env)` | [server/city-routes.js](../server/city-routes.js) | Existing city profile reads, rendering, and updates. |
| `dashboardRoute(request, env)` | [server/dashboard-routes.js](../server/dashboard-routes.js) | Authenticated, read-only dashboard aggregation. |
| `loreRoute(request, env)` | [server/lore-routes.js](../server/lore-routes.js) | Standalone Lore collection/item JSON and profile HTML. |
| `storyArcRoute(request, env)` | [server/story-arc-routes.js](../server/story-arc-routes.js) | Story arc collection/item JSON and profile HTML. |
| `timelineRoute(request, env)` | [server/timeline-routes.js](../server/timeline-routes.js) | Authenticated, read-only story-event derivation. |

`assets` is an object whose keys are URL paths and whose values are `{ content, type }`, populated by the build script. `env.DB` is the D1-compatible binding. All request handlers return a Web `Response` through an asynchronous `fetch` call. The outer factory forwards `ctx`, but the internal dispatcher currently uses only `request` and `env`.

Request flow:

```text
build.mjs -> embedded asset map -> createWorker(assets)
                                      |
                                createAppWorker.fetch
                                      |
                 redirects / domain routes / static fallback
                                      |
                         Response (HTML, JSON, or text)
                                      |
                  HEAD or non-HTML? return response unchanged
                                      |
                  workspaceShell(html, requested pathname)
                                      |
                       reconstructed HTML Response
```

The shell wrapper preserves response status and headers except `content-length`, which becomes invalid after changing the body. It reads the entire HTML response as text; this is not a streaming HTML transform. It does not authenticate, query the database, or intercept JSON errors.

## Dispatch order is part of the contract

The dispatcher checks the dashboard and directory page registries first, then uses sequential conditionals for domain routes. The first matching branch wins. The following table follows source order; read it before adding a broad prefix match.

| Order | Match | Action |
| --- | --- | --- |
| 1 | Registered dashboard alias (`/`, `/index.html`, `/dashboard/`, `/dashboard/index.html`, `/lore/`, `/lore/index.html`) | GET/HEAD render the shared frame; other methods return `405`. |
| 2 | Registered dashboard without its trailing slash | GET/HEAD receive `308`, preserving the query string. |
| 3 | Registered directory alias (`/characters/`, `/factions/`, `/locations/`, `/story-arcs/`, and their `index.html` aliases) | GET/HEAD render the shared directory frame; other methods return `405`. |
| 4 | Registered directory without its trailing slash | GET/HEAD receive `308`, preserving the query string. |
| 5 | `/locations/countries/{sample-kingdom or UUID-shaped ID}` without trailing slash | `308` to the slash form. |
| 6 | `/locations/countries/{any single segment}/` or prefix `/api/countries/` | Delegate to `countryRoute`. |
| 7 | `/locations/cities/{sample-capital or UUID-shaped ID}` without trailing slash | `308` to the slash form. |
| 8 | `/locations/cities/{any single segment}/` or prefix `/api/cities/` | Delegate to `cityRoute`. |
| 9 | A shared location profile path without trailing slash | `308` to the slash form, preserving its query string. |
| 10 | A shared location profile path with slash or `/api/locations/{id}` with optional slash | Delegate to `locationProfileRoute`. |
| 11 | `/lore/{UUID-shaped ID}` without trailing slash | `308` to the slash form, preserving the query string. |
| 12 | `/lore/{id}/`, exactly `/api/lore`, or `/api/lore/{id}` with optional slash | Delegate to `loreRoute`. |
| 13 | `/story-arcs/{UUID}` without a slash, `/story-arcs/{id}/`, exactly `/api/story-arcs`, or `/api/story-arcs/{id}` | Redirect the page form or delegate to `storyArcRoute`. |
| 14 | Exactly `/api/timeline` | Delegate to `timelineRoute`. |
| 15 | Exactly `/api/dashboard` | Delegate to `dashboardRoute`. |
| 16 | Exactly `/api/locations` | Delegate to `locationRoute`. |
| 17 | `/characters/edit/` or `/characters/edit/index.html` | Read query `id`; `302` to its profile if syntactically supported, otherwise the directory. |
| 18 | Supported character ID without slash, optionally followed by `/index.html` | `308` to `/characters/{id}/`. |
| 19 | Supported faction ID without slash, optionally followed by `/index.html` | `308` to `/factions/{id}/`. |
| 20 | `/api/factions`, prefix `/api/factions/`, or `/factions/{any single segment}/` | Delegate to `factionRoute`. |
| 21 | `/api/characters`, prefix `/api/characters/`, or a supported character profile path | Handle character requests inline. |
| 22 | Remaining requests | Static method gate, directory redirect, asset lookup, or `404`. |

Supported character samples are `claude`, `gpt`, `deepseek`, and `gemini`; faction samples are `sample-ember`, `sample-lantern`, `sample-archive`, and `sample-horizon`. Character IDs are checked against `idPattern` or known samples after API dispatch. The canonicalization regexes use the looser `[0-9a-f-]{36}` shape and do not prove record existence.

### Canonicalization and matching details

- `/api/countries` and `/api/cities` without a following slash are not collection handlers. Creation is through `/api/locations`.
- `/api/dashboard/`, `/api/timeline/`, and `/api/locations/` do not match their exact API routes.
- Country/city profile `/index.html` forms are not special-cased like character/faction profiles.
- API item handlers obtain IDs using `pathname.split('/')`. Some prefix-matched API paths with additional segments can consequently reach an item handler. There is no universal strict path-shape validator.
- Static directory redirects preserve `url.search`. Explicit entity and legacy-editor redirects construct new paths without preserving unrelated query parameters.
- Entity redirect checks occur before identity and method checks; dashboard redirects apply a GET/HEAD method gate first. A redirect response does not establish authorization or entity existence.
- Characters, Factions, Locations, and Story Arcs directories and their `index.html` aliases are generated from `directoryPages` through `renderDirectoryPage` before profile/static routing. They accept HTML `GET`/`HEAD`, reject other methods, and missing-slash redirects keep query strings intact. Their private collection APIs remain owner-scoped. See the [directory shell](directory-shell.md).
- Static fallback accepts `GET` and `HEAD` only. A slash-ended path maps to `path + 'index.html'`; a directory asset found at `path + '/index.html'` causes a `308`; otherwise unknown assets return text `404`.

These describe existing behavior, not a recommended pattern for new endpoints. Tightening path matching or changing redirect query handling is a separate behavior change and should receive request-level tests.

## Identity, validation, and error boundaries

Private handlers read `oai-authenticated-user-id` from the request. The trusted hosting layer establishes identity; route code never trusts an owner supplied in JSON. Local development replaces this header with `local-development-author`. Tests call the Worker directly to exercise separate owners.

Mutations check exact same-origin `Origin` and an `application/json` content type, then read and parse the request body. These checks are repeated in each domain handler; there is no shared authentication or mutation middleware. Do not assume changes to one handler update the others.

| Handler family | Request text limit | Notes |
| --- | --- | --- |
| Character | 180,000 | String length after `request.text()`. |
| Faction | 250,000 | Includes the complete submitted JSON document. |
| All location profiles | 550,000 | Images remain URLs, not uploaded bodies. |
| Location directory | 4,096 | Small name/type/parent payload. |

Expected failures return JSON `{ error }`, normally with `no-store` and `nosniff`. Invalid payloads/references generally return `400`, missing identity `401`, origin/content-type failures `403`, missing entities `404`, unsupported methods `405`, stale versions/conflicts `409`, and oversized text `413`. Storage or unexpected processing failures are logged and converted to generic `503` messages inside domain `try/catch` blocks. Not every response is JSON: missing character/faction HTML profiles and static failures can be plain text.

### Method and check-order differences

| Surface | Current method behavior |
| --- | --- |
| Static asset | `GET` body; `HEAD` headers with null body; other methods `405`. |
| Faction and location HTML profiles | `GET` body and `HEAD` null body; other methods `405`, subject to earlier lookup failures. |
| Character HTML profile | The matched profile branch renders before a method gate. It currently constructs HTML even for methods other than `GET`. |
| Collection/item JSON reads | `GET`; `HEAD` is not an alias for `GET`. |
| Dashboard/timeline JSON | Identity check, then GET-only method gate before database access. |

The outer `createWorker` skips shell injection for `HEAD`; it does not turn arbitrary inner responses into bodyless responses. In particular, the character profile branch does not implement the same explicit `HEAD` handling as the other profiles. Document consumers and route tests should not infer uniform behavior from one profile implementation.

Faction and location handlers load catalogs before most method checks. Country and city handlers check entity existence before their HTML/API method branches. When storage is unavailable or a target does not exist, that earlier failure may determine the status instead of a later `405` or `403`.

## Character routing in detail

### Local validation versus catalog validation

`validate(input, current)` builds from `blankCharacter()`, copies allowed template fields, and retains missing values from the current document. It composes structured names, supports legacy full-name updates, enforces field lengths and enumerated/numeric constraints, validates portrait URLs, and processes:

- `relationships`: required array, at most 100; each entry has `targetId`, `type`, and `description`.
- `nationalityContinents`: map of selected nationality names to continent IDs; unused nationality entries are removed.
- `notes`: validated by `validateNotes`, including structured note text and reference shapes.
- `attributeRatings`: validated by `validateRatings`.
- `cardConnection`: null or a cleaned reference.
- `hiddenFields`: allowlisted, deduplicated visibility preferences.

This helper does not access the database or validate the version. The inline `PUT` branch resolves actual factions, locations, characters, and note targets and then checks the integer version before calling `db.save`.

### Reads and projections

| Request | Dependencies and output |
| --- | --- |
| `GET /api/characters` | Owner's saved documents + `characterCast` samples + resolved faction names; `{ characters }`. |
| `GET /api/characters?view=cards` | Also loads locations and country/city profiles; uses `dashboardData(...).characters` to enrich the cast for shared cards. |
| `GET /api/characters/{id}` | Saved record or sample default, with resolved affiliation name. |
| `GET /api/characters/{id}?view=connections` | Returns `{ character, defaultAffiliationCard, options }` for the featured-item picker. Options derive from the owner's world. |
| `/characters/{id}/` | Loads cast, faction/place catalogs and country/city documents; derives external mentions with `includeOwn: false`; calls `renderProfile`. |

The cards projection overrides document properties such as `roles` and `relationships`: card roles are arrays, and relationships are enriched people with incoming/outgoing connection details. **A card response is not a writable character document.** Dialogs fetch the ordinary item response before making edits. The connections projection's `character` is the document to update; its sibling `options` are presentation data.

### Creation and saving

`POST /api/characters` accepts a UUID `id` and optional nonblank `name` of at most 160 characters. It creates a blank template, optionally puts the trimmed name into `firstName` and `name`, and returns the owned document with `201`. Other submitted fields do not initialize the document. Reusing the owned ID is idempotent.

`PUT /api/characters/{id}` proceeds through these boundaries:

1. Load saved document or sample default; return `404` if absent.
2. Run local `validate`; convert validation exceptions to `400`.
3. Resolve `factionId` and current affiliation name.
4. Validate custom nationality continent assignments and birthplace/residence/citizenship references.
5. Build the owner's cast and substitute the proposed document before computing note targets. This lets notes in the same submitted draft refer to each other.
6. Validate note links and the optional featured item. Existing unresolved references may be retained under the helper's compatibility rules; newly selected references must exist. A character cannot feature itself.
7. Reject self-relationships or targets absent from the owner's cast.
8. Require integer `version`, then call `db.save`; return updated document or `409`.

## Faction routing in detail

`factionRoute` selects an ID at path index 2 for HTML and index 3 for API calls. It loads `factionCatalog` once to find the current record.

- Collection GET returns `{ factions }`; item GET returns the selected document.
- HTML reads assemble an affiliation-resolved cast, then call `renderFaction`. Membership and linked notes are derived during rendering.
- POST `{ id, blank: true }` retries by ID or creates an unnamed catalog entry. POST `{ id, name }` normalizes whitespace and deduplicates names using NFKC plus locale-aware lowercasing. Both return `201`.
- PUT requires an existing record and integer version, builds a template document, validates visibility, HTTPS artwork, type/status choices, founder/leader references, and duplicate names, then calls `saveFaction`.
- Blank faction names remain valid during profile editing. Do not copy the country/city nonblank-name requirement into this handler as a documentation-only change.

`saveFaction` batches the versioned profile write with a guarded catalog rename. The stable ID carries memberships through renames.

## Location routing in detail

`locationRoute` owns `/api/locations`; it never renders a standalone profile. GET loads the catalog and cast and returns records enriched with explicit `linkedNotes` backlinks.

POST accepts `{ id, name, type, parentId }`, plus `areaType` for areas. Type and name validation precede the retry-by-ID return; parent validation follows it. The handler calls `createLocation`, then re-reads the catalog so response defaults and detail versions are consistent.

PUT accepts the same identity/type/parent fields and `version`. Countries and cities must be edited through their profile APIs. Other location types retain this endpoint for legacy basic edits; the current directory opens their full profiles. These basic writes preserve saved template fields and visibility. The type cannot change, the submitted version must match the catalog, and `saveLocationDetails` still performs a conditional database write.

Parent rules are centralized in `public/locations/data.js`:

| Type | Allowed parent types | Parent required? |
| --- | --- | --- |
| `universe` | None | No |
| `galaxy` | Universe | No |
| `solar-system` | Galaxy | No |
| `planet` | Solar system | No |
| `moon` | Planet | No |
| `continent` | Planet, moon | No |
| `country` | Continent, planet, moon | No |
| `city` | Country | Yes |
| `area` | City, area | Yes |
| `landmark` | City, area | Yes |

When an optional parent is supplied it must still pass type, ownership/catalog, and cycle checks. `parentChoices` excludes the current node and descendants. `ancestors` returns root-to-parent ancestry and defensively stops at repeats. Descendant ancestry is calculated from direct parents rather than copied into every record.

## Shared location profile routing

`locationProfileRoute` handles `/api/locations/{id}` (GET/PUT) and `/locations/{plural-type}/{id}/` (GET/HEAD) for universes, galaxies, solar systems, planets, moons, continents, areas, and landmarks. Country/city routes remain specialized. The dispatcher derives recognized plural paths from `locationPaths`, redirects missing trailing slashes with query strings preserved, and rejects type/path mismatches. The specific item handler runs before collection/static fallback.

The handler resolves an owner-scoped catalog record, merges blank template defaults, and validates immutable type, nonblank name, version, field sizes, hidden fields, HTTPS images, area subtype, optional character leader, and permitted parents. Universes reject parents; areas and landmarks require them. It reuses `saveLocationDetails`, whose versioned JSON write and guarded catalog rename/reparent execute in a batch. GET and successful PUT return the document plus derived `ancestry` entries (`id`, `name`, `href`); ancestry is never persisted. Old basic records and sample landmarks acquire full content through the same existing storage table, with no migration.

## Country and city routing in detail

Both handlers read the ID at path index 3 for their HTML and API forms, resolve a location of the correct type, load an editable document/default and the cast, and delegate rendering to their entity renderer. Neither creates locations.

Country updates validate nonblank normalized names, template fields, image URLs, visibility, optional world parent, capital/largest-city IDs belonging directly to the country, and an optional leader from the cast. `saveCountry` batches the versioned profile write with name and parent updates in the location catalog.

City updates additionally reject negative versions and compare the current version before field validation. They require a country parent. Before a move, the handler reads the original country's profile/default and rejects the move if this city remains its capital or largest city. `saveCity` batches the profile write and location rename/reparent.

A country read overlays a saved document onto defaults; a city read currently selects the saved document or defaults wholesale. Keep that distinction in mind when adding defaulted fields to older stored documents.

## Lore routing in detail

`loreRoute` serves GET/POST `/api/lore`, GET/PUT `/api/lore/{id}`, and GET/HEAD `/lore/{id}/`. Identity and method checks precede storage access. Item lookup is owner-scoped; unknown/private IDs return `404`. HTML HEAD returns no body. API HEAD and unsupported collection/item methods return `405`.

The collection GET returns `{ entries, notes, questions }`. Entries are standalone card projections; contextual notes are read-only projections of the owner’s character documents with original anchors. Item GET returns the writable Lore document. HTML rendering loads owner-scoped target catalogs and derives incoming links.

POST accepts a client UUID, an allowlisted primary type, a nonblank name, and template fields. An already owned ID returns its existing record with `201`, allowing safe retries. PUT requires a positive version; a stale version returns `409`, backed by a conditional repository update. Partial updates preserve omitted fields. Type and ID stay immutable. Collection membership must retain the primary collection and respect the note/species versus object collection rules.

Writes require same-origin JSON, cap the raw body at 550,000 characters, and validate fields, HTTPS images, visibility, boolean dashboard flags, and at most 60 unique connections. Each connection requires an owner-scoped target and a nonempty relationship of at most 160 characters; self-links are rejected. Previously saved unresolved links may be retained. Storage is `lore_entries`, introduced by additive migration `0007_red_sandman.sql`; no character note is moved or copied into it.

## Story arc routing in detail

`storyArcRoute` serves GET/POST `/api/story-arcs`, GET/PUT `/api/story-arcs/{id}`, and GET/HEAD `/story-arcs/{id}/`. Creation accepts a client UUID and writes the complete blank arc template so a new profile can open immediately. Item writes require same-origin JSON and the current positive version; conditional updates return `409` for stale drafts.

Validation allowlists scalar fields, arc type, drafting status, field visibility, every 0–99 pacing value, owner-scoped key entity references, unique connected arc IDs, and key-scene rows. A story arc cannot connect to itself or another owner's arc. Storage is `story_arcs`, introduced by migration `0008_slow_mandroid.sql`.

## Dashboard and timeline routing in detail

`dashboardRoute` and `timelineRoute` are GET-only and side-effect-free. Each loads saved characters, faction and location catalogs, country/city profiles, standalone Lore, and story arcs concurrently. Catalog helpers may issue additional reads; this is not a transaction or a guaranteed atomic snapshot.

`dashboardData({ characters, factions, locations, countries, cities, lore = [], storyArcs = [] })` is a synchronous, database-independent projection. It returns:

- `questions`: nonempty question fields split into prompts; hidden question fields link to the profile without a field hash.
- `characters`: rich shared-card records from `characterCardDetails`.
- `factions`: profile cards and derived member counts.
- `locations`: profile links for all ten types, with summaries, images, and ancestry labels.
- `lore`: one card per standalone entry, with collections, full authored search text and profile links.
- `storyArcs`: searchable arc records with type, drafting status, and date scope.
- `timeline`: the result of `collectTimeline` over the same profile catalogs, including Lore origin dates and story arc start/end dates.

`timelineRoute` calls `collectTimeline` directly and returns `{ events, unplaced, undated, counts }`. Both projections are derived on demand; neither writes a cache table. Dashboard shell search uses `/api/dashboard`, not a separate `/api/search` route.

## Tracing and extending a route

For a profile save, follow the browser adapter to its JSON endpoint, locate that endpoint in `createAppWorker`, inspect the domain handler's validation, then follow the repository call and renderer. For a derived display, inspect the aggregation helper before changing storage.

When adding a route:

1. Choose its exact paths and supported methods; decide whether it returns HTML, JSON, or redirects.
2. Place its dispatch branch before conflicting prefixes or static fallback.
3. State its identity, origin, body-size, validation, and version requirements beside the handler.
4. Keep owner-scoped SQL in `server/db.js`; validate references against owner-scoped catalogs.
5. Use shared renderers/components and let the outer Worker inject the workspace shell once.
6. Test method behavior, missing identity, another owner's IDs, malformed data, stale updates, redirects, and response shape as applicable.
7. Update the route inventory here and the API summary in the README.

Existing coverage lives in the domain test files, `tests/dashboard.test.mjs`, `tests/dashboard-search.test.mjs`, `tests/workspace-shell.test.mjs`, `tests/world-locations.test.mjs`, `tests/character-cards.test.mjs`, and `tests/cursor-notes.test.mjs`, and `tests/lore.test.mjs`. Coverage of a normal GET/PUT path should not be mistaken for exhaustive coverage of the matching and method edge cases listed above.
