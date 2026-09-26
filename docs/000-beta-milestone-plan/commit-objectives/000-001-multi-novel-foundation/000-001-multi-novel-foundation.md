# 000-001 — Multi-Novel Foundation

> **Delivery slice A** from the coding-agent brief.
> Complete this stage before moving to 002.

---

## 1. User Requirements and Design Authority

The user wants a public product supporting multiple novels. Characters, locations, factions, objects, notes, and other material must be reusable across books, particularly within a series. They like albums, collections, and smart collections as organizational concepts.

The user explicitly corrected the visual interpretation:

> "I'm using Plex and Wikipedia as the inspirations for my UI … check out the way the profile shell is made."

The existing application is the design authority. Use its cards, rails, directories, article profiles, and infoboxes. The earlier conversational library-and-inspector mockup is superseded and must not be treated as a design reference.

Apply the inspirations to these responsibilities:

- **Plex-inspired browsing:** visually browse books, series, and collections through the application's established cards and rails.
- **Wikipedia-inspired profiles:** open complete, linked articles with structured infoboxes, readable sections, references, and inline editing.
- **Album/collection organization:** reference the same entry from several books and collections without creating copies.

The detailed schema, route names, optional fields, and phased delivery below are implementation recommendations. They are not additional requirements explicitly dictated by the user. Resolve routine choices consistently with the repository and document material deviations.

---

## 2. Product Model

### Library

The library is the author's whole body of material. It is a logical view of the existing owner-scoped records, not a requirement to move every record into a new universal content table.

An entity keeps its identity and canonical profile when it is linked to another book. Reusing Claude in a sequel means linking the sequel to Claude's existing article. Renaming Claude updates the displayed name in every linked view because those views resolve the same ID.

Entries may be unattached to a book. Writers must be able to collect ideas before deciding where to use them.

### Novel

A novel is a manuscript project with its own profile, chapters, scenes, and links to relevant library entries. It can stand alone or belong to a series.

**Naming collision:** `public/lore/template.js` already defines `type: 'book'`. This means a book inside the fictional world, with author/compiler, contents, editions, and provenance. It is not a manuscript project. Prefer the internal name `novel` for the new manuscript entity. The UI can say Books or Novels, but it must make the distinction clear and preserve existing Lore book records and routes.

### Series

A series has its own profile and an explicit order of novels. A pragmatic V1 default is zero or one primary series per novel. This is a proposed simplification; it does not prevent a shared character from being linked to novels in different series.

Do not require every author to create a series or a fictional world before writing a standalone novel. Do not treat a series as a new security boundary.

---

## 3. Recommended Persistence Design

Preserve the existing typed entity tables and document contracts. Suggested new relational concepts follow; exact names can change to match repository conventions.

| Concept | Suggested data | Main invariant |
| --- | --- | --- |
| `novels` | ID, owner, versioned profile document, timestamps; optional primary series and order | Owns a manuscript; independent of Lore `book` |
| `series` | ID, owner, versioned profile document, timestamps | Groups novels without owning their shared entities |
| Novel associations | ID, owner, novel ID, typed target identity, optional relation kind and appearance prose, edit revision | One association per novel/target; both sides resolve within the owner |

### Identity and Cross-Type References

Use stable typed references, not titles, URLs, or list positions. The repository currently supports `{kind, id}` for most note targets and `{kind: 'note', characterId, id}` for embedded character notes. Preserve the parent character in note identities.

New novel, series, story-arc, chapter, and scene target kinds must be supported deliberately. Existing allowlists are spread across `public/characters/notes.js`, `server/note-connections.js`, frontend contracts, and `db/document-contracts.js`. Do not widen every old reference consumer blindly. Either share a well-defined reference layer with compatible readers or use a separate collection/association reference contract with explicit resolvers.

Polymorphic links do not become valid simply because their fields fit JSON. Enforce owner, type, target existence, uniqueness, and archive policy in authoritative writes. Use database constraints/triggers where appropriate and preserve transaction guarantees. Do not introduce an unconstrained generic relation table and assume application dropdowns provide integrity.

### Manuscript Ownership

Give chapters a required novel association after legacy content is migrated. Scenes can derive their novel from their owning chapter. If scene-level `novel_id` is also stored for query efficiency, enforce its agreement with the chapter's novel.

Existing scene reassignment must only offer and accept valid destination chapters. The V1 default should restrict ordinary moves to the current novel. Cross-novel transfer or duplication requires a deliberate operation; do not make manuscript text a live shared document merely because characters are reusable.

Any added relational/JSON copies of book identity must be validated for agreement. Keep scene summary queries content-free, as `server/writing-repository.js` currently does.

### Ordering and Versions

Persist explicit novel order within a series. Keep ordering stable under renames and reloads. Use a clear concurrency policy for reorder operations: atomic updates with a collection/order revision or equivalent checked transaction.

The current chapter and scene order is creation time plus ID. Preserve that order during migration. Author-controlled manuscript reordering remains a separate V1 improvement unless it is intentionally included in the implementation slice.

Preserve the distinction between edit `version`, document `schemaVersion`, and scene `contentSchemaVersion`. Revision counters are not stored history. Association edits and collection-rule edits need their own conflict protection or a clearly designated parent revision; they must not overwrite unrelated prose saves.

---

## 4. Migration and Compatibility

Read `docs/data-model.md`, `db/schema.ts`, and the migrations before designing the transition.

1. Add tables and relationships incrementally. Preserve existing document bytes, IDs, edit revisions, and stored dates unless a deliberate versioned transformation is required.
2. For owners with existing manuscripts, create one stable default novel such as "Imported manuscript" and attach their existing chapters. Preserve scene-to-chapter relationships and current order. Determine owners from persisted data; there is no established application accounts table to assume.
3. Keep all existing worldbuilding content discoverable in the library. Do not assert that every entry appears in the imported novel. If compatibility requires legacy reference links, identify them as planning/reference associations rather than invented narrative appearances.
4. Make the transition repeatable and transactional. Partial failure must not create several default novels or orphan chapters.
5. Preserve the source-defined samples and private override mapping. Sample IDs are reserved and appear in integrity triggers. Do not rename, remove, or globally materialize samples as a shortcut. Resolve any association through the owner's effective sample record. Make demo-onboarding cleanup a separate explicit change if needed.
6. Existing location parents remain geographical/worldbuilding relationships; they must not be repurposed for novel/series containment. A location can be linked to multiple books without changing its parent or copying its children.
7. Update JSON contracts, incoming/outgoing serializers, API validation, generated schemas, and the UI field inventory as required. Never silently drop new relationship fields during an older profile save.
8. Verify both a fresh database and an upgrade with populated manuscripts, sample overrides, custom entities, nested notes, and cross-entity links.

The custom `0011` migration installs integrity triggers that Drizzle's schema representation does not fully model. Preserve or recreate them during any table rebuild. Later migrations must extend those guarantees, not accidentally remove them.

---

## 5. Privacy and Write Safety

Public product is the launch target, but this milestone does not make a writer's material public. Keep current owner-based privacy. Sharing/collaboration is a separate feature.

Every novel, series, membership, collection, and smart-rule read/write must resolve within the authenticated owner. The Worker currently relies on a trusted hosting identity header. A user-supplied novel or collection ID is a resource selector, never proof of access.

Apply existing same-origin JSON mutation checks, escaping, no-store private responses, request limits, idempotent creation where appropriate, and optimistic concurrency. Search, backlinks, counts, and empty/error messages must not leak another owner's data.

Removing an association should preserve the underlying article. Removing a book from a series should preserve its manuscript. Removing a collection should preserve its members. Introduce archive/trash behavior deliberately; avoid cascading deletion of manuscripts or shared profiles. Full entity/account deletion remains a separate lifecycle feature with dependency and recovery rules.

Protect dirty edits when switching novel context. Do not replace a mounted editor or silently navigate away from unsaved scenes. New context changes must retain the protections described in `docs/writing-workspace.md`.

---

## 6. Acceptance Criteria (Stage 001)

The coding agent should demonstrate these behaviors with meaningful automated coverage:

1. An author can create two novels, optionally group them in a series, reorder them, save, and reopen the same structure.
2. Existing manuscript content survives migration under the default novel with identical prose and valid scene/chapter links.
3. Existing Lore books remain Lore objects with unchanged identities and URLs.
4. Another owner's IDs cannot be linked, read, edited, searched, or counted. An invalid association rolls back without partial changes.
5. Conflicting profile, association, rule, and ordering edits produce recoverable errors rather than overwriting newer content.
6. Dirty writing survives a failed save; context switches warn or retain it according to the existing editor contract.

Use `npm test`, `npm run typecheck`, and `npm run build` to verify. Keep test databases isolated from the author's local data.

---

## 7. Scope Boundaries

This stage does not include:
- Profile UI for novels or series (→ Stage 002)
- Shared article appearance sections (→ Stage 003)
- Collections (→ Stage 004)
- Cross-feature search/timeline verification (→ Stage 005)
- Public sharing, collaboration, AI generation, payment processing, or export
