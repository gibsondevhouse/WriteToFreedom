# 000-002 — Profiles and Browsing

> **Delivery slice B** from the coding-agent brief.
> Requires 001 to be complete.

---

## 1. Design Authority

The existing application is the design authority. Use its cards, rails, directories, article profiles, and infoboxes. The earlier conversational library-and-inspector mockup is superseded.

Inspirations to apply:
- **Plex-inspired browsing:** visually browse books, series, and collections through the application's established cards and rails.
- **Wikipedia-inspired profiles:** open complete, linked articles with structured infoboxes, readable sections, references, and inline editing.

---

## 2. Extend the Actual Profile Shell

Inspect these sources before editing:

- `server/profile-components.js`: `renderProfilePage`, `renderSection`, `renderInfoGroup`, `renderProfileName`, and field helpers.
- `public/profiles/profile.css` and `public/profiles/editor.css`: shared appearance and current layout.
- `public/profiles/controls.js`, `viewport.js`, and `editor.js`: collapse, field visibility, sticky behavior, and save lifecycle.
- `server/render-profile.js`: character-specific composition, relationships, and references.
- `server/render-story-arc.js`: useful example of a new profile type composed from shared primitives and linked entities.
- `server/workspace-shell.js` and `public/workspace-shell.css`: application navigation and topbar.

The current shell consists of breadcrumbs, a sticky article/save bar, one editing form, an article column on the left, and an infobox on the right. The infobox becomes sticky while reading and scrolls independently on wide screens. The article uses collapsible headings and inline fields. The narrow layout stacks the content. Profile navigation uses breadcrumbs and section anchors; do not invent a table-of-contents sidebar as if it already exists.

### Preserve

- The established typography, dark palette, spacing, card treatment, and link styling.
- Stable section and field anchors.
- Explicit save status, dirty-state protection, keyboard saving, and error retention.
- Field visibility independently of content: hiding or collapsing a field must never remove its saved value.
- Shared interaction ownership: initialize one editor/controller per region.
- The separation between outer workspace navigation and profile composition.

Use new entity adapters and small shared extension points. Do not fork the whole profile document into unrelated copies or redesign existing character pages around a library inspector.

---

## 3. Novel Profile

Compose a novel using the existing article/infobox shell.

**Suggested infobox content:**
- Title
- Cover image
- Primary series
- Position in that series
- Drafting status

Optional metadata should follow the existing visibility system; avoid making a large form of mandatory publishing details.

**Suggested article sections:**

1. Overview and synopsis.
2. Manuscript: ordered chapters with links to the correct writing context.
3. Characters linked to this novel.
4. Locations and factions.
5. Lore, objects, notes, and story arcs.
6. Open questions and references where useful.

Reuse suitable existing cards for linked content; keep article prose in article form. Provide an action that opens the actual scene-writing workspace for this novel. The profile describes and organizes the manuscript; the existing Tiptap workspace remains where manuscript prose is written.

---

## 4. Series Profile

Use the same shell with a series title, optional artwork, and summary. Its central content is an explicitly ordered list of novels, followed by appropriate overview prose and shared material.

Derive the series' linked entity view from its novels for V1. Count a character once even when it appears in several volumes. Do not maintain a second independently editable copy of that membership. Explicit series-only planning references can be added later if needed.

---

## 5. Browsing and Collection Pages

Use `server/dashboard-shell.js` and `public/dashboard/components.js` for overview rails. Use `server/directory-shell.js` and `public/directory/shell.js` for searchable result pages. Follow `docs/dashboard-shell.md` and `docs/directory-shell.md` for lifecycle and extension contracts.

Books and Series can become navigation destinations within the existing workspace. Collections should open familiar grids/lists and canonical profiles. Do not add a second application navigation system.

For mixed collections, resolve each reference to the appropriate existing card or a compatible list entry. Missing optional imagery must retain readable titles and metadata. A rule editor belongs in a focused collection editing surface; it should not dominate ordinary browsing.

---

## 6. Navigation, Search, and Context

Add a visible current novel/library context using the existing workspace navigation. A recommended placement is the existing "My workspace" area, but fit the current shell rather than assuming a new topbar.

Inside a selected novel:

- Chapters and Scenes show that novel's manuscript.
- Worldbuilding directories can show its linked entries, with a clear way to browse the whole library and add an existing entry.
- Search clearly indicates whether it searches this novel or all material. Include new novel and series profiles in global search.
- A shared profile retains its canonical identity and remains a complete article; arriving from a book can preserve a back link or jump to that book's appearance section.

Represent durable navigation context in routes/query parameters where appropriate so refreshes and copied links work. Browser preferences may remember the last view, but they cannot determine authorization or hold the only copy of book membership.

Audit every consumer of owner-wide catalogs: dashboards, directories, search, reference pickers, notes/backlinks, story arcs, timeline, and the writing reference panel. Define whether each uses the whole library or the selected novel. Do not implement book filtering only in the visible card grid while saves or search still target an unintended manuscript.

When showing a novel-filtered timeline, filter by declared associations and label the scope. A shared entity's lifetime dates are not automatically events within every linked novel. Do not duplicate canonical events or invent dates from book order.

Preserve current deep links and routes. One existing issue worth handling in the context work is that chapter cards currently link to `/scenes/` without selecting that chapter. A novel/chapter action must open the correct destination, not the first scene from an unrelated book.

---

## 7. Acceptance Criteria (Stage 002)

1. Novel and series profiles match the existing article/infobox structure and preserve collapse, visibility, save, and narrow-layout behavior.
2. A chapter action opens the right novel/chapter/scene. No manuscript list or creation flow silently uses a different novel.
3. Existing profile links, hidden fields, nested notes, location ancestry, and rich-text scene documents still work after the change.
4. The same character, location, faction, and Lore entry can be linked to both novels without duplicate source documents.
5. Renaming a shared entry updates its linked display labels. Existing links continue resolving by ID.

Use `npm test`, `npm run typecheck`, and `npm run build`. Extend relevant Playwright coverage for affected profile and navigation behavior.

---

## 8. Scope Boundaries

This stage does not include:
- Appearance/reference sections within entity profiles (→ Stage 003)
- Collections and smart rules (→ Stage 004)
- Cross-feature search/timeline verification (→ Stage 005)
