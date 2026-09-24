import {escape} from './profile-components.js';

function localUrl(value){
 if(typeof value!=='string'||!/^\/(?!\/)/.test(value))throw new Error('Dashboard assets and links must use local absolute URLs.');
 return escape(value);
}
function identifier(value){
 if(!/^[a-z][a-z0-9-]*$/i.test(value))throw new Error('Use a stable dashboard identifier.');
 return value;
}
function actionsMarkup(actions=[]){
 return actions.map(action=>{
  const attributes=`class="workspace-action"${action.id?` id="${identifier(action.id)}"`:''}`;
  const content=escape(action.label)+(action.icon?` <span aria-hidden="true">${escape(action.icon)}</span>`:'');
  return action.href?`<a ${attributes} href="${localUrl(action.href)}">${content}</a>`:`<button ${attributes} type="button"${action.disabled?' disabled':''}>${content}</button>`;
 }).join('');
}
/**
 * Complete main-area dashboard frame. The outer Worker adds workspace navigation.
 * Text and action metadata are escaped. Slots contain trusted, source-authored HTML.
 * One page definition supplies its adapter, optional styles, actions and slots;
 * required dashboard/card styles, status hooks and accessibility are automatic.
 */
export function renderDashboardPage({
 id='dashboard',title,heading=title,eyebrow='Overview',description='',metaDescription=description,
 actions=[],breadcrumbs=[],slots={},script,styles=[],loadingText='Loading your dashboard…',
 noscript='Enable JavaScript to load this dashboard. Your other pages are available from the navigation.',
 empty={title:'Nothing here yet.',description:'New entries will appear here.',actions:[]}
}){
 identifier(id);
 const links=breadcrumbs.length?`<nav class="dashboard-breadcrumbs" aria-label="Breadcrumb"><ol>${breadcrumbs.map(item=>`<li>${item.href?`<a href="${localUrl(item.href)}">${escape(item.label)}</a>`:`<span aria-current="page">${escape(item.label)}</span>`}</li>`).join('')}</ol></nav>`:'';
 return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">
<title>${escape(title)} — Write to Freedom</title><meta name="description" content="${escape(metaDescription)}">
<link rel="icon" href="/crest.svg" type="image/svg+xml">
${[...new Set(['/dashboard/shell.css?v=species-cards-1',...styles])].map(path=>`<link rel="stylesheet" href="${localUrl(path)}">`).join('\n')}
<script type="module" src="${localUrl(script)}"></script>
</head><body class="workspace">
<a class="skip-link" href="#${id}">Skip to ${escape(title.toLowerCase())}</a>
<main id="${id}" class="dashboard-shell" data-dashboard-shell tabindex="-1" aria-labelledby="${id}-title">
${links}
<header class="workspace-heading"><div class="dashboard-heading-copy"><p class="workspace-eyebrow">${escape(eyebrow)}</p><h1 id="${id}-title">${escape(heading)}</h1>${description?`<p class="dashboard-description">${escape(description)}</p>`:''}</div>${actions.length?`<div class="dashboard-actions">${actionsMarkup(actions)}</div>`:''}</header>
<div data-dashboard-slot="toolbar">${slots.toolbar||''}</div>
<div id="${id}-content" data-dashboard-body aria-busy="true">
<p class="load-status" data-dashboard-loading role="status">${escape(loadingText)}</p>
<div class="load-error" data-dashboard-error role="alert" hidden><p data-dashboard-error-message></p><button type="button" data-dashboard-retry>Try again</button></div>
<div data-dashboard-slot="before-content">${slots.beforeContent||''}</div>
<section class="empty-row dashboard-empty" data-dashboard-empty aria-labelledby="${id}-empty-title" hidden><h2 id="${id}-empty-title">${escape(empty.title)}</h2><p>${escape(empty.description||'')}</p>${empty.actions?.length?`<div class="dashboard-actions">${actionsMarkup(empty.actions)}</div>`:''}</section>
<div id="${id}-rows" data-dashboard-rows></div>
<div data-dashboard-slot="after-content">${slots.afterContent||''}</div>
</div>
<noscript><p>${escape(noscript)}</p></noscript>
</main>
${slots.dialogs||''}
</body></html>`;
}
