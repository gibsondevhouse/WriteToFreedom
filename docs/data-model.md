# Data model and integrity contract

Reviewed September 24, 2026. The current model combines relational identity and ownership with validated JSON content. That is a suitable foundation for the existing worldbuilding and writing features. Future AI features should use the same validated write boundary and preserve the distinction between author content, derived displays, and generated proposals.

The follow-up [UI persistence audit](ui-persistence.md) verifies every current profile template and nested editor through save/reload. The fields inside SQL JSON columns are now explicitly described by [documents.schema.json](../db/documents.schema.json), generated from [document-contracts.js](../db/document-contracts.js). See [the field inventory](ui-field-inventory.md) for UI labels, persisted paths, and nested shapes.

## Canonical records

| Entity | Canonical storage | Reference identity |
| --- | --- | --- |
| Character | `character_drafts.document` | Character ID; sample URL IDs map to owner-specific stored UUIDs |
| Faction | `factions` identity/name plus `faction_profiles.document` | Faction ID |
| Location | `locations` identity/type/parent plus country, city, or generic profile document | Location ID; type is immutable |
| Lore | `lore_entries.document` | Lore ID and immutable type |
| Story arc | `story_arcs.document` | Arc ID; embedded key scenes also have stable IDs |
| Manuscript chapter | `chapters.document` | Chapter UUID |
| Manuscript scene | `scenes.document` and `scenes.chapter_id` | Scene UUID; chapter must belong to the same owner |
| Character note | Embedded in its character document | Character ID **and** note ID |

Names, labels, list positions, and URLs are display values, not relationship keys. A story arc's key-scene `chapter` field is free text, **not** a manuscript chapter reference. Key scenes and manuscript scenes are currently separate concepts. Legacy key scenes receive deterministic arc-scoped IDs on read, which persist on their next successful save. New key scenes use UUIDs.

Catalog cards, mentions, backlinks, timeline events, computed ratings, and search summaries are derived projections. Do not save a card or search result as a canonical document; fetch the editable entity first.

## Three different versions

- `version` is a safe integer edit revision. Persisted documents start at 1. Version 0 denotes an unsaved/default profile. Writes compare the expected revision and increment it exactly once; it is not a history of prior content.
- `schemaVersion` represents the document envelope format, stored as `schema_version` independently of the JSON text. Current format: 1. Migration `0010` assigns 1 to existing documents without rewriting their content. Clients may omit it for compatibility; a supplied unsupported value is rejected. Unsupported stored formats fail closed on reads and cannot be overwritten by current repository updates.
- `contentSchemaVersion` is specific to manuscript scenes' rich-text tree. Current format: 1. Its allowed nodes, marks, nesting, and size limits live in `public/writing/document.js`.

Changing a document format requires an explicit decoder/migration strategy. Do not repurpose the edit revision as a format indicator. Server-controlled IDs, revisions, and timestamps are overlaid from SQL columns rather than trusted from the submitted document.

Exact multi-select labels live in `choiceSelections` arrays; the older scalar fields remain synchronized display/compatibility projections. Prefer the arrays when consuming these fields programmatically. Migration `0012` records generic-location edit times; historical records with no known edit time retain null, rather than an invented timestamp.

## Enforced boundaries

Routes authenticate the owner, validate field types/limits and supported enums, reject conflicting body/path identities and unsupported formats, and validate references against the owner's catalogs. Existing unresolved references in some JSON relationships are retained for compatibility; new unavailable references are rejected. Hidden fields retain their content.

The additive `0011` migration also installs database triggers for:

- JSON object envelopes, nonempty identities, positive safe revisions and format versions, immutable row identities/owners, and revision advancement when content or format changes.
- Owner-consistent scene/chapter links, agreement between JSON `chapterId` and the relational parent, and protection against deleting referenced chapters.
- Profile targets with matching owner and entity type, with explicit allowances for reserved source-defined samples; referenced catalog rows cannot be deleted.
- Immutable location types, permitted parent types and ownership, required parents for cities/areas/landmarks, hierarchy-cycle rejection, and protection against deleting parent locations still in use.

These checks complement domain validators: an arbitrary JSON object can still be invalid for a particular profile template. SQL is not an alternative public write API. Embedded character relationships, lore connections, leaders, capitals, and other JSON references do not have complete database foreign-key enforcement.

Profile and catalog edits execute in one database batch. Hierarchy checks run inside that write, so concurrent reparenting cannot create an area cycle after both requests pass preliminary validation. A failing catalog update rolls back its accompanying profile write. Save acknowledgements return the revision written by that request rather than rereading and accidentally acknowledging a later writer's revision. Stale revisions return a conflict without replacing the client's draft.

## Samples and scope

Source-defined samples are virtual defaults with private owner overrides. Their IDs are reserved compatibility identifiers. Keep seed IDs stable: removing one from the source catalogs can hide saved overrides, and changing character seed recognition changes its private storage mapping. Profile target triggers also encode the reserved sample IDs. A future removal must migrate both identity and references, or materialize samples as owner-owned records first.

`owner_id` currently scopes an author's entire collection. There is no separate book, manuscript, project, world, membership, or collaborative permission model. Add that boundary deliberately before supporting multiple independent worlds or shared writing; do not infer it from tags or names.

## Migrations and verification

`db/schema.ts` and Drizzle snapshots describe columns, indexes, and the original scene foreign key. SQLite triggers live in the custom `0011` SQL migration because Drizzle does not model them. Future generated table rebuilds must preserve/recreate these triggers. Check schema diffs, apply every checked-in migration to a fresh database, and test upgrades from existing data.

The local migration runner commits each SQL file and its journal entry in one transaction; failure rolls both back, allowing a corrected migration to retry. Hosted D1 deployment remains a separate integration check. The new migrations are additive and do not rewrite or discard existing document bytes. Triggers protect subsequent writes; they do not automatically repair pre-existing malformed records.

Regression coverage includes direct SQL rejection, owner/type boundaries, atomic profile rollback, concurrent save acknowledgements, format-version rejection, stable nested identity, and migration failure/retry. During this review, a read-only snapshot of the existing local database was upgraded in memory: original values were unchanged, SQLite integrity passed, and existing rows passed the new envelope/reference checks. The source database was not modified by that audit.

## Decisions before AI integration

1. **Source snapshots and proposals.** Record entity kind, ID, owner/world scope, schema version, and exact edit revision for every source an AI job consumes. Keep generated proposals, model/prompt provenance, and review decisions separate from canonical author content. Applying a proposal must use the expected revision and the ordinary validators. Revision counters alone cannot reconstruct old content; add retained snapshots/history if that is needed.
2. **Relationships and graph consistency.** If retrieval or AI workflows need reliable graph queries, introduce typed relation records and indexes, with owner/world-scoped targets and explicit deletion/unresolved-link policies. Current JSON relationships are acceptable for the UI but are not a fully constrained knowledge graph. Some cross-entity checks remain susceptible to concurrent edits of different records.
3. **Manuscript structure.** Decide how arc key scenes connect to manuscript scenes, and add explicit author-controlled chapter/scene ordering when the product supports rearranging a manuscript. Current writing order is creation time plus ID.
4. **Extraction semantics.** Narrative dates and many quantities are author-entered text. Do not interpret them as precise Gregorian dates or numerical facts without retaining the original value, uncertainty, and extraction provenance. Derived indexes should be rebuildable from canonical documents and versioned independently.

No AI provider calls, embeddings, generated claims, or speculative AI tables were introduced by this hardening pass.
