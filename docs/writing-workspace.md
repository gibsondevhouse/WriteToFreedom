# Chapters and scenes

`/chapters/` and `/scenes/` open the React writing workspace. Chapters organize independently saved scenes. Each scene contains a title, summary, drafting status, chapter assignment and rich-text document. Existing Lore notes and positional character-note anchors keep their current storage and editors.

## Ownership and editing

`frontend/writing/Workspace.tsx` owns the outline, per-scene drafts, loading, chapter metadata, reference panel and explicit saves. The outer workspace navigation still belongs to the existing shell. Moving between application sections uses ordinary full-page navigation.

`frontend/writing/Editor.tsx` owns each scene's Tiptap instance, selection and undo history. Visited scene editors remain mounted while hidden, so switching between scenes preserves unsaved writing and history within the document. Parent updates and successful saves do not call `setContent` or recreate the editor. Tiptap transaction rendering is disabled for the outer React editor; toolbar and word-count subscriptions update separately. This follows [Tiptap's integration performance guidance](https://tiptap.dev/docs/guides/performance).

The toolbar supports paragraphs, three heading levels, bold, italic, underline, strikethrough, lists, quotes, scene breaks and undo/redo. Standard keyboard shortcuts work. Paste retains supported formatting through the editor schema and excludes scripts, styles and embedded objects. The first format does not support images, tables, links or code blocks. Inline code remains a supported text mark for compatible pasted content.

The reference panel reads the existing owner-scoped worldbuilding catalog. It opens reference profiles in another tab; it does not insert or rewrite positional note anchors in the scene document.

## Persistence contract

Migration `0009_concerned_war_machine.sql` adds `chapters` and `scenes` without changing existing records. Both tables store owner-scoped, versioned documents with creation/update timestamps. Scenes reference a chapter. Runtime checks require that chapter to belong to the same owner.

| Endpoint | Contract |
| --- | --- |
| `GET /api/chapters` | `{chapters: ChapterRecord[]}` |
| `POST /api/chapters` | `{id, title, summary}` → created chapter |
| `GET /api/chapters/:id` | One owner-scoped chapter |
| `PUT /api/chapters/:id` | `{version, title, summary}` → saved chapter with incremented version |
| `GET /api/scenes` | `{scenes: SceneSummary[]}`; prose is excluded at the SQL query boundary |
| `GET /api/scenes?chapterId=:id` | Scene summaries for an owned chapter |
| `POST /api/scenes` | `{id, chapterId, title, summary, status, contentSchemaVersion: 1, content}` → created scene |
| `GET /api/scenes/:id` | Complete scene document |
| `PUT /api/scenes/:id` | Writable scene fields plus `version` → saved scene |

`status` is `draft`, `revising` or `complete`. Titles are required and limited to 160 characters; summaries to 10,000 characters. Unknown IDs and cross-owner item reads return 404. Mutations require the exact same Origin and JSON content type. POST IDs are UUIDs and retries retain existing same-owner records. PUT uses an atomic owner/ID/version condition; a stale save receives 409. Writes return the exact committed document/version rather than rereading a potentially newer concurrent version.

## Rich-text schema version 1

The canonical stored form is JSON, not HTML:

```json
{
  "contentSchemaVersion": 1,
  "content": {
    "type": "doc",
    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The door opened."}]}]
  }
}
```

`public/writing/document.js` validates the same structural constraints as the configured Tiptap schema. Supported blocks are paragraphs, headings (levels 1–3), blockquotes, bullet/ordered lists, list items and horizontal rules; inline nodes are text and hard breaks. Marks are bold, italic, strike, underline and code. Ordered lists preserve their positive start value and standard list style. Code marks cannot be combined with other marks.

Unknown properties, invalid nesting, unsupported nodes/marks, future schema versions and invalid attributes are rejected instead of being silently discarded. Each document is limited to 1,048,576 UTF-8 bytes of JSON, 200,000 text code units, 20,000 nodes and 30 nesting levels. The whole mutation request allows 1,081,344 bytes to leave room for metadata. These are storage safety limits, separate from the tested usability target of **10,000 words per scene**. No existing text is converted into this format automatically.

`frontend/writing/contracts.ts` checks incoming records and allowlists outgoing mutation fields. Runtime validation remains on the server even though the frontend uses TypeScript.

## Save and recovery behavior

Choose **Save scene** or use Ctrl/Cmd+S. Only the active scene is saved. Editing is disabled while that scene's request is in flight, and duplicate saves are guarded. Network, validation, session and conflict errors keep its draft available. Switching to another scene keeps the failed draft in memory, and returning to it restores its editor.

A version conflict does not overwrite the other tab or silently adopt its version. Copy unsaved writing before reloading to resolve it. Navigation warns when drafts remain unsaved. Draft retention is limited to the current browser document; there is no autosave, durable offline draft store or automatic conflict merge.

## Verification and scope

Run `npm run typecheck`, `npm test`, and `npm run test:browser`. The browser suite exercises the compiled Worker with temporary SQLite data. Writing coverage includes creation, save/reopen, formatted JSON round trips, paste, undo/redo, reference/outline changes, draft-preserving scene switches, failure/conflict retention and mobile layout. The performance case compares a short scene with a 10,000-word scene and records input/formatting/panel timings in its test attachment; these are local end-to-end measurements, not guarantees for every device.

The implementation run passed 158 Node tests and 22 Chromium tests. In the local 10,000-word case, ready time was 72 ms, typing p95 was 15.2 ms, formatting was 52 ms and panel toggles were 44–53 ms. Measurements include Playwright round trips and a next-animation-frame boundary; browser caching and machine load affect them. The regression limits are 5 seconds to ready, 250 ms typing p95 and 750 ms for formatting/panel actions. The test also verifies that all 10,001 words after editing persist after saving.

The outline currently follows creation order; scene chapter assignments can be changed and saved. Explicit reordering, deletion, full-manuscript export, collaborative editing and a separate Story Beats module remain future product work. Existing story-arc key-scene descriptions retain their current free-text references.
