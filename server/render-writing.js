import {frontendAssets} from './frontend-assets.js';

/** Empty shell only; private writing is fetched through the owner-scoped API. */
export function renderWritingWorkspace(view='scenes'){
 const page=view==='chapters'?{view:'chapters',title:'Chapters',loading:'Loading your chapters…'}:{view:'scenes',title:'Scenes',loading:'Loading your scenes…'};
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${page.title} — Write to Freedom</title><link rel="icon" href="/crest.svg">${frontendAssets('frontend/writing-workspace.tsx')}</head><body class="writing-page"><div id="writing-workspace-root" data-writing-view="${page.view}"><main><h1>${page.title}</h1><p role="status">${page.loading}</p><noscript>Enable JavaScript to open and edit your scenes.</noscript></main></div></body></html>`;
}
