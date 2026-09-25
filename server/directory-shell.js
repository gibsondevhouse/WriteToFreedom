import {escape} from './profile-components.js';

function identifier(value){if(typeof value!=='string'||!/^[a-z][a-z0-9-]*$/i.test(value))throw new Error('Use a stable directory identifier.');return value;}
function localUrl(value){if(typeof value!=='string'||!/^\/(?!\/)/.test(value)||/[\\\u0000-\u0020]/.test(value))throw new Error('Directory assets and links must use local absolute URLs.');return escape(value);}
const icons={archive:'M4 8h16v12H4zM3 4h18v4H3zM9 12h6',search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6',sort:'M7 4v16m-4-4 4 4 4-4M17 20V4m-4 4 4-4 4 4'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]}"/></svg>`;
function actionMarkup(action,primary=false){
 if(!action)return '';
 const attributes=`${action.id?` id="${identifier(action.id)}"`:''} class="directory-action${primary?' directory-primary-action':''}"${action.title?` title="${escape(action.title)}"`:''}`;
 const content=(action.icon==='archive'?icon('archive'):action.icon?`<span aria-hidden="true">${escape(action.icon)}</span>`:'')+escape(action.label);
 if(action.href)return `<a${attributes} href="${localUrl(action.href)}">${content}</a>`;
 const descriptionId=action.description?identifier(action.id)+'-description':null;
 return `<button${attributes} type="button"${action.disabled?' disabled':''}${descriptionId?` aria-describedby="${descriptionId}"`:''}>${content}</button>${descriptionId?`<span id="${descriptionId}" class="directory-sr-only">${escape(action.description)}</span>`:''}`;
}
function selectMarkup(id,hook,label,options){
 if(!options.length)return '';
 return `<label class="directory-sr-only" for="${id}">${escape(label)}</label><select id="${id}" data-directory-${hook}>${options.map(option=>`<option value="${escape(option.value)}">${escape(option.label)}</option>`).join('')}</select>`;
}
/** Complete directory document. Metadata is escaped; slots are trusted source-authored HTML. */
export function renderDirectoryPage({
 id,title,singular='entry',plural='entries',eyebrow='',description='',metaDescription=description,
 script,styles=[],leadingAction,primaryAction,slots={},searchPlaceholder='Search entries…',
 views=[{value:'cards',label:'Cards'}],sorts=[{value:'order',label:'List order'},{value:'name',label:'Alphabetical'}],
 empty={title:'Nothing here yet.',description:'Create an entry to begin.'},
 noResults={title:'No entries found',description:'Try another name or keyword.'}
}){
 identifier(id);
 return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">
<meta name="description" content="${escape(metaDescription)}"><title>${escape(title)} — Write to Freedom</title>
<link rel="icon" href="/crest.svg" type="image/svg+xml">
${[...new Set(['/directory/shell.css?v=1',...styles])].map(path=>`<link rel="stylesheet" href="${localUrl(path)}">`).join('\n')}
<script type="module" src="${localUrl(script)}"></script>
</head><body class="directory-page">
<a class="directory-skip" href="#${id}">Skip to ${escape(title.toLowerCase())}</a>
<header class="directory-header"><nav class="directory-breadcrumb" aria-label="Breadcrumb"><a class="directory-brand" href="/"><img src="/crest.svg" width="32" height="36" alt=""><span>Write to Freedom</span></a><span class="breadcrumb-divider" aria-hidden="true">/</span><h1 id="${id}-title" aria-current="page">${escape(title)}</h1></nav></header>
<main id="${id}" class="directory-shell" data-directory-shell data-singular="${escape(singular)}" data-plural="${escape(plural)}" data-directory-state="loading" tabindex="-1" aria-labelledby="${id}-title">
<div class="directory-heading">${eyebrow?`<p class="directory-eyebrow">${escape(eyebrow)}</p>`:''}${description?`<p class="directory-intro">${escape(description)}</p>`:''}</div>
<div class="directory-error" data-directory-error role="alert" hidden><p data-directory-error-message></p><button data-directory-retry type="button">Try again</button></div>
<div class="directory-controls"><div class="directory-leading-actions">${actionMarkup(leadingAction)}${slots.leadingActions||''}</div>
<search class="directory-search" aria-label="Search ${escape(plural)}">${icon('search')}<label class="directory-sr-only" for="${id}-search">Search ${escape(plural)}</label><input id="${id}-search" data-directory-search type="search" placeholder="${escape(searchPlaceholder)}" autocomplete="off" aria-controls="${id}-list" disabled><button data-directory-clear type="button" aria-label="Clear search" title="Clear search" hidden>×</button></search>
<div class="directory-primary-actions">${actionMarkup(primaryAction,true)}${slots.primaryActions||''}</div></div>
<div data-directory-slot="filters">${slots.filters||''}</div>
<div class="directory-toolbar"><p data-directory-count role="status" aria-live="polite">Loading ${escape(plural)}…</p><div class="directory-sort-controls">${selectMarkup(id+'-view','view',title+' view',views)}${selectMarkup(id+'-sort','sort','Sort '+plural,sorts)}${sorts.length?`<button data-directory-direction type="button" aria-label="Reverse list order" aria-pressed="false" title="Reverse list order">${icon('sort')}</button>`:''}${slots.toolbarActions||''}</div></div>
<div data-directory-results aria-busy="true"><div data-directory-slot="before-list">${slots.beforeList||''}</div>
<ol id="${id}-list" class="directory-list" data-directory-list hidden></ol>
<section class="directory-empty" data-directory-empty data-empty-title="${escape(empty.title)}" data-empty-description="${escape(empty.description||'')}" data-filtered-title="${escape(noResults.title)}" data-filtered-description="${escape(noResults.description||'')}" aria-labelledby="${id}-empty-title" hidden><h2 id="${id}-empty-title" data-directory-empty-title>${escape(empty.title)}</h2><p data-directory-empty-description>${escape(empty.description||'')}</p><button data-directory-reset type="button">Show all ${escape(plural)}</button></section>
<div data-directory-slot="after-list">${slots.afterList||''}</div></div>
<noscript><p>Enable JavaScript to load ${escape(plural)}. <a href="/">Return home</a>.</p></noscript>
</main>${slots.dialogs||''}</body></html>`;
}
