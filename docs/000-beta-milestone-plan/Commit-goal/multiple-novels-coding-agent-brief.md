# Multiple novels, series, and shared encyclopedia: coding-agent brief

This is an implementation handoff for Write to Freedom. It describes the next product foundation; it does not claim that these features are implemented. The current request is to explain the direction to a coding agent, not to deploy application changes.

## 1. User requirements and design authority

The user wants a public product supporting multiple novels. Characters, locations, factions, objects, notes, and other material must be reusable across books, particularly within a series. They like albums, collections, and smart collections as organizational concepts.

The user explicitly corrected the visual interpretation:

> “I'm using Plex and Wikipedia as the inspirations for my UI … check out the way the profile shell is made.”

The existing application is the design authority. Use its cards, rails, directories, article profiles, and infoboxes. The earlier conversational library-and-inspector mockup is superseded and must not be treated as a design reference.

Apply the inspirations to these responsibilities:

- **Plex-inspired browsing:** visually browse books, series, and collections through the application's established cards and rails.
- **Wikipedia-inspired profiles:** open complete, linked articles with structured infoboxes, readable sections, references, and inline editing.
- **Album/collection organization:** reference the same entry from several books and collections without creating copies.

The detailed schema, route names, optional fields, and phased delivery below are implementation recommendations. They are not additional requirements explicitly dictated by the user. Resolve routine choices consistently with the repository and document material deviations.

## 2. Product model

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

### Collections

A manual collection contains selected references. It may mix characters, locations, factions, Lore entries, notes, story arcs, novels, and other supported record types. An entry can belong to several collections.

A smart collection stores criteria and derives its members. For example: characters linked to a particular novel, places used across a series, or entries linked to two or more novels.

Collection membership, novel association, and manuscript ownership are distinct:

- Adding a character to “Royal court” does not automatically add the character to a novel.
- A smart collection matching an entry does not mutate the entry or create an appearance.
- Removing a collection membership does not delete the entry.
- Chapters and scenes remain owned by one manuscript even if a collection links to them.

## 3. Extend the actual profile shell

Inspect these sources before editing:

- `server/profile-components.js`: `renderProfilePage`, `renderSection`, `renderInfoGroup`, `renderProfileName`, and field helpers.
- `public/profiles/profile.css` and `public/profiles/editor.css`: shared appearance and current layout.
- `public/profiles/controls.js`, `viewport.js`, and `editor.js`: collapse, field visibility, sticky behavior, and save lifecycle.
- `server/render-profile.js`: character-specific composition, relationships, and references.
- `server/render-story-arc.js`: useful example of a new profile type composed from shared primitives and linked entities.
- `server/workspace-shell.js` and `public/workspace-shell.css`: application navigation and topbar.

The current shell consists of breadcrumbs, a sticky article/save bar, one editing form, an article column on the left, and an infobox on the right. The infobox becomes sticky while reading and scrolls independently on wide screens. The article uses collapsible headings and inline fields. The narrow layout stacks the content. Profile navigation uses breadcrumbs and section anchors; do not invent a table-of-contents sidebar as if it already exists.

Preserve:

- The established typography, dark palette, spacing, card treatment, and link styling.
- Stable section and field anchors.
- Explicit save status, dirty-state protection, keyboard saving, and error retention.
- Field visibility independently of content: hiding or collapsing a field must never remove its saved value.
- Shared interaction ownership: initialize one editor/controller per region.
- The separation between outer workspace navigation and profile composition.

Use new entity adapters and small shared extension points. Do not fork the whole profile document into unrelated copies or redesign existing character pages around a library inspector.

## 4. New page experiences

### Novel profile

Compose a novel using the existing article/infobox shell.

Suggested infobox content: title, cover image, primary series, position in that series, and drafting status. Optional metadata should follow the existing visibility system; avoid making a large form of mandatory publishing details.

Suggested article sections:

1. Overview and synopsis.
2. Manuscript: ordered chapters with links to the correct writing context.
3. Characters linked to this novel.
4. Locations and factions.
5. Lore, objects, notes, and story arcs.
6. Open questions and references where useful.

Reuse suitable existing cards for linked content; keep article prose in article form. Provide an action that opens the actual scene-writing workspace for this novel. The profile describes and organizes the manuscript; the existing Tiptap workspace remains where manuscript prose is written.

### Series profile

Use the same shell with a series title, optional artwork, and summary. Its central content is an explicitly ordered list of novels, followed by appropriate overview prose and shared material.

Derive the series' linked entity view from its novels for V1. Count a character once even when it appears in several volumes. Do not maintain a second independently editable copy of that membership. Explicit series-only planning references can be added later if needed.

### Browsing and collection pages

Use `server/dashboard-shell.js` and `public/dashboard/components.js` for overview rails. Use `server/directory-shell.js` and `public/directory/shell.js` for searchable result pages. Follow `docs/dashboard-shell.md` and `docs/directory-shell.md` for lifecycle and extension contracts.

Books and Series can become navigation destinations within the existing workspace. Collections should open familiar grids/lists and canonical profiles. Do not add a second application navigation system.

For mixed collections, resolve each reference to the appropriate existing card or a compatible list entry. Missing optional imagery must retain readable titles and metadata. A rule editor belongs in a focused collection editing surface; it should not dominate ordinary browsing.

## 5. One article spanning multiple books

The default experience is one canonical encyclopedia article for a character, place, faction, or object across the series.

Keep the existing Overview, Biography/History, Relationships, Story significance, and Notes sections. Add an **Appearances** or **In the books** section containing linked novels and optional per-novel prose.

For example, Claude's article could contain:

- Overview and identity information.
- Biography and early life.
- Appearances: Book 1, describing Claude as an archivist involved in the missing treaty.
- Appearances: Book 2, describing Claude's later role as an envoy.
- Relationships and notes.

The infobox can include linked series and novels, with first appearance only when its meaning is well defined. A book link should navigate to that book's profile. An appearance can have a stable anchor so a book's cast card can open the corresponding part of the character article.

Store per-book prose on the association rather than duplicating the entire character document. Editing Book 2's appearance text must not overwrite Book 1's text. Editing the main article edits the shared article, and the interface should make that scope understandable.

**Do not automatically reinterpret every existing field as a book override.** The current age, life status, occupation, residence, and present-circumstances fields have no historical/book scope. Preserve their values and meaning during migration. V1 can express changes through attributed prose in the relevant appearance/history sections. A later explicit model can add dated or book-scoped structured facts if required.

Distinguish a planning reference from an asserted appearance. Linking a research note or source book to a manuscript means it is relevant material, not that it exists inside the narrative. Avoid labeling all associations “Appears in.” Suitable labels depend on the entity: “Appears in,” “Referenced by,” or “Linked novels.”

Do not infer story chronology from publication order, series display order, or record timestamps. A prequel can be the third released book. Existing custom story dates must retain their precision and original text.

## 6. Recommended persistence design

Preserve the existing typed entity tables and document contracts. Suggested new relational concepts follow; exact names can change to match repository conventions.

| Concept | Suggested data | Main invariant |
| --- | --- | --- |
| `novels` | ID, owner, versioned profile document, timestamps; optional primary series and order | Owns a manuscript; independent of Lore `book` |
| `series` | ID, owner, versioned profile document, timestamps | Groups novels without owning their shared entities |
| Novel associations | ID, owner, novel ID, typed target identity, optional relation kind and appearance prose, edit revision | One association per novel/target; both sides resolve within the owner |
| Manual collections | ID, owner, profile/metadata, revision, timestamps | Membership is explicitly selected |
| Collection members | Owner, collection ID, typed target, optional position | Unique collection/target; resolves the original record |
| Smart collections | ID, owner, metadata, validated rule document and rule format version | Results are derived; no copied entity documents |

A single collection table with a manual/smart discriminator is reasonable. Keep rules and manual membership behavior mutually understandable; V1 does not need smart results plus custom pin/exclusion overrides.

### Identity and cross-type references

Use stable typed references, not titles, URLs, or list positions. The repository currently supports `{kind, id}` for most note targets and `{kind: 'note', characterId, id}` for embedded character notes. Preserve the parent character in note identities.

New novel, series, story-arc, chapter, and scene target kinds must be supported deliberately. Existing allowlists are spread across `public/characters/notes.js`, `server/note-connections.js`, frontend contracts, and `db/document-contracts.js`. Do not widen every old reference consumer blindly. Either share a well-defined reference layer with compatible readers or use a separate collection/association reference contract with explicit resolvers.

Polymorphic links do not become valid simply because their fields fit JSON. Enforce owner, type, target existence, uniqueness, and archive policy in authoritative writes. Use database constraints/triggers where appropriate and preserve transaction guarantees. Do not introduce an unconstrained generic relation table and assume application dropdowns provide integrity.

### Manuscript ownership

Give chapters a required novel association after legacy content is migrated. Scenes can derive their novel from their owning chapter. If scene-level `novel_id` is also stored for query efficiency, enforce its agreement with the chapter's novel.

Existing scene reassignment must only offer and accept valid destination chapters. The V1 default should restrict ordinary moves to the current novel. Cross-novel transfer or duplication requires a deliberate operation; do not make manuscript text a live shared document merely because characters are reusable.

Any added relational/JSON copies of book identity must be validated for agreement. Keep scene summary queries content-free, as `server/writing-repository.js` currently does.

### Ordering and versions

Persist explicit novel order within a series. Keep ordering stable under renames and reloads. Use a clear concurrency policy for reorder operations: atomic updates with a collection/order revision or equivalent checked transaction.

The current chapter and scene order is creation time plus ID. Preserve that order during migration. Author-controlled manuscript reordering remains a separate V1 improvement unless it is intentionally included in the implementation slice.

Preserve the distinction between edit `version`, document `schemaVersion`, and scene `contentSchemaVersion`. Revision counters are not stored history. Association edits and collection-rule edits need their own conflict protection or a clearly designated parent revision; they must not overwrite unrelated prose saves.

## 7. Smart collections: bounded V1

Start with rules that the actual data can answer reliably:

- Entity type, including optional Lore/location subtype.
- Linked novel.
- Membership in a series through its novels.
- Number of linked novels, counting distinct novel associations.
- Unassigned to any novel.

Add tags when their cross-entity storage and matching semantics are explicit. Tags are not currently uniform across the application; do not silently infer them from prose or treat a free-text comma convention as a reliable universal tag system.

Use a small serializable rule document: a version, a flat list of allowlisted predicates, and match-all or match-any mode. Apply sensible rule-count and value limits. A smart collection must display an understandable summary of its criteria.

Evaluate rules against owner-scoped data, on the server where practical. Use parameterized queries and allowlisted fields/operators. Never store or execute user-written SQL or JavaScript. Avoid recursive collection references and arbitrarily nested rule trees in V1.

Results update after relevant saves and membership changes. If a cache or derived index is introduced, key it by owner and relevant scope, invalidate it consistently, and keep it rebuildable from canonical records. A smart collection should not become a stale copied list of IDs.

## 8. Navigation, search, and context

Add a visible current novel/library context using the existing workspace navigation. A recommended placement is the existing “My workspace” area, but fit the current shell rather than assuming a new topbar.

Inside a selected novel:

- Chapters and Scenes show that novel's manuscript.
- Worldbuilding directories can show its linked entries, with a clear way to browse the whole library and add an existing entry.
- Search clearly indicates whether it searches this novel or all material. Include new novel and series profiles in global search.
- A shared profile retains its canonical identity and remains a complete article; arriving from a book can preserve a back link or jump to that book's appearance section.

Represent durable navigation context in routes/query parameters where appropriate so refreshes and copied links work. Browser preferences may remember the last view, but they cannot determine authorization or hold the only copy of book membership.

Audit every consumer of owner-wide catalogs: dashboards, directories, search, reference pickers, notes/backlinks, story arcs, timeline, and the writing reference panel. Define whether each uses the whole library or the selected novel. Do not implement book filtering only in the visible card grid while saves or search still target an unintended manuscript.

When showing a novel-filtered timeline, filter by declared associations and label the scope. A shared entity's lifetime dates are not automatically events within every linked novel. Do not duplicate canonical events or invent dates from book order.

Preserve current deep links and routes. One existing issue worth handling in the context work is that chapter cards currently link to `/scenes/` without selecting that chapter. A novel/chapter action must open the correct destination, not the first scene from an unrelated book.

## 9. Migration and compatibility

Read `docs/data-model.md`, `db/schema.ts`, and the migrations before designing the transition.

1. Add tables and relationships incrementally. Preserve existing document bytes, IDs, edit revisions, and stored dates unless a deliberate versioned transformation is required.
2. For owners with existing manuscripts, create one stable default novel such as “Imported manuscript” and attach their existing chapters. Preserve scene-to-chapter relationships and current order. Determine owners from persisted data; there is no established application accounts table to assume.
3. Keep all existing worldbuilding content discoverable in the library. Do not assert that every entry appears in the imported novel. If compatibility requires legacy reference links, identify them as planning/reference associations rather than invented narrative appearances.
4. Make the transition repeatable and transactional. Partial failure must not create several default novels or orphan chapters.
5. Preserve the source-defined samples and private override mapping. Sample IDs are reserved and appear in integrity triggers. Do not rename, remove, or globally materialize samples as a shortcut. Resolve any association through the owner's effective sample record. Make demo-onboarding cleanup a separate explicit change if needed.
6. Existing location parents remain geographical/worldbuilding relationships; they must not be repurposed for novel/series containment. A location can be linked to multiple books without changing its parent or copying its children.
7. Update JSON contracts, incoming/outgoing serializers, API validation, generated schemas, and the UI field inventory as required. Never silently drop new relationship fields during an older profile save.
8. Verify both a fresh database and an upgrade with populated manuscripts, sample overrides, custom entities, nested notes, and cross-entity links.

The custom `0011` migration installs integrity triggers that Drizzle's schema representation does not fully model. Preserve or recreate them during any table rebuild. Later migrations must extend those guarantees, not accidentally remove them.

## 10. Privacy and write safety

Public product is the launch target, but this milestone does not make a writer's material public. Keep current owner-based privacy. Sharing/collaboration is a separate feature.

Every novel, series, membership, collection, and smart-rule read/write must resolve within the authenticated owner. The Worker currently relies on a trusted hosting identity header. A user-supplied novel or collection ID is a resource selector, never proof of access.

Apply existing same-origin JSON mutation checks, escaping, no-store private responses, request limits, idempotent creation where appropriate, and optimistic concurrency. Search, backlinks, counts, and empty/error messages must not leak another owner's data.

Removing an association should preserve the underlying article. Removing a book from a series should preserve its manuscript. Removing a collection should preserve its members. Introduce archive/trash behavior deliberately; avoid cascading deletion of manuscripts or shared profiles. Full entity/account deletion remains a separate lifecycle feature with dependency and recovery rules.

Protect dirty edits when switching novel context. Do not replace a mounted editor or silently navigate away from unsaved scenes. New context changes must retain the protections described in `docs/writing-workspace.md`.

## 11. Suggested delivery sequence

### A. Multi-novel foundation

Implement versioned novel/series records, explicit series ordering, manuscript ownership, and safe migration. Establish API and reference contracts, including the distinction from Lore books. Provide enough navigation to reach and verify each novel.

### B. Profiles and browsing

Build novel and series profiles through the existing profile primitives. Add their directories/rails with existing shells and components. Connect manuscript actions to the correct novel and chapter.

### C. Shared articles and associations

Allow linking existing entities to novels and creating new entities while linking them to the current novel. Add infobox links and per-book appearance/reference sections. Derive backlinks and series aggregates from the same associations. Cover every existing worldbuilding type through shared adapters where possible.

### D. Collections

Implement mixed manual collections and bounded smart rules. Reuse existing cards and directory behavior. Clearly separate matching, membership, and source editing.

### E. Cross-feature verification

Verify scope across search, dashboards, references, notes, timeline, and writing. Check migration, reload, concurrency, and existing profile behavior. Complete the selected milestone end to end; do not present static pages or in-memory membership as completed persistence.

The first development milestone can be A–C. Manual and smart collections are the next slice of the same requested direction. If asked to implement the entire brief, complete A–E rather than stopping after the first slice.

## 12. Acceptance criteria

The coding agent should demonstrate these behaviors with meaningful automated coverage and report any remaining limitations:

1. An author can create two novels, optionally group them in a series, reorder them, save, and reopen the same structure.
2. Existing manuscript content survives migration under the default novel with identical prose and valid scene/chapter links.
3. Existing Lore books remain Lore objects with unchanged identities and URLs.
4. The same character, location, faction, and Lore entry can be linked to both novels without duplicate source documents.
5. Renaming a shared entry updates its linked display labels. Existing links continue resolving by ID.
6. Book 1 and Book 2 appearance/reference prose coexist in the same canonical profile. Editing one association preserves the other and the main article.
7. Novel and series profiles match the existing article/infobox structure and preserve collapse, visibility, save, and narrow-layout behavior.
8. A chapter action opens the right novel/chapter/scene. No manuscript list or creation flow silently uses a different novel.
9. A mixed manual collection retains membership after reload. Removing a member preserves its source profile and book associations.
10. A smart collection updates after a qualifying association is added or removed, counts each novel once, and does not mutate source records.
11. Embedded notes with similar IDs on different characters remain distinct. Reserved sample identities resolve to the correct owner's effective profile.
12. Another owner's IDs cannot be linked, read, edited, searched, or counted. An invalid association rolls back without partial changes.
13. Conflicting profile, association, rule, and ordering edits produce recoverable errors rather than overwriting newer content.
14. Dirty writing survives a failed save; context switches warn or retain it according to the existing editor contract.
15. Existing profile links, hidden fields, nested notes, location ancestry, and rich-text scene documents still work after the change.

Use the repository's focused Node suites during implementation, then `npm test`, `npm run typecheck`, and `npm run build`. Extend/run relevant Playwright coverage for affected profile, navigation, and writing behavior when performing the implementation's browser verification. Keep test databases isolated from the author's local data. A prior passing suite is background evidence, not validation of new changes.

## 13. Scope boundaries and delivery report

This brief does not request a new visual language, universal frontend rewrite, AI generation, collaboration, public sharing of manuscripts, payment processing, a generic knowledge-graph engine, or a per-field alternate-canon system. Autosave, durable recovery, export, and broader account lifecycle work remain V1 roadmap items, but should not be silently folded into this foundational implementation.

Preserve `.openai/hosting.json` and the current project association. This handoff alone is not an instruction to deploy. When implementation and deployment are requested, use the applicable project/Sites workflow and current audience permissions.

On completion, report what users can do, the migration behavior, the confirmed tests/checks, any selected defaults that affect product behavior, and material unfinished work. Identify whether the delivered slice is A–C or the full A–E scope. Do not claim an implementation is complete merely because its schema or UI exists.

The intended result is an interconnected writing encyclopedia with multiple manuscripts: books and series organize the work, reusable articles describe the world, and collections provide additional ways to find and group the same material.
