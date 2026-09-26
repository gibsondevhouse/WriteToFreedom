# Beta milestone delivery tracker

Implementation date: September 25, 2026. Delivery scope: **full A–E**, all five stages. Branch: `codex/beta-milestone`.

## Delivery

| Stage | Delivered behavior | Evidence |
| --- | --- | --- |
| 001 — Foundation | Owner-scoped novels/series, checked ordering, typed associations, explicit manuscript ownership, durable default backfill | `novels`, `novel-routes`, `novel-backfill`, `novel-ownership-migration`, and data integrity tests |
| 002 — Profiles and browsing | Familiar article/infobox profiles, directories, home rails, global search, durable context, correct chapter destinations | Novel page tests; novel profile and context browser cases |
| 003 — Shared articles | One canonical source, per-novel appearance/reference prose, infobox links, deduplicated series material, independent saves and draft-preserving conflicts | Appearance Node/browser tests; scope integration tests |
| 004 — Collections | Mixed manual references, nested note identity, persistent order, source-preserving removal, live bounded smart criteria | Collection API, integrity, concurrency, and browser cases |
| 005 — Integration | Defined scope for catalogs/search/references/timeline/writing, fresh/populated/rollback migration checks, original editing regressions | Full Node, TypeScript, Worker build, and Chromium gates |

## Acceptance evidence

| # | Acceptance behavior | Primary coverage |
| --- | --- | --- |
| 1 | Two novels, optional series, persistent checked order | `tests/novels.test.mjs`, `tests/novel-routes.test.mjs`, `tests/browser/novel-profiles.spec.ts` |
| 2 | Legacy prose, revisions, dates, IDs, ordering, and scene links preserved | `tests/novel-backfill.test.mjs`, `tests/novel-ownership-migration.test.mjs` |
| 3 | Lore books remain Lore objects | `tests/novel-context.test.mjs`, `tests/collections.test.mjs`, populated SQL upgrade |
| 4 | Characters, factions, locations, Lore linked to two novels without copies | `tests/novel-appearances.test.mjs`, `tests/novel-context.test.mjs` |
| 5 | Renames update linked labels by canonical ID | `tests/novel-pages.test.mjs`, `tests/novel-appearances.test.mjs` |
| 6 | Independent association prose preserves other associations/main article | `tests/novel-routes.test.mjs`, `tests/browser/novel-appearances.spec.ts` |
| 7 | Shared shell, hidden values, collapses, saves, narrow layouts | `tests/browser/novel-profiles.spec.ts`, original profile persistence suites |
| 8 | Correct novel/chapter destination, explicit creation scope | `tests/novel-context.test.mjs`, `tests/browser/novel-context.spec.ts` |
| 9 | Manual collection reload/removal preserves canonical sources and links | `tests/collections.test.mjs`, `tests/browser/collections.spec.ts` |
| 10 | Smart results update live and count distinct novels without source mutation | `tests/collections.test.mjs`, `tests/browser/collections.spec.ts` |
| 11 | Parent-qualified notes stay distinct; private sample overrides retain the reserved canonical identity | `tests/collection-integrity.test.mjs`, `tests/collections.test.mjs`, sample association tests |
| 12 | Owner/type/existence boundaries reject invalid links atomically | SQL integrity/migration tests, collection concurrency tests, scope integration tests |
| 13 | Profile/association/rule/order conflicts retain drafts | Existing profile regressions; novel/collection API and browser suites |
| 14 | Failed scene saves retain prose; canceled context switches retain drafts | `tests/browser/writing-workspace.spec.ts`, `tests/browser/novel-context.spec.ts` |
| 15 | Original profiles, notes, ancestry, dates, and rich-text documents work | Original Node/browser suites; scope integration and location parent browser case |

## Operational behavior and defaults

See [novels and collections](../novels-and-collections.md) for the scope matrix, endpoint identities, migration instructions, and selected product defaults. The SQL upgrade assigns unassigned legacy chapters to one durable default novel per owner without declaring worldbuilding appearances or changing already assigned chapters. The local repair command uses independent owner transactions and reports failed owners; it does not bypass failed SQL reference audits. Samples remain virtual defaults with private overrides under their reserved public identities; Lore books retain their meaning. Series are optional and limited to one primary series per novel. Series membership and position writes share the series metadata/order revision, so concurrent stale reorders and moves roll back atomically. Timeline dates remain canonical source dates. Smart collections evaluate bounded allowlisted rules against current owner data. Archived novels remain selectable and editable, and their links still count.

Source creation and contextual association are separate existing domain transactions. A failed second write retains the source ID and returns an error; retry repairs the link without replacing the source. Embedded smart notes retain parent-qualified identity while their novel, series, distinct-link-count, and unassigned criteria follow the parent character's declared links; the criteria summary explains this rule. SQL guards require explicit unlinking before deleting associated or manually collected sources, and before removing collected embedded notes. Removing a private sample override preserves its virtual primary source and canonical links unless collected private notes depend on the override. Novel deletion is also blocked by chapters, associations, or a durable default mapping. These are intentional V1 policies.

## Verification record

Each checkpoint was verified from an isolated archive of its staged Git tree before push. Test databases were temporary; the author’s local database was not used. Browser checks use Chromium.

| Checkpoint | Commit | Node tests | Browser tests | TypeScript and build |
| --- | --- | ---: | ---: | --- |
| Storage and migration | `fd52dac` | 226 passed | Storage-only change | Passed |
| Novel APIs and manuscript writing | `7382df5` | 247 passed | 54 original cases passed | Passed |
| Profiles and shared article appearances | `304c722` | 255 passed | 7 focused cases passed | Passed |
| Manual and smart collections | `3137cd8` | 266 passed | 4 focused cases passed | Passed |
| Cross-feature scope and delivery documentation | `test: verify beta scope and document milestone delivery` | 275 passed | 68 passed | Passed |

The final gate runs `npm test`, `npm run typecheck`, `npm run build`, and the complete `npm run test:browser` suite on the integrated branch. Migration coverage includes a populated pre-milestone database with manuscript prose, private sample overrides, custom entities, nested notes, and cross-entity links, plus fresh installation, repeat application, invalid-reference rollback, and retry. Existing profile and writing browser regressions remain part of the complete suite.

## Implementation choices

The plan's detailed foundation prompt assumes router mounting APIs and a universal registration helper that this repository does not use. Implementation follows the actual Worker dispatcher, repository factories, shared rendering primitives, and document registry. Chapter ownership is relational and enforced by triggers, including a legacy insert bridge; existing chapter document bytes are not rewritten. A SQL-only upgrade migration complements the requested local repair script for hosted migration compatibility.

Independent storage, API, and UI work was developed in parallel, then integrated and checked. Delivery commits group coherent dependency layers rather than replaying each fine-grained prompt phase. All resulting checkpoints must pass their tests and build before push. The requested full feature scope is unchanged.

Hosting deployment, public sharing, transfers, trash/recovery, autosave, export, universal tags, and per-field alternate canon remain outside this milestone. The current hosting association is preserved.
