# UI-to-schema persistence audit

This audit follows editable controls through browser serialization, route validation, the physical SQLite JSON document, a fresh API read, and a page reload. It covers the current UI, including nested controls that are not ordinary named form inputs.

## Explicit document schemas

The data model has two layers:

- [schema.ts](../db/schema.ts) defines SQL identities, ownership, revisions, timestamps, indexes, and table relationships.
- [documents.schema.json](../db/documents.schema.json) defines the fields **inside** each JSON document: types, enums, field limits, arrays, nested objects, references, visibility, and ratings. Its 21 entity definitions also identify their storage table and discriminator. Shared definitions cover character notes, typed references, and recursive rich text.

[document-contracts.js](../db/document-contracts.js) generates the JSON Schema from the same templates used by the UI, supplemented with explicit nested contracts. [The field inventory](ui-field-inventory.md) lists the stored path and meaning of every declared profile field. Run `npm run schema:documents` after changing a template or nested contract. Tests fail if either generated artifact is stale, and Ajv validates actual stored documents from the persistence tests against the generated schema.

These schemas describe normalized document JSON, not a raw API request or SQL row. IDs, authenticated ownership, revisions, and timestamps remain server-owned metadata. Application validators still handle target ownership, legacy compatibility, exact cross-field equality, UTF-16 string limits, and aggregate rich-text limits. An arbitrary schema-valid reference is not permission to access its target.

## Coverage

The counts below refer to field slots across templates; a shared field such as `summary` appears in each applicable profile type.

| UI surface | Stored authored state | Verified coverage |
| --- | --- | --- |
| Character profile | 51 scalar fields, exact multi-choice arrays, custom nationality→continent assignments, relationships, field visibility, 20 attribute ratings | Every template control edited in Chromium, saved, reopened, and saved again; nested documents checked against JSON Schema |
| Character notes and cards | Note titles/type/text/tags, source field and UTF-16 anchor, ordered inline text/reference spans, linked entities, featured item, dimensions, units, morality, portrait, ratings | Real note creation, quick-created notes, marker placement/removal/renumbering, and independent card edits preserve unrelated profile data |
| Faction, country, city, and eight other location types | 362 scalar fields, 148 ratings, visibility, names/types/parents, leaders, capitals, dates, media URLs, exact language arrays | All 11 templates covered through browser inputs, SQLite JSON, API reload, and rendered initial data; partial updates and explicit clearing checked |
| Six Lore types | 140 scalar fields, 64 ratings, primary/overlapping collections, pin/feature choices, typed connections with relationship descriptions, visibility | Every type exercised through its actual React or legacy UI, including connections, dates, rating zero/unset, save/reload, and removal |
| Story arcs | 31 scalar fields, 18 pacing values, selected entities, connected arcs, ordered key scenes with stable IDs, chapter labels, beat selection, summary prose, visibility | All prompts/sliders and nested content save/reload; reordering preserves identity; unavailable legacy entities remain visible and removable |
| Chapters and manuscript scenes | Title/summary, chapter membership, drafting status, versioned rich-text tree | Chapter edits, scene moves, metadata edits, headings, lists, blockquotes, text marks and separators survive the editor→SQL→editor round trip |

Together the profile surfaces contain **584 scalar fields**, **232 ratings**, and **18 pacing values**, in addition to nested collections and manuscript content. Tests cover allowed states and representative values; this is not an assertion that every possible interaction or input has been exhausted.

## Gaps fixed

**Exact multi-select identity.** Multi-selects previously persisted only a middle-dot-delimited string. One custom label such as `Moon · Tide interpreter` became two chips after reopening, and card projections also split commas/semicolons. `choiceSelections` now records exact ordered arrays for character occupations, nationalities, languages, hairstyles, distinguishing marks, health, faith, and country/city official languages. Existing string fields remain synchronized compatibility projections. Invalid explicit arrays are rejected. Legacy duplicates, spacing differences, and whitespace-only values normalize to valid selections, so unrelated edits remain savable. Custom nationality labels are kept in a dictionary that safely supports labels such as `__proto__`.

**Numeric-text preservation.** Character age, height, and weight remain strings with numeric validation. Browser number inputs used to silently blank accepted representations such as `+12` or `12.` on reopening, so an unrelated profile save erased them. Profile and card editors now use text inputs with numeric keyboards and shared client/server validation. Untouched legacy values retain their original strings, including surrounding line breaks that a single-line control cannot display. Accepted legacy notation remains readable; negative, nonnumeric, and fractional-age values are rejected, and explicitly clearing a value still works.

**Generic-location edit times.** Migration `0012` adds `location_details.updated_at`. New area creation and generic-location profile edits record the time. Existing records receive null because their historical edit time was never recorded. Faction, country, city, and other location profile APIs expose their stored `updatedAt`; it is not inferred from creation time or invented during migration.

**Country/city directory consistency.** Directory cards now project saved summaries, flags, city skyline images, and revision metadata from their profiles. A profile edit no longer leaves the directory showing an empty preview or an obsolete revision.

**Lore save metadata.** The React Lore editor now validates and retains the document format version and checks that a save acknowledges the submitted revision. It does not silently discard the format contract.

**Story-arc preservation.** Previously selected unavailable entities remain visible and can be retained or explicitly removed without breaking serialization. Key-scene summary whitespace is preserved. Long historical chapter labels remain supported by both UI and validation.

**Date-picker focus.** Dismissing a date dialog used to restore focus again when its delayed close event arrived, potentially redirecting typing away from the next field. The shared picker now respects subsequent focus changes; deterministic Apply/Cancel tests verify that a following rating of zero is actually recorded.

## What is stored, derived, or temporary

| State | Policy |
| --- | --- |
| Authored prose, names, dates, relationships, note annotations, pictures/maps | Stored. Images are source URLs, not uploaded image binaries. Story dates retain their exact text, precision/approximation notation, or custom calendar label. |
| Hidden-field choices, Lore pin/feature flags, selected card item | Stored with the owning document. Hiding a field does not erase its content. |
| Rating zero versus unset | Stored distinctly: `0` is a value; an absent key means unrated. Prose and ratings with the same name occupy separate paths. |
| Membership rosters, descendants, backlinks, mentions, timeline positions, word count, power score | Derived from recorded references/content/ratings. They are not independent facts that can drift from their source. |
| Sidebar collapsed preference | Browser-local `localStorage`; not an authored world fact and not synchronized to the database. |
| Open accordions/menus/dialogs, selected tab, search/filter/sort, timeline viewport, relationship-map node positions/pan/zoom, editor caret and undo stack | Temporary presentation state. No persistence guarantee across page reloads. |
| Unsaved forms, uncommitted note composers, pending note placement | Draft UI state until the owning Save action. Failed saves retain the mounted draft, but this is not durable offline draft storage. |

Creation dialogs record the fields they expose. Items created from a note composer are persisted through their entity API; a local embedded character note waits for the character's Save action. Catalog cards and search results are projections, not complete editable documents.

## Guarding future UI changes

When adding a control, identify its owning document and named path. Update the template or nested contract, serializer, validator, read/default behavior, and generated schema together. Add a real save/reload case for new nested interactions. A new field must not merely appear in a component's local state or be accepted by a request parser and then omitted from the stored JSON.

The tests derive field matrices from the UI templates, so new scalar fields must render, persist, and reopen. They also validate physical stored documents using the schema, catching undeclared properties and incompatible shapes. Broad browser tests use a separate temporary SQLite database and leave the author's development database untouched.

Remaining architectural decisions for future AI features—world/project scope, retained source history, typed relationship indexing, and generated proposal provenance—are described in [the data-model contract](data-model.md).
