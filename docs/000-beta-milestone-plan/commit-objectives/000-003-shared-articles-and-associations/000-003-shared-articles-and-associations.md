# 000-003 — Shared Articles and Associations

> **Delivery slice C** from the coding-agent brief.
> Requires 001–002 to be complete.

---

## 1. One Article Spanning Multiple Books

The default experience is one canonical encyclopedia article for a character, place, faction, or object across the series.

Keep the existing Overview, Biography/History, Relationships, Story significance, and Notes sections. Add an **Appearances** or **In the books** section containing linked novels and optional per-novel prose.

### Example: Claude's Article

- Overview and identity information.
- Biography and early life.
- Appearances: Book 1, describing Claude as an archivist involved in the missing treaty.
- Appearances: Book 2, describing Claude's later role as an envoy.
- Relationships and notes.

The infobox can include linked series and novels, with first appearance only when its meaning is well defined. A book link should navigate to that book's profile. An appearance can have a stable anchor so a book's cast card can open the corresponding part of the character article.

---

## 2. Per-Book Appearance Prose

Store per-book prose on the association rather than duplicating the entire character document. Editing Book 2's appearance text must not overwrite Book 1's text. Editing the main article edits the shared article, and the interface should make that scope understandable.

**Do not automatically reinterpret every existing field as a book override.** The current age, life status, occupation, residence, and present-circumstances fields have no historical/book scope. Preserve their values and meaning during migration. V1 can express changes through attributed prose in the relevant appearance/history sections. A later explicit model can add dated or book-scoped structured facts if required.

---

## 3. Association Labeling

Distinguish a planning reference from an asserted appearance. Linking a research note or source book to a manuscript means it is relevant material, not that it exists inside the narrative. Avoid labeling all associations "Appears in." Suitable labels depend on the entity:

- "Appears in" — for characters, locations, factions present in the narrative.
- "Referenced by" — for Lore, research notes, or thematic material.
- "Linked novels" — for generic or mixed contexts.

Do not infer story chronology from publication order, series display order, or record timestamps. A prequel can be the third released book. Existing custom story dates must retain their precision and original text.

---

## 4. Linking Entities to Novels

Allow linking existing entities to novels and creating new entities while linking them to the current novel.

- Add infobox links and per-book appearance/reference sections.
- Derive backlinks and series aggregates from the same associations.
- Cover every existing worldbuilding type through shared adapters where possible.

---

## 5. Recommended Persistence Design (Associations)

| Concept | Suggested data | Main invariant |
| --- | --- | --- |
| Novel associations | ID, owner, novel ID, typed target identity, optional relation kind and appearance prose, edit revision | One association per novel/target; both sides resolve within the owner |

### Identity and Cross-Type References

Use stable typed references, not titles, URLs, or list positions. New novel, series, story-arc, chapter, and scene target kinds must be supported deliberately. Existing allowlists are spread across:

- `public/characters/notes.js`
- `server/note-connections.js`
- Frontend contracts
- `db/document-contracts.js`

Do not widen every old reference consumer blindly. Either share a well-defined reference layer with compatible readers or use a separate collection/association reference contract with explicit resolvers.

Polymorphic links do not become valid simply because their fields fit JSON. Enforce owner, type, target existence, uniqueness, and archive policy in authoritative writes. Use database constraints/triggers where appropriate and preserve transaction guarantees.

---

## 6. Migration and Compatibility (Associations)

1. Keep all existing worldbuilding content discoverable in the library. Do not assert that every entry appears in the imported novel.
2. If compatibility requires legacy reference links, identify them as planning/reference associations rather than invented narrative appearances.
3. Update JSON contracts, incoming/outgoing serializers, API validation, generated schemas, and the UI field inventory as required. Never silently drop new relationship fields during an older profile save.
4. Verify both a fresh database and an upgrade with populated manuscripts, sample overrides, custom entities, nested notes, and cross-entity links.

---

## 7. Acceptance Criteria (Stage 003)

1. The same character, location, faction, and Lore entry can be linked to both novels without duplicate source documents.
2. Renaming a shared entry updates its linked display labels. Existing links continue resolving by ID.
3. Book 1 and Book 2 appearance/reference prose coexist in the same canonical profile. Editing one association preserves the other and the main article.
4. Existing Lore books remain Lore objects with unchanged identities and URLs.
5. Embedded notes with similar IDs on different characters remain distinct. Reserved sample identities resolve to the correct owner's effective profile.
6. Another owner's IDs cannot be linked, read, edited, searched, or counted. An invalid association rolls back without partial changes.
7. Existing profile links, hidden fields, nested notes, location ancestry, and rich-text scene documents still work after the change.

Use `npm test`, `npm run typecheck`, and `npm run build`. Extend relevant Playwright coverage for affected profile and association behavior.

---

## 8. Scope Boundaries

This stage does not include:
- Manual or smart collections (→ Stage 004)
- Cross-feature search/timeline/dashboard verification (→ Stage 005)
- Public sharing, collaboration, AI generation, or export
