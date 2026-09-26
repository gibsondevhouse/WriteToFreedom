import {el,tone,initial,createRails} from './components.js?v=__WTF_ASSET_REVISION__';
import {createQuestionBanner} from './question-banner.js?v=__WTF_ASSET_REVISION__';
import {scopedCatalogUrl,showCatalogScope} from '../profiles/novel-context.js?v=__WTF_ASSET_REVISION__';

/** Read a private dashboard without coupling the shell to its data shape. */
export async function fetchDashboard(endpoint,{signal,errorMessage='Your dashboard could not be loaded.'}={}){
 const response=await fetch(scopedCatalogUrl(endpoint),{credentials:'same-origin',cache:'no-store',signal});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Reload the page to sign in again. Keep a copy of any unsaved work.');
 const data=await response.json();
 if(!response.ok)throw new Error(data.error||errorMessage);
 showCatalogScope(data.scope);
 return data;
}

function createView(id){
 const rails=createRails({idPrefix:id}),cleanup=[()=>rails.destroy()];
 let questionIndex=0,destroyed=false;
 return {
  nodes:[],showEmpty:false,
  append(...nodes){this.nodes.push(...nodes.filter(Boolean));},
  rail({id:sectionId,title,records,card,href,emptyText,emptyAction,hideWhenEmpty=false}){
   if(hideWhenEmpty&&!records.length)return null;
   const section=rails.rail(title,records,card,href,emptyText,{id:sectionId,emptyAction});
   this.append(section);return section;
  },
  questions(records,{hideWhenEmpty=false,emptyState}={}){
   if(hideWhenEmpty&&!records.length)return null;
   const banner=createQuestionBanner(records,{el,tone,initial,emptyState,idPrefix:`${id}-questions-${++questionIndex}`});
   cleanup.push(banner.destroy);this.append(banner.element);return banner.element;
  },
  empty(){this.showEmpty=true;},
  destroy(){if(destroyed)return;destroyed=true;cleanup.forEach(dispose=>dispose());}
 };
}

/**
 * Mount once on the server-rendered shell. Page adapters own data and controls;
 * this controller owns status, refresh/retry, replaceable rows and their cleanup.
 * Header, toolbar, collections, dialogs and empty actions are never replaced.
 * A refresh during a read queues a fresh read, including after a successful write.
 */
export function initDashboardShell({
 root=document.querySelector('[data-dashboard-shell]'),endpoint,
 load=options=>fetchDashboard(endpoint,options),render,onData=()=>{},autoload=true
}){
 if(!root||typeof render!=='function')throw new Error('A dashboard root and renderer are required.');
 const find=selector=>root.querySelector(selector);
 const body=find('[data-dashboard-body]'),rows=find('[data-dashboard-rows]'),loading=find('[data-dashboard-loading]');
 const error=find('[data-dashboard-error]'),message=find('[data-dashboard-error-message]'),retry=find('[data-dashboard-retry]'),empty=find('[data-dashboard-empty]');
 const abort=new AbortController();
 let data,hasData=false,activeView=null,pending=null,queued=false,destroyed=false;
 function showError(reason){
  loading.hidden=true;message.textContent=reason?.message||'Your dashboard could not be loaded.';
  error.hidden=false;root.dataset.dashboardState='error';
 }
 function paint(next){
  const view=createView(root.id);
  try{render(next,view);}catch(reason){view.destroy();throw reason;}
  activeView?.destroy();rows.replaceChildren(...view.nodes);activeView=view;
  empty.hidden=!view.showEmpty;
 }
 async function read(){
  do{
   queued=false;
   try{
    const next=await load({signal:abort.signal});
    if(destroyed)return;
    // A mutation may have made this response stale while it was in flight.
    if(queued)continue;
    paint(next);data=next;hasData=true;onData(next);
    loading.hidden=true;error.hidden=true;root.dataset.dashboardState='ready';
   }catch(reason){if(!destroyed&&!queued)showError(reason);}
  }while(queued&&!destroyed);
 }
 function refresh(){
  if(destroyed)return Promise.resolve();
  if(pending){queued=true;return pending;}
  error.hidden=true;loading.hidden=hasData;retry.disabled=true;body.setAttribute('aria-busy','true');
  root.dataset.dashboardState=hasData?'refreshing':'loading';
  pending=Promise.resolve().then(read).finally(()=>{
   pending=null;
   if(!destroyed){retry.disabled=false;body.setAttribute('aria-busy','false');}
  });
  return pending;
 }
 function rerender(){
  if(destroyed||!hasData)return;
  try{paint(data);}catch(reason){showError(reason);}
 }
 const retryClick=()=>refresh(),pageshow=event=>{if(event.persisted)refresh();};
 const pagehide=event=>{if(!event.persisted)destroy();};
 function destroy(){
  if(destroyed)return;destroyed=true;queued=false;abort.abort();activeView?.destroy();
  retry.removeEventListener('click',retryClick);window.removeEventListener('pageshow',pageshow);window.removeEventListener('pagehide',pagehide);
  body.setAttribute('aria-busy','false');
 }
 retry.addEventListener('click',retryClick);window.addEventListener('pageshow',pageshow);window.addEventListener('pagehide',pagehide);
 if(autoload)refresh();
 return {root,rows,refresh,render:rerender,destroy,get data(){return data;}};
}
