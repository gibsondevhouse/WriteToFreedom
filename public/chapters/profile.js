import {initProfileEditor} from '../profiles/editor.js?v=__WTF_ASSET_REVISION__';
import {resize} from '../profiles/controls.js?v=profile-reading-1';

const editor=initProfileEditor({
 fieldNames:['title','summary'],endpoint:'/api/chapters',type:'chapter',nameField:'title',
 onSaved(){resize(document.querySelector('#field-title'));}
});

// History can restore an old chapter presentation after its scenes changed.
// Keep a local profile draft intact; clean pages can load the saved article.
window.addEventListener('pageshow',event=>{
 if(event.persisted&&!editor.dirty&&document.querySelector('#chapter-scenes-editor')?.dataset.dirty!=='true')location.reload();
});
