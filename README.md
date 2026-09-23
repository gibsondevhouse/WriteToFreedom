# Write to Freedom

Write to Freedom is a novel-planning and worldbuilding application for maintaining a private cast of characters, factions, places, and a timeline derived from their story dates. It uses plain HTML, CSS, and browser JavaScript, with server-rendered entity profiles and a Cloudflare-compatible Worker backed by D1.

This README is the developer entry point: it describes how to run the project, how requests and data move through it, which modules own each behavior, and the constraints to preserve when extending it.

## Contents

- [Current scope](#current-scope)
- [Local setup](#local-setup)
- [Commands and development workflow](#commands-and-development-workflow)
- [Repository map](#repository-map)
- [Runtime architecture](#runtime-architecture)
- [Configuration and authentication](#configuration-and-authentication)
- [Persistence and migrations](#persistence-and-migrations)
- [HTTP routes and API contracts](#http-routes-and-api-contracts)
- [Domain rules](#domain-rules)
- [Shared profile system](#shared-profile-system)
- [Story dates and timeline](#story-dates-and-timeline)
- [Testing and verification](#testing-and-verification)
- [Common development changes](#common-development-changes)
- [Deployment integration](#deployment-integration)
- [Troubleshooting](#troubleshooting)

## Current scope

The implemented application includes:

- **Characters:** searchable and sortable directory, blank character creation, editable article profiles, structured identity fields, relationships, faction selection, and location references.
- **Factions:** directory, blank or named creation, editable profiles, character-linked founders and leaders, and membership derived from character faction selections.
- **Locations:** combined country/city/area/landmark directory, search and type filters, nested ancestry, editable country and city profiles, and a directory editor for areas and landmarks.
- **Timeline:** read-only visualization of saved profile dates, with filtering, pan/zoom controls, clustering, and links back to the source fields.
- **Shared profile controls:** explicit saving, version conflict handling, field visibility, collapsible sections, custom dropdown values where supported, and a precision-aware date picker.

Dashboard, Story Arcs, Chapters, Scenes, Story Beats, Lore, home-page global search, and Explore your novel are disabled placeholders. Areas and landmarks do not yet have standalone article profiles. The API does not expose entity deletion, and there is no offline persistence or automatic merging of conflicting edits.

The four sample characters are Claude, GPT, DeepSeek, and Gemini. These are fictional characters named after model families; their biographies, relationships, and affiliations are fiction. The repository does not call model APIs or require AI-provider credentials. The home-page artwork includes an original African-inspired white SVG crest in `public/crest.svg`.

## Local setup

### Prerequisites

Use **Node.js 22**, with npm; the documented build and test commands have been verified with Node 22.22.3 and npm 10.9.8. The development server and database-backed tests import `DatabaseSync` from `node:sqlite`, so your runtime must support that module without additional flags. Node may print an experimental SQLite warning even when everything is working.

Run all commands from the repository root. The build, migration loader, and test fixtures resolve paths relative to the current working directory.

### First run

```sh
npm ci
npm run build
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Useful entry points are:

- [Characters](http://127.0.0.1:4173/characters/)
- [Factions](http://127.0.0.1:4173/factions/)
- [Locations](http://127.0.0.1:4173/locations/)
- [Timeline](http://127.0.0.1:4173/timeline/)

`npm ci` installs the versions recorded in `package-lock.json`. Use `npm install` when intentionally changing dependencies, and commit the resulting lockfile changes with `package.json`.

No `.env` file, cloud login, D1 credentials, or database seed command is required for local development. The development server creates `.sites-runtime/development.sqlite`, applies the checked-in SQL migrations, and injects a fixed local author identity. Sample content is assembled from source modules when catalogs are read.

### Local data lifecycle

Local changes persist across server restarts in `.sites-runtime/development.sqlite`. This database is separate from hosted D1 data and is ignored by Git. All local browser sessions share the same development author and therefore the same records.

To start with a fresh local database while keeping a backup, stop the server and move `.sites-runtime/development.sqlite` to a safe location outside `.sites-runtime/`. Start the server again to create and migrate a new database. Stop the server before backing up or replacing the file. Do not delete the whole runtime directory as routine cleanup if you want to keep your local writing.

## Commands and development workflow

| Command | Purpose | Notes |
| --- | --- | --- |
| `npm ci` | Install locked dependencies | Recommended for a fresh checkout. |
| `npm run build` | Embed frontend assets and bundle the Worker | Writes `.sites-runtime/entry.mjs` and `dist/server/index.js`. |
| `npm run dev` | Start the local HTTP server and SQLite adapter | Requires a build; listens on `127.0.0.1:4173`. |
| `npm test` | Run all Node test files | Database fixtures use isolated in-memory SQLite. |
| `npm run db:generate` | Generate SQL migrations with Drizzle Kit | Reads `db/schema.ts`; writes SQL and metadata under `drizzle/`. |

There is currently no watch mode, hot reload, lint script, type-check script, or npm deployment script.

### Editing application code

The local server imports the built Worker, and that Worker contains a snapshot of the frontend assets. It does not serve the current `public/` directory directly. To see edits to frontend files or server code:

1. Stop the running development server with Ctrl+C.
2. Run `npm run build`.
3. Run `npm run dev` again.
4. Reload the browser page.

Rebuilding alone does not replace the Worker module already imported by a running Node process. New SQL migrations are also applied only when the development server starts.

### Running focused checks

```sh
# One domain's tests.
node --test tests/characters.test.mjs

# Related behavior across two suites.
node --test tests/locations.test.mjs tests/areas.test.mjs

# Shared profile behavior.
node --test tests/profile-standard.test.mjs tests/profile-viewport.test.mjs
```

Tests import server and shared source modules directly, so they do not require a prior build. A successful test run does not replace verifying that the production bundle builds.

## Repository map

```text
.
├── .openai/hosting.json          # Sites project linkage and D1 binding name
├── db/schema.ts                 # Drizzle definitions for persisted tables
├── drizzle/                     # Ordered SQL migrations and generator metadata
├── drizzle.config.ts            # SQLite dialect, schema path, migration output
├── public/
│   ├── index.html               # Home page and feature entry points
│   ├── styles.css               # Home-page styling
│   ├── crest.svg                # Home-page artwork
│   ├── characters/              # Directory, templates, seeds, character editor
│   ├── factions/                # Directory, template, profile adapter/styles
│   ├── locations/               # Directory, hierarchy helpers, location editor
│   │   ├── countries/           # Country template, profile adapter/styles
│   │   └── cities/              # City template, profile adapter/styles
│   ├── profiles/                # Shared controls, styling, dates, editor behavior
│   └── timeline/                # Timeline page, model, rendering and interaction
├── scripts/
│   ├── build.mjs                # Asset collection and esbuild bundling
│   ├── dev.mjs                  # Node HTTP server and local migration runner
│   └── sqlite-adapter.mjs       # D1-shaped adapter over Node SQLite
├── server/
│   ├── app.js                   # Worker factory, routing, character API, assets
│   ├── db.js                    # Owner-scoped repository and versioned writes
│   ├── *-routes.js              # Faction, location, country, city, timeline APIs
│   ├── render-*.js              # Entity-specific server-rendered profiles
│   ├── profile-components.js    # Shared profile HTML components
│   ├── sample-characters.js     # Sample character construction and cast merging
│   ├── factions.js              # Faction catalog and affiliation resolution
│   ├── countries.js             # Location catalog and default country profiles
│   └── cities.js                # Default city profiles
├── tests/                       # Node tests for routes, persistence and models
├── package.json
└── package-lock.json
```

`node_modules/`, `dist/`, `.sites-runtime/`, `.env`, and `.DS_Store` are ignored. Generated migration SQL and Drizzle metadata are tracked. The runtime directory contains both generated build input and persistent local data; treat those differently when cleaning up.

## Runtime architecture

### Build and asset delivery

`scripts/build.mjs` recursively reads `public/` and constructs an asset map keyed by URL path. Each entry contains UTF-8 text and a content type. It writes an entry module that calls `createWorker(assets)`, then bundles that module with esbuild into an ES module at `dist/server/index.js`, targeting ES2022 and browser-compatible APIs.

The current asset collector explicitly recognizes HTML, CSS, JavaScript, and SVG. Other extensions fall back to `text/plain`, and every file is read as UTF-8. Binary assets such as PNGs, fonts, and PDFs therefore require changes to the asset pipeline before adding them to `public/`; simply copying them into that directory is insufficient.

Browser modules remain individual served assets. They are not separately transpiled or bundled into a frontend application. Keep their syntax and dependencies compatible with the browsers the project is intended to support.

### Request flow

`server/app.js` exports `createWorker(assets)`, which returns an object with `fetch(request, env)`:

1. Match dynamic profile routes, API routes, and compatibility redirects.
2. Resolve the authenticated owner for private routes.
3. Use `repository(env.DB)` and domain catalog helpers to load the owner's data alongside shared samples.
4. Return server-rendered profile HTML or JSON.
5. For other paths, serve an embedded asset or return a not-found response.

Directory pages are static HTML shells with browser scripts that fetch their catalogs. Character, faction, country, and city profiles are rendered by the Worker with their current content and choices, then enhanced by browser editors. Saving sends JSON to the relevant API and updates the version held by the editor.

Static assets use `Cache-Control: no-cache`; private JSON responses and successful dynamic profile responses use `Cache-Control: no-store`. Rendered text is escaped through the server rendering code. Preserve those boundaries when adding fields or new markup.

### Local runtime adapter

`scripts/dev.mjs` translates Node HTTP requests into Web `Request` objects and forwards them to the built Worker's `fetch` method. It passes an `env.DB` adapter implemented in `scripts/sqlite-adapter.mjs`.

The adapter supplies the D1 methods used by this repository: prepared statements with `bind`, `first`, `all`, and `run`, plus transactional `batch` execution. It is a focused compatibility layer, not a complete D1 emulator. If new repository code uses additional D1 behavior, extend the adapter and relevant tests as part of that change.

## Configuration and authentication

| Setting or resource | Current behavior |
| --- | --- |
| `env.DB` | Required D1-compatible database binding for persisted data. |
| `oai-authenticated-user-id` | Request header used as the owner identity by private routes. |
| Local author | `local-development-author`, injected by `scripts/dev.mjs`. |
| Local bind address | `127.0.0.1`, hard-coded in `scripts/dev.mjs`. |
| Local port | `4173`, hard-coded in `scripts/dev.mjs`. |
| Local SQLite file | `.sites-runtime/development.sqlite`. |
| Hosted binding metadata | `.openai/hosting.json` declares D1 binding `DB`; R2 is unset. |
| Environment-file loading | None in the current build or development scripts. |

The hosted application expects the Sites authentication layer to provide the authenticated-user header. The Worker trusts that header; it does not implement a password login, validate a user token itself, or accept an owner ID from a JSON payload. Any alternative hosting integration must establish the trusted header at its authentication boundary.

The local server **overwrites** the identity header on every request. Passing another identity with `curl` against the local server will not simulate another author. Use the test fixtures, which invoke `worker.fetch` directly, to exercise multiple owners and unauthenticated requests.

JSON mutations require both an `Origin` header exactly matching the request URL's origin and a `Content-Type` beginning with `application/json`. Browser calls use same-origin requests. Command-line clients must supply these headers explicitly. Missing identity results in `401`; failed origin/content-type checks result in `403`.

## Persistence and migrations

### Storage model

Drizzle describes the schema and generates migrations. Runtime queries in `server/db.js` use prepared SQL through the D1 binding directly; they do not use a Drizzle query client.

| Table | Responsibility | Identity and concurrency |
| --- | --- | --- |
| `character_drafts` | Complete character JSON documents and timestamps | Primary record ID, owner scope, integer version. |
| `factions` | Private faction catalog entries and normalized names | Primary ID; unique normalized name per owner. |
| `faction_profiles` | Editable faction JSON documents | Unique owner/faction pair and integer version. |
| `locations` | Private place names, types, direct parents, creation times | Primary ID and owner scope. |
| `country_profiles` | Editable country JSON documents | Unique owner/location pair and integer version. |
| `city_profiles` | Editable city JSON documents, including country selection | Unique owner/location pair and integer version. |
| `location_details` | Area/landmark overrides, including name, parent and area type | Unique owner/location pair and integer version. |

Document fields live inside JSON text columns. Adding a field to an existing document does not inherently require a SQL migration; it requires compatible defaults, validation, serialization, and rendering. Adding a column, table, or index does require a migration.

Parent type, ownership, valid references, and ancestry rules are enforced in application code. Preserve route validation when changing repository methods; direct SQL writes do not reproduce all of the application's domain checks.

### Samples and private overrides

Sample characters, factions, and locations are source-defined defaults. Catalog helpers combine those defaults with the current owner's records and profile overrides. The sample rows are not a shared mutable database seed.

Sample character URLs use stable IDs (`claude`, `gpt`, `deepseek`, `gemini`). When an author saves a sample, `server/db.js` derives an owner-specific storage ID from the author and sample ID and retains the public sample ID in the document. Other sample profiles use owner/entity pairs in their profile tables. Editing a sample therefore affects only that author's view.

New custom entities use client-generated UUIDs. Character creation is idempotent for an owner and ID, allowing the client to retry the same request without creating duplicate drafts. Faction creation also supports normalized name deduplication; location creation returns an existing owned record when retried with the same ID.

### Optimistic concurrency

Clients must send the latest integer `version` with updates. Repository writes condition on the expected version and increment it after a successful save. The editor then keeps the returned version for its next request.

Version zero generally represents a source/default profile without a saved override. New custom characters already have a persisted document at version one. Newly created areas also have a details document at version one. Always use the version returned by the API instead of assuming an initial value.

Stale saves return `409 Conflict`. The client retains unsaved form content and asks the author to copy it before reloading. There is no automatic merge or force-save behavior. A `409` can also indicate an entity-creation or duplicate-name conflict; inspect the response's `error` message.

Faction renames, country renames, city renames/reparenting, and location detail changes keep their existing entity IDs. Related profile/catalog writes use batched database operations so those representations stay consistent.

### Changing the SQL schema

1. Edit `db/schema.ts`.
2. Run `npm run db:generate`.
3. Review the new SQL file and metadata in `drizzle/`.
4. Keep schema migrations focused on schema changes; sample content belongs in the source modules.
5. Run the relevant tests and `npm run build`.
6. Restart the local server to apply pending migrations to the development database.
7. Commit the schema change, generated SQL, and generated metadata together.

The local migration runner executes `.sql` files in filename order and records applied filenames in a local-only `local_migrations` table. Editing an already-applied migration does not make it run again. Add a new migration for an existing database change rather than rewriting migration history. Tests build fresh databases from all migrations, so also consider an existing local database when reviewing upgrades.

## HTTP routes and API contracts

### Pages

| Route | Purpose |
| --- | --- |
| `/` | Home page. |
| `/characters/` | Character directory. |
| `/characters/{id}/` | Editable character article. |
| `/factions/` | Faction directory. |
| `/factions/{id}/` | Editable faction article. |
| `/locations/` | Combined place directory and area/landmark editor. |
| `/locations/countries/{id}/` | Editable country article. |
| `/locations/cities/{id}/` | Editable city article. |
| `/timeline/` | Derived story timeline. |

Use canonical trailing-slash page URLs. The router redirects supported noncanonical paths and retains compatibility with `/characters/edit/?id={id}` and `/characters/edit/index.html?id={id}`.

### JSON endpoints

| Method | Endpoint | Request / response contract |
| --- | --- | --- |
| `GET` | `/api/characters` | Returns `{ characters: [...] }`, merging samples and private records. |
| `POST` | `/api/characters` | Accepts `{ id }`; creates and returns a blank character with `201`. Other character fields are saved through `PUT`. |
| `GET` | `/api/characters/{id}` | Returns one character document. |
| `PUT` | `/api/characters/{id}` | Accepts editable character fields, `relationships`, `hiddenFields`, and `version`; returns the saved document. |
| `GET` | `/api/factions` | Returns `{ factions: [...] }`. |
| `POST` | `/api/factions` | Accepts `{ id, blank: true }` or `{ id, name }`; returns the new or matching faction with `201`. |
| `GET` | `/api/factions/{id}` | Returns one faction document. |
| `PUT` | `/api/factions/{id}` | Accepts editable faction fields, visibility, and `version`; returns the saved document. |
| `GET` | `/api/locations` | Returns `{ locations: [...] }` with direct parent IDs and merged overrides. |
| `POST` | `/api/locations` | Accepts `{ id, name, type, parentId }`, plus `areaType` for areas; returns the created record with `201`. |
| `PUT` | `/api/locations` | Updates an area or landmark using its `id`, `name`, unchanged `type`, `parentId`, and `version`; areas also require `areaType`. |
| `GET` | `/api/countries/{id}` | Returns the country profile for an existing country location. |
| `PUT` | `/api/countries/{id}` | Saves editable country fields, visibility, and `version`. |
| `GET` | `/api/cities/{id}` | Returns the city profile for an existing city location. |
| `PUT` | `/api/cities/{id}` | Saves editable city fields, required country `parentId`, visibility, and `version`. |
| `GET` | `/api/timeline` | Returns `{ events, unplaced, undated, counts }`; derives data on each request. |

Country and city creation goes through `/api/locations`; their profile endpoints handle reads and updates. There are no separate country/city collection creation routes. Use the entity templates for exact field lists rather than maintaining a second schema in client code.

### Local API examples

With the development server running, inspect a sample or the timeline:

```sh
curl --fail-with-body http://127.0.0.1:4173/api/characters/claude
curl --fail-with-body http://127.0.0.1:4173/api/timeline
```

Create a local blank character with a new UUID:

```sh
character_id="$(node -e 'console.log(crypto.randomUUID())')"
curl --fail-with-body http://127.0.0.1:4173/api/characters \
  -H 'Origin: http://127.0.0.1:4173' \
  -H 'Content-Type: application/json' \
  --data "{\"id\":\"${character_id}\"}"
```

This writes to your development database. Retrying with the same `character_id` returns the existing owned draft. Open `/characters/{id}/` using the returned ID to edit it.

For updates, fetch the current document, edit the intended fields, and send it back with its current version. In particular, character validation requires a `relationships` array even if the intended edit only changes another field. Sending the fetched document preserves existing relationships and visibility settings.

### Errors and limits

API errors generally return JSON in the form `{ "error": "Human-readable message" }`.

| Status | Meaning |
| --- | --- |
| `400` | Malformed JSON, invalid fields, invalid references, or a violated domain rule. |
| `401` | Missing authenticated-user identity. |
| `403` | Mutation origin or JSON content type failed verification. |
| `404` | Requested entity is unavailable to the current owner or the route is unknown. |
| `405` | Method is unsupported for that endpoint. |
| `409` | Stale version, duplicate faction name, or conflicting creation. |
| `413` | Request text exceeds the route's size limit. |
| `503` | Storage or route processing failed; inspect server logs for the underlying error. |

Current request-body limits are 180,000 characters for characters, 250,000 for factions, 550,000 for country/city profiles, and 4,096 for location directory mutations. These checks use JavaScript string length after reading the body; they are not byte-accurate transport limits.

Most profile text fields allow up to 10,000 characters, name fields up to 160, and country/city image URLs up to 2,048. Character relationships are capped at 100 entries. Validation is entity-specific; the route handlers remain the authority for precise rules.

## Domain rules

### Characters and factions

Character names are composed from `firstName`, `middleName`, and `lastName`. Preserve Unicode, hyphens, spaces, and apostrophes. Legacy unsplit names remain intact in the first-name field until an author deliberately splits them; normalization must not guess a person's name structure.

Story role and alignment use enumerated choices, while existing custom values are retained where the validator explicitly supports them. Other structured human fields have their own choices and numeric constraints. Age must be a nonnegative integer; height and weight must be nonnegative numbers when present. Do not replace these field-specific rules with a blanket custom-value policy.

Relationships point to another character available to the same author. Self-references and references to another author's private characters are rejected. Relationship type and description remain text fields.

A character's `factionId` is the structured faction link. Displayed affiliation names are resolved from the current faction catalog, so a faction rename propagates without rewriting every character. Existing free-text affiliations remain available until replaced or cleared. Inline faction creation persists the faction immediately; the author must still save the character to persist its selection.

Faction founders and leaders link to characters. Membership is derived from character faction selections rather than maintained as an independent membership list. Named faction creation trims and normalizes whitespace and compares names using Unicode NFKC normalization and locale-aware lowercasing.

### Location hierarchy

| Type | Allowed direct parent | Additional constraints |
| --- | --- | --- |
| Country | None | `parentId` is null/empty. |
| City | Country | A country is always required. |
| Area | City or area | Requires `areaType`; cannot point to itself or its descendants. |
| Landmark | City or area | Inherits city/country through its ancestors. |

Area types are `Borough`, `District`, `Neighborhood`, `Ward`, and `Other`. Parent choices must come from the current author's catalog, including available samples. `public/locations/data.js` owns the shared type lists, ancestry traversal, parent choices, and directory filtering helpers.

Moving an area changes the ancestry of everything beneath it without changing each descendant's direct parent. Moving a city changes the inherited country of its areas and landmarks. Do not denormalize inherited city/country IDs into those descendant records.

Countries may designate a capital and largest city only from their own cities. A city currently designated as either cannot move to another country until those references are changed on the original country profile. Country and city leaders must refer to available characters.

Country and city profiles accept optional HTTPS image URLs for their supported image fields. The browser loads those remote images; the application does not upload image files or persist them in R2. Invalid URLs are rejected, and failed previews retain the editable field with feedback.

## Shared profile system

The character profile is the design baseline for characters, factions, countries, and cities. Extend the shared components before copying markup or implementing another set of controls.

| Module | Responsibility |
| --- | --- |
| `server/profile-components.js` | Page layout, section headings, visibility menus, infobox groups, field wrappers, choices, editable names. |
| `public/profiles/profile.css` | Shared article and infobox presentation. |
| `public/profiles/editor.css` | Shared editable fields, save controls, and editor presentation. |
| `public/profiles/controls.js` | Disclosures, field visibility, custom choices, focus, validation reveal, textarea sizing, hash navigation. |
| `public/profiles/viewport.js` | Active-heading tracking for the sticky article bar. |
| `public/profiles/editor.js` | Shared faction/country/city saving and image previews. |
| `public/profiles/choices.js` | Reusable dropdown suggestions. |
| `public/profiles/schema.js` | Field visibility allowlists and validation helpers. |
| `public/profiles/dates.js` | Story-date parsing, formatting, precision, and calendar arithmetic. |
| `public/profiles/date-picker.js` / `date-picker.css` | Shared date picker and positioning behavior. |
| Entity `template.js` files | Entity field lists, defaults, options, and visibility definitions. |
| Entity renderers and profile scripts | Domain-specific composition and editor configuration. |

The character editor in `public/characters/profile-editor.js` uses the shared controls while retaining specialized relationship and inline faction-creation behavior. Faction, country, and city profile scripts configure `initProfileEditor`. The old character profile CSS paths are compatibility imports of the shared styles.

### Interaction and layout contract

All four profile types share breadcrumb-only navigation, a sticky save bar, editable infobox names, collapsible article headings, dimmed collapsed titles, collapsible infobox groups, and icon-only visibility menus.

Field visibility is persisted as `hiddenFields` independently of the content values. Hidden fields and collapsed controls remain mounted, and their values survive saving and reopening. Collapsing a section is temporary page state; it must not delete fields or silently alter their visibility preference. Hash navigation and validation should reveal the relevant controls when necessary.

On wide screens, the attributes card pins below the save bar and scrolls independently. The bar displays the last article heading to cross its lower edge, with a brief upward transition that respects reduced-motion preferences. Narrow layouts use a single page scroll. Footer links stay in the article column, and the sticky boundary extends through the footer.

Saving is explicit through Save changes or Ctrl/Cmd+S. Editors disable relevant controls while a save is in flight, retain unsaved text on errors, and register a navigation warning when dirty. Browser storage is not the source of truth, and the warning is not a durable draft backup.

## Story dates and timeline

### Date representation

Story dates are stored as author-entered text. `public/profiles/dates.js` interprets supported forms without replacing the original meaning or inventing a more precise date.

| Input example | Interpretation |
| --- | --- |
| `2024` | Year precision. |
| `2024-03` | Month precision. |
| `2024-03-15` | Day precision. |
| `March 15, 2024` | Named-month day precision. |
| `2024-Q2` | Second quarter. |
| `2024-H1` | First half-year. |
| `44 BCE` | BCE year. |
| `c. 2024` | Approximate year. |

The parser validates calendar dates and uses proleptic Gregorian arithmetic. Timeline coordinates use astronomical year numbering internally: zero is 1 BCE. Display labels make BCE explicit. Broad periods are positioned at their interval midpoint while retaining their original precision.

Ambiguous dates, yearless birthdays, ranges, unsupported fictional-calendar text, and other unparseable values are retained as unplaced dates with links to their source fields. Empty dates do not create events. Do not infer story dates from record timestamps, age fields, or narrative prose.

### Shared picker

The date picker supports Day, Month, Quarter, Half-year, and Year selection, direct year/era navigation, keyboard calendar navigation, approximation, custom text, and clearing. A selection changes the profile draft; the normal save action persists it. Cancel leaves the original field value unchanged.

The fixed-size glass card opens beside its source infobox when space permits, dims surrounding content while keeping the source card readable, and stays within the viewport on smaller screens. Preserve keyboard behavior, focus restoration, and coarse-date precision when changing it.

### Derived events

`GET /api/timeline` reads the owner's catalogs and calls `collectTimeline` in `public/timeline/model.js`.

| Entity | Source fields |
| --- | --- |
| Character | `birthDate`, `deathDate` |
| Faction | `founded` |
| Country | `founded`, `populationDate` when `population` is present |
| City | `settled`, `incorporated`, `populationDate` when `population` is present |

There is no timeline table, synchronization job, or timeline write endpoint. An edit or cleared date is reflected on the next read. Event IDs derive from entity type, entity ID, and source field, and links target that field's profile anchor. `undated` counts records without qualifying nonempty source dates; `unplaced` retains qualifying dates the parser cannot position.

The browser refreshes on focus, on becoming visible, and every 30 seconds while visible. The view virtualizes content and clusters nearby milestones without discarding events; offscreen markers are excluded from keyboard focus.

Supported navigation includes drag-to-pan, trackpad or Shift-wheel horizontal travel, pinch or Ctrl-scroll pointer-anchored zoom, unmodified arrow-key panning, +/− zoom, and Home to fit filtered events. A bottom-center button opens a centered filter dialog with entity/event types, search, zoom, fit, go-to-year controls, and unplaced dates.

## Testing and verification

The suite uses the built-in Node test runner and strict assertions. Database-backed fixtures create in-memory SQLite databases, execute the checked-in migrations, wrap SQLite with `d1Adapter`, and call `createWorker` directly with Web `Request` objects. They do not use your development database or hosted D1 data.

| Test file | Main coverage |
| --- | --- |
| `tests/characters.test.mjs` | Creation/retry behavior, ownership, relationships, normalization, sample overrides, validation, rendering, visibility. |
| `tests/factions.test.mjs` | Profile persistence, ownership, founder/leader links, renames, membership, escaping. |
| `tests/locations.test.mjs` | Location creation, hierarchy, parent validation, ownership, filters. |
| `tests/areas.test.mjs` | Nested ancestry, area moves, sample overrides, cycle prevention. |
| `tests/countries.test.mjs` | Country profiles, private edits, city references, conflicts, image validation. |
| `tests/cities.test.mjs` | City profiles, required countries, moves, capital restrictions, images, conflicts. |
| `tests/profile-standard.test.mjs` | Shared markup and visibility/save/reopen behavior across profile types. |
| `tests/profile-viewport.test.mjs` | Sticky-heading selection and date picker viewport placement. |
| `tests/date-picker.test.mjs` | Calendar arithmetic, precision round trips, date controls, persistence into timeline events. |
| `tests/timeline.test.mjs` | Parsing, derivation, owner isolation, source changes, filtering, grouping, anchored zoom, ruler density. |

For application changes, run the relevant focused suites during development, then run `npm test` and `npm run build` before handing off. Add tests for changed behavior, especially ownership, stale writes, hierarchy constraints, and preservation of existing content.

These tests do not launch a real browser or run against hosted D1. For layout or interaction changes, also inspect the affected pages at wide and narrow viewport sizes. Verify keyboard navigation, save/reopen behavior, hidden content preservation, the sticky footer boundary, and relevant picker or timeline interactions. A model or markup assertion does not prove that a visual interaction works in the browser.

## Common development changes

### Add an editable profile field

1. Add the field and a compatible blank/default value to the entity's `template.js`.
2. Update normalization where existing documents need a fallback or legacy-value handling.
3. Render the field with shared components and a stable field anchor.
4. Add it to the entity's hideable-field definitions if visibility should be configurable.
5. Update server validation and the editor's serialization path where required.
6. Verify a new record, an existing record lacking the field, and a saved sample override.
7. If it is a story date, use the shared picker and decide explicitly whether it belongs in the timeline source map.

Most template-driven editors pick up fields through their field lists, but new input types or linked values can still require an entity adapter change. Check both server and browser behavior.

### Add a domain route or query

Keep HTTP parsing, owner resolution, and field validation in the route layer; place persisted operations in `server/db.js`. Use prepared statements, include the owner in reads and writes, and validate linked entities against that owner's catalog. Preserve optimistic concurrency for editable documents and update related representations together when required.

Wire the route in `createWorker`, add request-level tests using the existing fixture pattern, and update this README's route table if the public contract changes.

### Change shared profile behavior

Start with `server/profile-components.js` and `public/profiles/`. Check the change against all four profile types, including the specialized character editor. Keep domain-specific behavior in adapters: faction membership remains derived, countries constrain city selections, cities require countries, and area/landmark ancestry remains intact.

### Extend timeline behavior

Keep parsing and date precision in `public/profiles/dates.js`, event derivation and view math in `public/timeline/model.js`, and DOM interaction in `public/timeline/timeline.js`. Add a new date source to the explicit source-field mapping instead of scanning arbitrary document text or adding a synchronization table.

## Deployment integration

The repository is linked to a Sites project through `.openai/hosting.json`. That file records the project association and D1 binding name `DB`; R2 is not configured. The deployable output is the Worker ES module at `dist/server/index.js` with frontend assets embedded in it.

The expected hosted deployment flow builds the Worker and applies the checked-in schema migrations through Sites before the application uses the updated schema. There is no checked-in standalone deployment CLI command or npm deployment script. Use the project's Sites deployment workflow and preserve the existing project association unless intentionally moving the application.

Before deploying application changes:

1. Run the relevant tests and build.
2. Review any new migrations and ensure they are committed.
3. Confirm that the deployment provides `env.DB` and the authenticated-user header.
4. After deployment, verify the affected profile or directory, persistence after reopening, and any changed timeline behavior.

The local SQLite adapter does not verify hosted authentication, D1 provisioning, or deployment migration execution. Those are integration checks in the target environment.

## Troubleshooting

| Symptom | Likely cause and next step |
| --- | --- |
| `node:sqlite` is unavailable | Check `node --version`; use the supported Node 22 runtime described above. |
| SQLite experimental warning | Expected on relevant Node versions; inspect subsequent output for an actual failure. |
| `dist/server/index.js` cannot be imported | Run `npm run build` from the repository root before `npm run dev`. |
| Source edits do not appear | Stop the server, rebuild, restart, and reload the browser. |
| `EADDRINUSE` on port 4173 | Stop the existing listener or intentionally change the hard-coded development address/port references. |
| API write returns `403` in `curl` | Supply the matching `Origin` and JSON content type. `localhost` and `127.0.0.1` are different origins. |
| Hosted private route returns `401` | Check that the hosting authentication layer supplies the authenticated-user header. |
| Changing the local identity header has no effect | The development server overwrites it; use direct Worker test fixtures for multiple authors. |
| Save returns `409` | Read the response message. For stale versions, preserve unsaved text, reload the latest record, and reapply the edit. |
| API or profile returns `503` | Inspect server logs and verify `env.DB` and applied migrations. |
| Existing local database lacks a schema change | Generate a new migration if needed and restart the server; changing an old migration does not replay it. |
| Timeline is empty | Samples have no invented dates. Save a supported story date in a mapped profile field. |
| A saved date is absent from the placed timeline | Check Unplaced dates and the supported parser forms; population dates also require a population value. |
| A country/city image does not display | Check the HTTPS URL and remote resource; a valid URL can still fail to load. |
| A newly added binary file is corrupted or has the wrong MIME type | Extend the text-only asset pipeline before serving binary assets. |
