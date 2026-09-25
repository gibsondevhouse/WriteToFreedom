# Frontend migration: foundation and Lore note pilot

The application now has a Vite/TypeScript build boundary, a React pilot for standalone Lore entries whose `type` is `note`, and a React/Tiptap Chapters/Scenes workspace. The Worker, D1 repository, trusted hosting identity, routes, runtime validation and optimistic writes remain authoritative. Navigation still loads whole documents.

## Source and build boundaries

- `frontend/` owns new typed browser code. `frontend/lore-profile.tsx` and `frontend/writing-workspace.tsx` are independent entries configured in `vite.config.ts`.
- `public/` keeps existing assets and browser controllers, along with DOM-free domain models shared by the Worker and the new frontend.
- `npm run typecheck` checks the frontend, Vite and Playwright configuration, and browser tests with strict TypeScript. `tsconfig.legacy.json` also enables strict `checkJs` for `public/profiles/schema.js`. Extend this boundary deliberately; the rest of the JavaScript application is not yet type-checked.
- `npm run build` type-checks, builds Vite into `dist/client/`, reads its manifest, and embeds both legacy and generated assets in `dist/server/index.js`. `npm run build:frontend` is a partial build only.
- Generated assets live at `/frontend/`. `server/frontend-assets.js` walks the manifest's static imports for CSS and module preloads. Dynamic chunks and imported assets are embedded too, but are fetched only when needed. Internal manifests and dotfiles stay private to the build.
- Vite's hashed files bypass legacy revision rewriting. Existing public modules retain the shared asset revision. Text and binary assets both survive the embedding step; binary data is base64 in the bundle and decoded into response bytes by the Worker.

This follows [Vite's backend integration](https://vite.dev/guide/backend-integration). Type checking runs separately because [Vite transpiles TypeScript without checking its types](https://vite.dev/guide/features#typescript).

## Local development and data

Run `npm ci`, then `npm run dev`. The existing server still serves compiled assets and APIs together at `http://127.0.0.1:4173`; rebuild and restart after edits. There is no HMR or cross-origin Vite proxy. This keeps the API's exact Origin and JSON content-type requirements intact.

The default SQLite database remains `.sites-runtime/development.sqlite`, with the same incremental migration tracking. Building does not reset it. `PORT` and `WTF_DATABASE_PATH` are explicit local/test overrides. The server remains bound to loopback and supplies a fixed local author identity; this development adapter is not a replacement for hosted authentication.

## Pilot ownership and contracts

`server/render-lore.js` selects the React path only for standalone notes. It emits escaped bootstrap JSON and the dedicated `#lore-profile-root`. React uses `createRoot`; the legacy HTML renderer is not hydrated. The outer workspace shell remains outside React. Other Lore types and embedded character notes retain their existing controllers.

The pilot owns its complete profile form: draft values, visibility, collapsing, image preview, ratings, story dates, connections, save status, keyboard shortcuts and errors. It never calls `initProfileEditor`, `initProfileControls` or `initProfileViewport`. Effects clean up their global listeners and observers. Shared templates, date calculations and reference validation remain domain code rather than being recreated as React state.

`frontend/lore/contracts.ts` distinguishes persisted note records, editable drafts, connection display targets and mutation payloads. Incoming data is checked at runtime, and the explicit serializer allowlists writable fields. Neither display targets, local connection-row keys nor persistence metadata are sent as document fields. Server validators remain the final authority.

Saving is explicit. One owner sends a same-origin JSON PUT to `/api/lore/:id` with the current version. Controls are disabled during that request; success adopts the returned version and signals workspace changes. Validation errors, network failures, expired-session responses and version conflicts keep the draft editable. A conflict never silently retries with a newer version or overwrites the competing record. Unsaved changes trigger the existing navigation warning; there is still no durable browser draft backup.

The persisted representation remains plain text. Hidden fields retain their values, positional note markers are untouched, and custom/BCE/precision-aware story dates keep the existing domain format. A rich-text schema conversion is not part of this pilot.

## Verification

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:browser
```

The browser command builds the actual Worker, starts it on port 4175 (or `WTF_BROWSER_TEST_PORT`) with a fresh temporary SQLite database, and removes that test directory afterward. It refuses to reuse an already-running server. It does not read or clear the author's development database.

Browser coverage checks asset delivery, legacy routes, note edits and reopen, hidden text, failure retention, a real version conflict, single-owner keyboard saving, focus restoration and narrow-screen layout. The Node suites continue to cover owner scoping, API validation, schema behavior and other profiles; asset tests cover binary round trips and manifest imports. Chromium coverage does not claim hosted D1, WebKit or Firefox verification.

## Next gates and retirement

Chapters/Scenes now use the typed component boundary with Tiptap and a separate, versioned writing schema. The first usability target is 10,000 words per scene, with editor selection/history isolated from adjacent panel state. See [writing workspace](writing-workspace.md) for its storage/API contract and browser acceptance checks. Existing note representations and anchors are unchanged.

The note pilot supplies a bounded migration pattern, not a new client router. Migrate another profile when that surface needs substantial work; remove its legacy adapter once React owns the whole region and its acceptance checks pass. Keep common visual styles and domain models shared. Any future client-side router requires a separate cleanup audit of the remaining page-lifetime controllers.
