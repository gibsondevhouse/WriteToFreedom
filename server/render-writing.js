import {frontendAssets} from './frontend-assets.js';

/** Empty shell only; private writing is fetched through the owner-scoped API. */
export function renderWritingWorkspace(){
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Chapters & scenes — Write to Freedom</title><link rel="icon" href="/crest.svg">${frontendAssets('frontend/writing-workspace.tsx')}</head><body class="writing-page"><div id="writing-workspace-root"><main><h1>Chapters & scenes</h1><p role="status">Loading your writing workspace…</p><noscript>Enable JavaScript to open and edit your scenes.</noscript></main></div></body></html>`;
}
