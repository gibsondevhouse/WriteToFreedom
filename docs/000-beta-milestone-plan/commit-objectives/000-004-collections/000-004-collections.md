# 000-004 — Collections

> **Delivery slice D** from the coding-agent brief.
> Requires 001–003 to be complete.

---

## 1. Collections Model

### Manual Collections

A manual collection contains selected references. It may mix characters, locations, factions, Lore entries, notes, story arcs, novels, and other supported record types. An entry can belong to several collections.

### Smart Collections

A smart collection stores criteria and derives its members. Examples:

- Characters linked to a particular novel.
- Places used across a series.
- Entries linked to two or more novels.

### Key Distinctions

Collection membership, novel association, and manuscript ownership are distinct:

- Adding a character to "Royal court" does not automatically add the character to a novel.
- A smart collection matching an entry does not mutate the entry or create an appearance.
- Removing a collection membership does not delete the entry.
- Chapters and scenes remain owned by one manuscript even if a collection links to them.

---

## 2. Recommended Persistence Design (Collections)

| Concept | Suggested data | Main invariant |
| --- | --- | --- |
| Manual collections | ID, owner, profile/metadata, revision, timestamps | Membership is explicitly selected |
| Collection members | Owner, collection ID, typed target, optional position | Unique collection/target; resolves the original record |
| Smart collections | ID, owner, metadata, validated rule document and rule format version | Results are derived; no copied entity documents |

A single collection table with a manual/smart discriminator is reasonable. Keep rules and manual membership behavior mutually understandable; V1 does not need smart results plus custom pin/exclusion overrides.

---

## 3. Smart Collections: Bounded V1

Start with rules that the actual data can answer reliably:

- Entity type, including optional Lore/location subtype.
- Linked novel.
- Membership in a series through its novels.
- Number of linked novels, counting distinct novel associations.
- Unassigned to any novel.

Add tags when their cross-entity storage and matching semantics are explicit. Tags are not currently uniform across the application; do not silently infer them from prose or treat a free-text comma convention as a reliable universal tag system.

### Rule Document Format

Use a small serializable rule document: a version, a flat list of allowlisted predicates, and match-all or match-any mode. Apply sensible rule-count and value limits. A smart collection must display an understandable summary of its criteria.

Evaluate rules against owner-scoped data, on the server where practical. Use parameterized queries and allowlisted fields/operators. Never store or execute user-written SQL or JavaScript. Avoid recursive collection references and arbitrarily nested rule trees in V1.

Results update after relevant saves and membership changes. If a cache or derived index is introduced, key it by owner and relevant scope, invalidate it consistently, and keep it rebuildable from canonical records. A smart collection should not become a stale copied list of IDs.

---

## 4. Browsing Collection Pages

Use `server/dashboard-shell.js` and `public/dashboard/components.js` for overview rails. Use `server/directory-shell.js` and `public/directory/shell.js` for searchable result pages.

Collections should open familiar grids/lists and canonical profiles. Do not add a second application navigation system.

For mixed collections, resolve each reference to the appropriate existing card or a compatible list entry. Missing optional imagery must retain readable titles and metadata. A rule editor belongs in a focused collection editing surface; it should not dominate ordinary browsing.

---

## 5. Privacy and Write Safety (Collections)

Every collection read/write must resolve within the authenticated owner. A user-supplied collection ID is a resource selector, never proof of access.

- Removing a collection should preserve its members.
- Smart-rule evaluation must not leak another owner's data.
- Apply existing same-origin JSON mutation checks and optimistic concurrency.

---

## 6. Acceptance Criteria (Stage 004)

1. A mixed manual collection retains membership after reload. Removing a member preserves its source profile and book associations.
2. A smart collection updates after a qualifying association is added or removed, counts each novel once, and does not mutate source records.
3. Another owner's IDs cannot be linked, read, edited, searched, or counted through collection operations. An invalid association rolls back without partial changes.
4. Conflicting collection-rule and ordering edits produce recoverable errors rather than overwriting newer content.

Use `npm test`, `npm run typecheck`, and `npm run build`. Extend relevant Playwright coverage for collection browsing and membership behavior.

---

## 7. Scope Boundaries

This stage does not include:
- Cross-feature search/timeline/dashboard verification (→ Stage 005)
- Public sharing, collaboration, AI generation, per-field alternate-canon, or export
- Smart collection pin/exclusion overrides (post-V1 roadmap)
- Tag-based rules until tag storage is made uniform across the application
