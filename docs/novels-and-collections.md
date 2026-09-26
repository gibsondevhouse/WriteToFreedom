# Novels, shared articles, and collections

The beta milestone implements all five delivery slices in [the plan](000-beta-milestone-plan/Commit-goal/multiple-novels-coding-agent-brief.md). Novels are manuscript projects. A Lore entry with `type: 'book'` remains an in-world object with its existing ID, fields, and route.

## Storage and identity

| Record | Storage and identity | Save boundary |
| --- | --- | --- |
| Novel | `novels`, UUID, owner, versioned document | Novel edit revision |
| Series | `series`, UUID, owner, versioned document | Series metadata and ordering revision |
| Chapter | Existing document plus relational `chapters.novel_id` | Chapter edit revision; ordinary saves cannot transfer novels |
| Scene | Existing rich-text document and `chapter_id` | Scene edit revision; novel derives from its chapter |
| Novel association | `novel_associations`, novel plus typed canonical target | Independent association revision and appearance/reference prose |
| Manual collection | `collections` metadata plus `collection_members` typed references | Parent collection revision covers metadata, membership, and order |
| Smart collection | `collections` metadata plus versioned criteria | Parent collection revision; results are derived on each read |

Novel associations support characters, factions, locations, Lore, and story arcs. Source-defined samples resolve through each author's effective catalog. A private character sample override retains the reserved public sample ID; its storage UUID cannot become a second association or collection identity. Collection targets additionally support novels, series, chapters, scenes, and embedded character notes. An embedded note uses `{kind: 'note', characterId, id}`; its parent remains part of its identity. The separate collection reference contract leaves existing note/link allowlists intact.

One canonical article may be linked to several novels. Association prose is edited in a separate dialog outside the main article's editing form. Conflicts retain that dialog's draft and let the author review the latest saved prose before explicitly saving again. Series shared material is the deduplicated union of its novels' links. Names are resolved from current articles rather than copied into links.

## Context and scope

`?novel=<UUID>` carries browser context. Private catalog APIs use `?novelId=<UUID>` and validate the selected novel against the authenticated owner. A selector grants no access.

| Consumer | Scope |
| --- | --- |
| Chapters and scenes | Selected novel; a legacy chapter/scene deep link resolves its owning novel |
| Dashboard and worldbuilding directories | Linked material when a novel is selected; explicit whole-library escape |
| Workspace search | Always the author's whole library, including novels, series, and collections |
| Shared article editor and its relationship/reference pickers | Canonical whole-library article and owner-wide choices |
| Location parent picker | Owner-wide geography, including unlinked parent locations |
| Embedded notes and backlinks | Parent-qualified canonical identity; existing links retain their meaning |
| Writing reference panel | Selected novel initially; explicit whole-library expansion |
| Timeline | Canonical dates filtered by declared novel links, with a scope explanation |
| Manual collection | Explicit references, independent of current novel context |
| Smart collection | Owner-wide worldbuilding candidates matched against saved rules |

Copied URLs and reloads preserve novel context. Ordinary scene reassignment is limited to destination chapters in the same novel. A chapter action selects that chapter, including when it has no scenes. Multiple novels require an explicit choice before creating a chapter. Context navigation retains the existing unsaved-writing warning.

Creating worldbuilding material from a scoped directory creates its canonical source and links it to the selected novel. Existing domain routes commit the source before the association write. A failure in that second write returns an error while retaining the creation ID; retrying the same ID repairs the missing association without overwriting or duplicating the source. Invalid novel selectors are rejected before source creation.

## Selected defaults

- A novel can stand alone or have one primary series. Series order is explicit display order and has no story-date meaning.
- Series metadata, membership, and ordering share the series edit revision. Repository writes that create a member, change its primary series, or change its position atomically advance each affected series once. A reorder checks that revision and the exact member list, then updates member positions and revisions together. Stale operations roll back; title or synopsis edits alone do not advance the series revision, and reorder preserves their latest saved text.
- Archived novels remain discoverable, selectable, and editable, and their links continue to count in smart criteria. Archive status changes no ownership, permissions, or manuscript-write behavior.
- Manual collections may mix all supported reference kinds and may reorder their entries. Removing a membership or collection preserves its sources and novel links.
- Smart rules use format version 1, match all or any, and one to eight flat allowlisted predicates: entry type, Lore/location subtype, linked novel, series through novels, minimum distinct linked novels, or unassigned. Tags, nested rules, collection references, and pin/exclusion overrides are deferred.
- Smart candidates are worldbuilding articles and character notes. Embedded notes use their parent character's declared novel links for novel, series, count, and unassigned criteria; the visible criteria summary explains this rule.
- SQL guards prevent deleting a source referenced by a novel association or manual collection. A collected embedded note must be unlinked before removing that note or its private parent document. Deleting a private sample override preserves the virtual sample and links to its reserved ID, provided no collected private notes depend on the override. Novels also cannot be deleted while chapters, associations, or a durable default mapping depend on them. Full trash, transfer, duplication, account deletion, and recovery workflows remain separate lifecycle work.
- Chapter/scene order remains creation time plus ID. No current age, occupation, status, date, or geography field is reinterpreted as a novel override.

## Migration and operations

Migrations `0013`–`0018` add tables, manuscript ownership, and reference guards without rebuilding existing tables. `0017` performs the populated-data backfill entirely in SQL so the same upgrade runs under local SQLite and hosted D1 migration application. For each owner with unassigned legacy chapters, it reuses a durable default mapping, otherwise reuses an existing “Imported manuscript” novel or creates one and records the mapping. Already assigned chapters retain their novel, and owners without unassigned chapters receive no extra default. Renaming a mapped default does not cause a second default to be created. The legacy insert bridge also assigns a default atomically when an older caller omits chapter ownership; current chapter APIs require an explicit novel when several novels exist.

The backfill updates only relational chapter ownership. Existing document bytes, IDs, edit revisions, timestamps, dates, scene links, and creation ordering are preserved. Worldbuilding articles are not automatically declared appearances. `0017` rechecks existing typed associations, and `0018` rechecks collection memberships. Invalid references fail their migration transaction for explicit repair or unlinking before retry; a failed `0017` also rolls back its default creation and chapter assignments.

`scripts/migrate.mjs` applies each SQL file and its `local_migrations` record in one transaction, then runs the local backfill fallback only if unassigned chapters remain. `scripts/migrate-novel-backfill.mjs` remains an idempotent local repair/diagnostic command for installations that already have the ownership schema. It commits each owner independently, rolls back a failed owner, continues with other owners, reports the results, and exits with a failing status if any owner failed. It does not bypass invalid reference guards or replace the SQL upgrade. Migration tests exercise fresh databases, populated upgrades, repeat application, and rollback/retry. Browser tests use isolated temporary databases.

Apply the checked-in migrations before serving the new Worker. Hosting integration and publishing are separate operations; the repository's project association is preserved. Custom triggers are not represented by Drizzle's snapshots and must be recreated if a future generated migration rebuilds these tables.
