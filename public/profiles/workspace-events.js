const storageKey='write-to-freedom:workspace-change';

/** Notify the current document and other same-origin tabs that saved workspace data changed. */
export function announceWorkspaceChange(){
 window.dispatchEvent(new Event('workspace:changed'));
 try{localStorage.setItem(storageKey,Date.now()+':'+Math.random());}catch{}
}

/** Observe saved workspace changes in this document and in other same-origin tabs. */
export function observeWorkspaceChanges(callback){
 const changed=()=>callback(),stored=event=>{if(event.key===storageKey)callback();};
 window.addEventListener('workspace:changed',changed);window.addEventListener('storage',stored);
 return ()=>{window.removeEventListener('workspace:changed',changed);window.removeEventListener('storage',stored);};
}

export {storageKey as workspaceChangeStorageKey};
