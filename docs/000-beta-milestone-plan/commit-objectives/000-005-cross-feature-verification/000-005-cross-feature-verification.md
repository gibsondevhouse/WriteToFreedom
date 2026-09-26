# 000-005 — Cross-Feature Verification

> **Delivery slice E** from the coding-agent brief.
> Requires 001–004 to be complete.
> This is the final integration and verification stage before beta milestone sign-off.

---

## 1. Purpose

This stage verifies that the full feature set works end-to-end across all cross-cutting concerns: search, dashboards, references, notes, timeline, and writing. It is not a set of new features — it is proof that everything built in Stages 001–004 holds together correctly under real conditions.

Do not present static pages or in-memory membership as completed persistence. Complete the milestone end to end.

---

## 2. Scope to Verify

Audit every consumer of owner-wide catalogs:

- Dashboards
- Directories
- Search
- Reference pickers
- Notes/backlinks
- Story arcs
- Timeline
- Writing reference panel

Define whether each uses the whole library or the selected novel. Do not implement book filtering only in the visible card grid while saves or search still target an unintended manuscript.

---

## 3. Search

- Search clearly indicates whether it searches this novel or all material.
- Include new novel and series profiles in global search.
- A shared profile retains its canonical identity and remains a complete article; arriving from a book can preserve a back link or jump to that book's appearance section.
- Search, backlinks, counts, and empty/error messages must not leak another owner's data.

---

## 4. Timeline

When showing a novel-filtered timeline:
- Filter by declared associations and label the scope.
- A shared entity's lifetime dates are not automatically events within every linked novel.
- Do not duplicate canonical events or invent dates from book order.
- Do not infer story chronology from publication order, series display order, or record timestamps. A prequel can be the third released book.
- Existing custom story dates must retain their precision and original text.

---

## 5. Writing Workspace

- Protect dirty edits when switching novel context.
- Do not replace a mounted editor or silently navigate away from unsaved scenes.
- New context changes must retain the protections described in `docs/writing-workspace.md`.
- Dirty writing survives a failed save; context switches warn or retain it according to the existing editor contract.

---

## 6. Navigation and Deep Links

- Preserve current deep links and routes.
- Chapter cards currently link to `/scenes/` without selecting that chapter — a novel/chapter action must open the correct destination, not the first scene from an unrelated book.
- Represent durable navigation context in routes/query parameters where appropriate so refreshes and copied links work.
- Browser preferences may remember the last view, but they cannot determine authorization or hold the only copy of book membership.

---

## 7. Migration Verification

Verify the following migration scenarios:

- A fresh database with no existing data.
- An upgrade with populated manuscripts, sample overrides, custom entities, nested notes, and cross-entity links.
- Partial failure scenarios: must not create several default novels or orphan chapters.
- Reserved sample IDs remain intact and resolve to the correct owner's effective profile.

---

## 8. Full Acceptance Criteria (All Stages)

The coding agent must demonstrate all 15 behaviors with meaningful automated coverage:

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

---

## 9. Test Commands

```bash
npm test
npm run typecheck
npm run build
```

Extend and run relevant Playwright coverage for affected profile, navigation, and writing behavior during browser verification. Keep test databases isolated from the author's local data. A prior passing suite is background evidence, not validation of new changes.

---

## 10. Completion Report

On completion, report:

- What users can do.
- Migration behavior.
- Confirmed tests/checks.
- Any selected defaults that affect product behavior.
- Material unfinished work.
- Whether the delivered slice is A–C or the full A–E scope.

Do not claim an implementation is complete merely because its schema or UI exists.

---

## 11. Scope Boundaries

This entire brief does **not** request:

- A new visual language or universal frontend rewrite.
- AI generation.
- Collaboration or public sharing of manuscripts.
- Payment processing.
- A generic knowledge-graph engine.
- A per-field alternate-canon system.
- Autosave, durable recovery, export, or broader account lifecycle work (V1 roadmap items, not to be silently folded in).

Preserve `.openai/hosting.json` and the current project association. This handoff alone is not an instruction to deploy. When implementation and deployment are requested, use the applicable project/Sites workflow and current audience permissions.

---

## 12. Intended Result

The intended result is an interconnected writing encyclopedia with multiple manuscripts: books and series organize the work, reusable articles describe the world, and collections provide additional ways to find and group the same material.
