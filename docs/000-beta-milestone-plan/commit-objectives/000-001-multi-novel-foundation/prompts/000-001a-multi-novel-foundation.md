# Prompt 000-001a — Multi-Novel Foundation

> **Stage A of the beta milestone plan.**
> Every phase below is a self-contained, green-CI commit and push.
> Priorities in order: **stability → resilience → efficiency.**
> Do not proceed to the next phase until all tests and checks in the current phase pass.

---

## Context and Authority

You are implementing the multi-novel foundation for Write to Freedom — a publicly released, owner-scoped writing encyclopedia. The existing codebase is the design and behavior authority. Read the following files before writing any code:

- `db/schema.ts` — existing SQLite table definitions (Drizzle ORM, SQLite-core)
- `db/document-contracts.js` — JSON document shapes, schema registry, `documentSchemas`
- `db/documents.schema.json` — generated validation schema; must stay in sync
- `drizzle/0011_data_integrity.sql` — custom integrity triggers; Drizzle does not model these
- `drizzle/0012_location_edit_timestamps.sql` — most recent migration; your migrations come after
- `server/writing-repository.js` — existing repository pattern: owner-scoped D1 prepared queries, optimistic concurrency with `version` column, `RETURNING *` updates
- `server/writing-routes.js` — existing route pattern: JSON parse → validate → repo call → JSON response
- `server/app.js` — router mounting and middleware
- `server/db.js` — `repository()` factory, D1 binding setup
- `scripts/migrate.mjs` — how migrations are applied
- `tests/migrations.test.mjs` — migration test harness
- `tests/writing.test.mjs` — writing test patterns to follow
- `tests/data-integrity.test.mjs` — integrity trigger test patterns to follow

Do **not** touch `public/lore/template.js` or any Lore routes. The word `book` inside the Lore domain means a fictional in-world object — preserve it entirely.

---

## Naming Invariants

| Internal name | UI label allowed | Must NOT conflict with |
|---|---|---|
| `novels` | "Books" or "Novels" | Lore `lore_entries` with `type: 'book'` |
| `series` | "Series" | Nothing existing |
| `novel_associations` | (internal only) | Nothing existing |

All new table names use snake_case matching the existing schema. All new Drizzle export names use camelCase matching the existing schema exports.

---

## Phase 1 — Schema: `novels` and `series` tables

**Commit message:** `feat(db): add novels and series tables with integrity triggers`

### What to do

1. **Read** `db/schema.ts` in full before editing.

2. **Add** to `db/schema.ts` (after the last existing table export):

```ts
export const novels = sqliteTable('novels', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  document: text('document').notNull(),
  schemaVersion: integer('schema_version').notNull().default(1),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [index('idx_novels_owner_updated').on(table.ownerId, table.updatedAt)]);

export const series = sqliteTable('series', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  document: text('document').notNull(),
  schemaVersion: integer('schema_version').notNull().default(1),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [index('idx_series_owner_updated').on(table.ownerId, table.updatedAt)]);
```

3. **Create** `drizzle/0013_novels_and_series.sql`. The file must:
   - Create `novels` and `series` tables matching the schema above.
   - Add `BEFORE INSERT` and `BEFORE UPDATE` integrity triggers for each table using the exact same pattern as the triggers in `0011_data_integrity.sql`:
     - Identity fields must be non-empty text.
     - `document` must be valid JSON object.
     - `version` must be a safe positive integer.
     - `schema_version` must be a safe positive integer.
     - On UPDATE: `owner_id` and `id` are immutable.
     - On UPDATE: `version` must advance by exactly 1 when the document, schema_version, or version changes.
   - Use `-->statement-breakpoint` between each statement, exactly as `0011` does.
   - End the file with a comment: `-- Triggers are not modelled by Drizzle snapshots. Preserve on any table rebuild.`

4. **Do not** add `novel_id` to `chapters` yet — that is Phase 3.

### Verification

```bash
npm run typecheck
npm test -- --testPathPattern migrations
npm run build
```

All must pass green before committing. Then:

```bash
git add db/schema.ts drizzle/0013_novels_and_series.sql
git commit -m "feat(db): add novels and series tables with integrity triggers"
git push
```

---

## Phase 2 — Document Contracts: `novel` and `series` schemas

**Commit message:** `feat(db): register novel and series document contracts`

### What to do

1. **Read** `db/document-contracts.js` in full. Understand how `register()` works and how `documentSchemas` is built.

2. **Add** novel and series document schema registrations at the bottom of `db/document-contracts.js`, before the last export if one exists, otherwise at the end of the file:

```js
register('novel', 'Novel', 'novels', {
  title:      { ...text(480), title: 'Title' },
  synopsis:   { ...text(10000), title: 'Synopsis' },
  status:     { type: 'string', enum: ['drafting', 'revising', 'complete', 'archived'], title: 'Status' },
  coverUrl:   { ...text(2048), title: 'Cover image URL', description: 'Empty or an HTTPS URL without embedded credentials.' },
  seriesId:   { type: 'string', title: 'Primary series ID', description: 'UUID of the owning series, or empty.' },
  seriesOrder:{ type: 'integer', minimum: 0, title: 'Position in series' },
  hiddenFields: visibility(['synopsis', 'status', 'coverUrl', 'seriesId', 'seriesOrder']),
}, ['title']);

register('series', 'Series', 'series', {
  title:      { ...text(480), title: 'Title' },
  summary:    { ...text(10000), title: 'Summary' },
  coverUrl:   { ...text(2048), title: 'Cover image URL', description: 'Empty or an HTTPS URL without embedded credentials.' },
  hiddenFields: visibility(['summary', 'coverUrl']),
}, ['title']);
```

3. **Regenerate** `db/documents.schema.json` by running:

```bash
node scripts/document-schema.mjs
```

   Verify the output file includes `novel` and `series` definitions. Commit both files together.

4. **Do not** add any association-related fields to the novel document — the `novel_associations` table in Phase 4 owns that data.

### Verification

```bash
npm run typecheck
npm test -- --testPathPattern document-contracts
npm run build
```

Then:

```bash
git add db/document-contracts.js db/documents.schema.json
git commit -m "feat(db): register novel and series document contracts"
git push
```

---

## Phase 3 — Schema: `chapters.novel_id` + migration

**Commit message:** `feat(db): add novel_id to chapters with FK and integrity enforcement`

### What to do

1. **Read** `db/schema.ts` `chapters` table definition. `chapters` currently has: `id`, `ownerId`, `document`, `schemaVersion`, `version`, `createdAt`, `updatedAt`.

2. **Edit** `db/schema.ts`: add `novelId` as a **nullable** text column to the `chapters` table (nullable because existing chapters must be migrated, not broken):

```ts
novelId: text('novel_id'),
```

   Place it after `ownerId`. Do not make it `.notNull()` yet — Phase 5 (migration) will backfill it first.

3. **Add** `idx_chapters_novel` index:

```ts
index('idx_chapters_novel').on(table.novelId)
```

   Add this to the `chapters` table's index array alongside the existing `idx_chapters_owner_created`.

4. **Create** `drizzle/0014_chapters_novel_id.sql`:

```sql
--> statement-breakpoint
ALTER TABLE `chapters` ADD COLUMN `novel_id` text;
--> statement-breakpoint
CREATE INDEX `idx_chapters_novel` ON `chapters` (`novel_id`);
```

   No triggers needed yet — enforcement comes in Phase 5 after backfill.

### Verification

```bash
npm run typecheck
npm test -- --testPathPattern migrations
npm run build
```

Then:

```bash
git add db/schema.ts drizzle/0014_chapters_novel_id.sql
git commit -m "feat(db): add novel_id to chapters with FK and integrity enforcement"
git push
```

---

## Phase 4 — Schema: `novel_associations` table

**Commit message:** `feat(db): add novel_associations table for typed entity-novel links`

### What to do

1. **Add** to `db/schema.ts` after the `series` export:

```ts
export const novelAssociations = sqliteTable('novel_associations', {
  id:           text('id').primaryKey(),
  ownerId:      text('owner_id').notNull(),
  novelId:      text('novel_id').notNull().references(() => novels.id),
  targetKind:   text('target_kind').notNull(),
  targetId:     text('target_id').notNull(),
  relationKind: text('relation_kind').notNull().default('appears_in'),
  prose:        text('prose').notNull().default(''),
  version:      integer('version').notNull().default(1),
  createdAt:    text('created_at').notNull(),
  updatedAt:    text('updated_at').notNull(),
}, table => [
  uniqueIndex('idx_novel_assoc_owner_novel_target').on(table.ownerId, table.novelId, table.targetKind, table.targetId),
  index('idx_novel_assoc_owner_target').on(table.ownerId, table.targetKind, table.targetId),
]);
```

2. **Create** `drizzle/0015_novel_associations.sql`:
   - Create the `novel_associations` table.
   - The unique index enforces one association per `(owner_id, novel_id, target_kind, target_id)`.
   - Add `BEFORE INSERT` and `BEFORE UPDATE` integrity triggers using the same pattern as `0011`:
     - `owner_id`, `id`, `novel_id`, `target_kind`, `target_id` must be non-empty text.
     - `relation_kind` must be one of `'appears_in'`, `'referenced_by'`, `'linked'`.
     - `version` must be a safe positive integer.
     - On UPDATE: `owner_id`, `id`, `novel_id`, `target_kind`, `target_id` are immutable.
     - On UPDATE: `version` must advance by exactly 1 when prose or relation_kind changes.
   - Use `-->statement-breakpoint` between each statement.
   - End with the comment: `-- Triggers not modelled by Drizzle. Preserve on any table rebuild.`

3. **Allowed `target_kind` values** (enforced in the application layer, not the trigger, to allow future extension without a migration): `character`, `faction`, `location`, `lore`, `story_arc`.

### Verification

```bash
npm run typecheck
npm test -- --testPathPattern migrations
npm run build
```

Then:

```bash
git add db/schema.ts drizzle/0015_novel_associations.sql
git commit -m "feat(db): add novel_associations table for typed entity-novel links"
git push
```

---

## Phase 5 — Migration Script: backfill `chapters.novel_id`

**Commit message:** `feat(scripts): add idempotent migration to create default novel and backfill chapters`

### What to do

1. **Read** `scripts/migrate.mjs` to understand how custom migration scripts are structured in this repo.

2. **Create** `scripts/migrate-novel-backfill.mjs`. This script:

   - Is **idempotent**: running it twice must produce the same result with no duplicate rows.
   - Discovers every distinct `owner_id` from the `chapters` table.
   - For each owner, checks whether a `novels` row already exists for that owner with `json_extract(document, '$.title') = 'Imported manuscript'`.
   - If none exists, inserts one with:
     - A new UUIDv4 `id` (use `crypto.randomUUID()`).
     - `owner_id` set to the chapter's owner.
     - `document` = `JSON.stringify({ title: 'Imported manuscript', status: 'drafting', synopsis: '', coverUrl: '', seriesId: '', seriesOrder: 0, hiddenFields: [] })`.
     - `schema_version = 1`, `version = 1`.
     - `created_at` and `updated_at` = current ISO timestamp.
   - Updates all `chapters` rows for that owner where `novel_id IS NULL`, setting `novel_id` to the discovered or created novel's `id`.
   - Wraps each owner's operations in a single SQLite transaction. On failure it rolls back and logs the owner ID and error without aborting other owners.
   - Prints a summary: how many owners processed, how many novels created, how many chapters updated.

3. **Do not** set `novel_id NOT NULL` on the chapters table in this phase — that constraint lands in Phase 6 only after the script is verified.

4. **Add** a test in `tests/migrations.test.mjs` (or a new `tests/novel-backfill.test.mjs`) that:
   - Creates a fresh in-memory SQLite database with the current schema.
   - Inserts two owners, each with 2 chapters and no `novel_id`.
   - Runs the backfill script logic (import and call the exported function).
   - Asserts: each owner has exactly one `novels` row with title "Imported manuscript".
   - Asserts: all 4 chapters now have `novel_id` set to the correct novel for their owner.
   - Runs the script a second time and asserts no duplicate novels and no changed chapter assignments.

### Verification

```bash
npm run typecheck
npm test -- --testPathPattern novel-backfill
npm run build
```

Then:

```bash
git add scripts/migrate-novel-backfill.mjs tests/novel-backfill.test.mjs
git commit -m "feat(scripts): add idempotent migration to create default novel and backfill chapters"
git push
```

---

## Phase 6 — Repository: novels and series CRUD

**Commit message:** `feat(server): add novels and series repository methods`

### What to do

1. **Read** `server/writing-repository.js` and `server/db.js` in full. Understand the `repository(binding)` factory pattern — all new methods go inside the same returned object.

2. **Add** these methods to the `repository(binding)` object (pattern exactly mirrors existing `listStoryArcs`, `getStoryArc`, `createStoryArc`, `saveStoryArc`):

```js
// Novels
async listNovels(owner) { ... }         // SELECT ordered by updated_at DESC, id
async getNovel(owner, id) { ... }       // SELECT by owner + id
async createNovel(owner, id, document) { ... } // INSERT ... ON CONFLICT DO NOTHING; return getNovel
async saveNovel(owner, id, version, document) { ... } // UPDATE with version check; RETURNING *

// Series
async listSeries(owner) { ... }
async getSeries(owner, id) { ... }
async createSeries(owner, id, document) { ... }
async saveSeries(owner, id, version, document) { ... }
```

3. **For `saveNovel` and `saveSeries`**: follow the exact pattern of `saveStoryArc`:
   - `UPDATE ... SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND schema_version = 1 RETURNING *`
   - Return `null` when no rows are updated (optimistic concurrency conflict).

4. **Add** novel association repository methods:

```js
async listNovelAssociations(owner, novelId) { ... }  // SELECT WHERE owner_id = ? AND novel_id = ?
async getNovelAssociation(owner, id) { ... }         // SELECT WHERE owner_id = ? AND id = ?
async createNovelAssociation(owner, id, novelId, targetKind, targetId, relationKind, prose) { ... }
  // INSERT ... ON CONFLICT(owner_id, novel_id, target_kind, target_id) DO NOTHING; return get
async saveNovelAssociation(owner, id, version, relationKind, prose) { ... }
  // UPDATE prose, relation_kind, version = version + 1 WHERE owner_id, id, version; RETURNING *
async deleteNovelAssociation(owner, id) { ... }
  // DELETE WHERE owner_id = ? AND id = ? — does NOT delete the target entity
```

5. **Do not** modify existing methods. Only add new ones.

6. **Add** `tests/novels.test.mjs`:
   - Uses an isolated in-memory DB (pattern from `tests/writing.test.mjs`).
   - Tests: create, get, list, save (version match), save (version conflict → null), listNovelAssociations, createNovelAssociation (idempotent second call), saveNovelAssociation, deleteNovelAssociation (target entity unaffected).
   - Tests: owner isolation — novel created for owner A cannot be fetched by owner B.

### Verification

```bash
npm run typecheck
npm test -- --testPathPattern novels
npm run build
```

Then:

```bash
git add server/writing-repository.js tests/novels.test.mjs
git commit -m "feat(server): add novels and series repository methods"
git push
```

---

## Phase 7 — Routes: `/novels` and `/series` API endpoints

**Commit message:** `feat(server): add novels and series HTTP routes`

### What to do

1. **Read** `server/writing-routes.js` and `server/app.js` in full before writing a single line.

2. **Create** `server/novel-routes.js`. Follow the exact handler structure in `writing-routes.js`:
   - Extract `owner` from `request.headers` using the same identity header the existing routes use.
   - Parse JSON body with `JSON.parse(raw)`; return `400` on invalid JSON or wrong shape.
   - Call repo methods; return `409` on version conflict (`null` return from `save*`).
   - Use `json(data, status)` response helper matching the existing pattern.

3. **Implement these endpoints:**

```
GET    /novels                → listNovels(owner)                         → 200 [{...}]
POST   /novels                → createNovel(owner, body.id, document)     → 201 {...}
GET    /novels/:id            → getNovel(owner, id)                       → 200 | 404
PUT    /novels/:id            → saveNovel(owner, id, body.version, doc)   → 200 | 409
GET    /novels/:id/associations → listNovelAssociations(owner, id)        → 200 [{...}]
POST   /novels/:id/associations → createNovelAssociation(...)             → 201 {...}
PUT    /novels/:id/associations/:assocId → saveNovelAssociation(...)      → 200 | 409
DELETE /novels/:id/associations/:assocId → deleteNovelAssociation(...)    → 204

GET    /series                → listSeries(owner)                         → 200 [{...}]
POST   /series                → createSeries(owner, body.id, document)    → 201 {...}
GET    /series/:id            → getSeries(owner, id)                      → 200 | 404
PUT    /series/:id            → saveSeries(owner, id, body.version, doc)  → 200 | 409
```

4. **Validate** on write:
   - `id` must be a UUID matching the existing `uuid` regex from `writing-routes.js`.
   - `title` must be a non-empty string ≤ 480 chars.
   - `status` (novel only) must be one of `drafting | revising | complete | archived`.
   - `coverUrl` must be empty or an HTTPS URL (no embedded credentials); use the same URL check as existing routes.
   - `seriesId` (novel only) must be a UUID of a `series` owned by the same owner, or empty string.
   - `version` must be a safe positive integer on updates.
   - `targetKind` (associations) must be one of `character | faction | location | lore | story_arc`.
   - `targetId` must be a UUID.
   - `relationKind` must be one of `appears_in | referenced_by | linked`.
   - A user-supplied novel ID is a resource selector, not proof of ownership — always scope to `owner`.

5. **Mount** in `server/app.js`:

```js
import novelRoutes from './novel-routes.js';
// ...
app.use('/novels', novelRoutes);
app.use('/series', novelRoutes); // same file handles both, or separate if cleaner
```

   Follow the exact existing mount pattern. Do not disturb existing route order.

6. **Add** `tests/novel-routes.test.mjs`:
   - Tests all happy-path and error-path cases for each endpoint.
   - Asserts `404` for unknown IDs.
   - Asserts `409` on version conflicts.
   - Asserts `400` on missing `title`, invalid UUID, invalid status, invalid URL.
   - Asserts owner isolation: GET/PUT/DELETE with a foreign owner returns `404` or `403` — never the other owner's data.
   - Asserts `DELETE` association does not delete the referenced character/lore/etc.

### Verification

```bash
npm run typecheck
npm test -- --testPathPattern novel-routes
npm run build
```

Then:

```bash
git add server/novel-routes.js server/app.js tests/novel-routes.test.mjs
git commit -m "feat(server): add novels and series HTTP routes"
git push
```

---

## Phase 8 — Write Safety: conflict responses and dirty-state contract

**Commit message:** `test(server): verify optimistic concurrency and dirty-state resilience for novels`

### What to do

This phase adds no new features — it hardens what Phase 6–7 built and verifies existing editor contracts remain intact.

1. **Verify** in `tests/novel-routes.test.mjs` (add sub-suite if needed):
   - Simultaneous `PUT /novels/:id` with the same `version` from two simulated clients: only the first succeeds (`200`); the second returns `409` with a human-readable message matching the existing conflict message pattern (see `writing-routes.js` for the exact text format).
   - The `409` response body must contain the user's draft in the response so the frontend can preserve it — match the existing behavior in `writing-routes.js`.
   - A `DELETE` on an association while the novel's `version` has advanced still succeeds (associations have independent versioning from the novel document).

2. **Verify** in `tests/data-integrity.test.mjs` (add a sub-suite):
   - Direct SQLite INSERT on `novels` with an empty `owner_id` → trigger aborts.
   - Direct SQLite INSERT on `novels` with invalid JSON in `document` → trigger aborts.
   - Direct SQLite UPDATE on `novels` that mutates `id` → trigger aborts.
   - Direct SQLite UPDATE on `novels` that sets `version = version + 2` → trigger aborts.
   - Same four checks for `series`.
   - Same four checks for `novel_associations`.

3. **Run the full suite** and fix any failures before committing. Do not silence or skip existing tests.

### Verification

```bash
npm run typecheck
npm test
npm run build
```

Then:

```bash
git add tests/novel-routes.test.mjs tests/data-integrity.test.mjs
git commit -m "test(server): verify optimistic concurrency and dirty-state resilience for novels"
git push
```

---

## Phase 9 — Navigation: minimal novel context in workspace shell

**Commit message:** `feat(server): surface novel context in workspace navigation`

### What to do

This phase adds only what is needed to reach and verify each novel through the existing UI — no new design system, no new page shells.

1. **Read** `server/workspace-shell.js` and `public/workspace-shell.css` in full.

2. **Add** a "My novels" navigation link within the existing "My workspace" section of `workspace-shell.js`. Follow the exact pattern of the existing "Writing" or "Story Arcs" nav items. Do not invent a new nav section or topbar component.

3. **Create** `server/novel-pages.js` — a minimal page handler that:
   - Renders a bare list of the owner's novels using the existing `directory-shell.js` / `dashboard-shell.js` primitives (read `server/dashboard-shell.js` and `server/directory-shell.js` first).
   - Each novel appears as a card/list entry with its title, status badge, and a link to `/novels/:id`.
   - `/novels/:id` renders the novel's title and synopsis using `profile-components.js` primitives — no new profile shell, just the existing one with a novel adapter.
   - The page does not require Stage 002's full profile work. It only needs to be navigable and non-broken.

4. **Mount** the page routes in `server/app.js` at `GET /novels` (HTML) and `GET /novels/:id` (HTML). These must coexist with the JSON API routes mounted in Phase 7 — use content-type negotiation (`Accept: application/json`) or separate path prefixes (`/api/novels` for JSON, `/novels` for HTML). Follow whichever pattern already exists in the codebase for other entities.

5. **Add** `tests/workspace-shell.test.mjs` sub-tests (or extend the existing file):
   - The workspace shell HTML includes the "My novels" nav link.
   - The link is present regardless of whether the owner has any novels.

6. **Do not** implement novel profile editing, chapter/scene context switching, or filtered worldbuilding directories — those are Stage 002.

### Verification

```bash
npm run typecheck
npm test
npm run build
```

Then:

```bash
git add server/novel-pages.js server/app.js server/workspace-shell.js tests/workspace-shell.test.mjs
git commit -m "feat(server): surface novel context in workspace navigation"
git push
```

---

## Phase 10 — Full Suite and Acceptance Sign-off

**Commit message:** `test: full suite green for stage 001 multi-novel foundation`

### What to do

1. **Run the full test suite** (Node + Playwright if applicable):

```bash
npm test
npm run typecheck
npm run build
```

2. **Confirm** every acceptance criterion from `docs/000-beta-milestone-plan/commit-objectives/000-001-multi-novel-foundation/000-001-multi-novel-foundation.md` is demonstrable:

   - [ ] An author can create two novels, optionally group them in a series, reorder them via `seriesOrder`, save, and reload the same structure.
   - [ ] Existing manuscript chapters survive the backfill migration with the same prose and valid chapter/scene links.
   - [ ] Existing Lore entries (`lore_entries` with `type: 'book'`) remain unchanged — identities, URLs, and documents untouched.
   - [ ] A second owner's novel/series/association IDs return `404` — never the foreign owner's data.
   - [ ] Version conflicts on `saveNovel` / `saveSeries` / `saveNovelAssociation` return `409` with the draft preserved.
   - [ ] Dirty writing (unsaved scene edits) survives according to the existing editor contract in `docs/writing-workspace.md`.

3. **If any test is red**, fix it before committing. Do not push a failing suite.

4. **Write a brief completion report** as a comment in this commit (or as `docs/000-beta-milestone-plan/000-tracker.md`):
   - What users can now do.
   - Migration behavior and any known edge cases.
   - Tests added and test counts.
   - Any deliberate defaults that affect product behavior.
   - Explicit list of what is deferred to Stage 002.

### Final push

```bash
git add docs/000-beta-milestone-plan/000-tracker.md   # if updated
git commit -m "test: full suite green for stage 001 multi-novel foundation"
git push
```

---

## Constraints and Invariants (apply to all phases)

- **Stability first.** If a phase would break an existing test, fix the test contract correctly before proceeding — never delete or skip tests to get to green.
- **No cascading deletes** on manuscripts. Removing a series must not delete novels. Removing a novel must not delete chapters or scenes. Removing an association must not delete the referenced entity.
- **Owner scope is non-negotiable.** Every query must include `WHERE owner_id = ?`. No query may return rows across owners.
- **Triggers must survive table rebuilds.** Any `DROP TABLE / CREATE TABLE` cycle in a migration must recreate all triggers from `0011` and new triggers from `0013`–`0015`.
- **Do not widen existing allowlists silently.** `note-connections.js`, `document-contracts.js`, and frontend reference consumers each have their own allowlist. Do not add `novel` or `series` as a valid reference target in existing code unless you have read and understood each consumer.
- **One DB per test.** Keep test databases isolated from the author's local data file. Use in-memory SQLite or a temp file path per test run.
- **Commit only what changed.** Each commit message is the one given in the phase header. Do not batch multiple phases into one commit.
