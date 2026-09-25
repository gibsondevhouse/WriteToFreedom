// Dashboard definitions contain page content only; the shell owns the frame.
const home={
 id:'dashboard',title:'Dashboard',heading:'Your novel at a glance',eyebrow:'Overview',
 metaDescription:'Your writing workspace: characters, factions, places, open questions, and story dates.',
 actions:[{label:'Open characters',href:'/characters/',icon:'↗'}],
 script:'/dashboard/dashboard.js',loadingText:'Loading your novel…'
};
const lore={
 id:'lore-dashboard',title:'Lore',eyebrow:'Worldbuilding',
 description:'The notes, objects, and species that give your world depth.',
 actions:[{id:'new-lore',label:'New entry',icon:'＋',disabled:true}],
 script:'/lore/dashboard.js',styles:['/lore/dashboard.css'],loadingText:'Loading your lore…',
 slots:{
 toolbar:`  <div class="lore-tools">
   <div class="lore-toolbar">
    <search class="lore-search" aria-label="Search lore">
     <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
     <label class="sr-only" for="lore-search">Search lore</label><input id="lore-search" type="search" placeholder="Search lore and character notes…" autocomplete="off" aria-controls="lore-dashboard-rows" disabled>
    </search>
    <button class="lore-text-button" id="clear-lore" type="button" hidden>Show all</button>
    <button class="workspace-action" id="toggle-note" type="button" aria-expanded="false" aria-controls="quick-note-panel" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15Z"/></svg> Quick note <span class="lore-chevron" aria-hidden="true">⌄</span></button>
   </div>
   <section id="quick-note-panel" class="lore-capture" aria-labelledby="quick-note-label" hidden>
    <form id="quick-note">
     <label id="quick-note-label" for="quick-note-text">Capture an idea</label>
     <textarea id="quick-note-text" rows="3" maxlength="10000" placeholder="A rumor, an object, a detail you don’t want to lose…" required disabled></textarea>
     <div class="lore-capture-footer"><p>You can develop it into a full note later.</p><button class="workspace-action" id="save-note" type="submit" disabled>Save note <span aria-hidden="true">↗</span></button></div>
    </form>
    <p id="capture-error" role="alert" hidden></p>
   </section>
   <p id="capture-status" class="lore-save-message" role="status" hidden></p>
  </div>
`,
 beforeContent:`  <p id="lore-result-status" class="sr-only" role="status"></p>
`,
 dialogs:` <dialog id="new-lore-dialog" aria-labelledby="new-lore-title">
  <form id="new-lore-form">
   <p class="workspace-eyebrow">Add to your world</p><h2 id="new-lore-title">New lore entry</h2><p class="lore-dialog-intro">Start with a name. The details can come later.</p>
   <fieldset id="new-lore-fields"><label for="lore-entry-type">Entry type</label><select id="lore-entry-type"></select><label for="lore-entry-name">Name</label><input id="lore-entry-name" maxlength="160" placeholder="Give your entry a name" required autocomplete="off"></fieldset>
   <p id="new-lore-error" role="alert" hidden></p>
   <div class="lore-dialog-actions"><button class="lore-text-button" id="cancel-lore" type="button">Cancel</button><button class="workspace-action" id="create-lore" type="submit">Create entry <span aria-hidden="true">↗</span></button></div>
  </form>
 </dialog>
`
 }
};

export const dashboardPages=new Map([
 ['/',home],['/index.html',home],['/dashboard/',home],['/dashboard/index.html',home],
 ['/lore/',lore],['/lore/index.html',lore]
]);
