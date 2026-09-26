/** Durable browsing context; authorisation always remains on the server. */
export function scopedCatalogUrl(path){
 const current=new URL(location.href),novel=current.searchParams.get('novel');
 if(!novel)return path;
 const url=new URL(path,location.origin);url.searchParams.set('novelId',novel);
 return url.pathname+url.search;
}
export function novelContextHref(path){
 const novel=new URL(location.href).searchParams.get('novel');if(!novel)return path;
 const url=new URL(path,location.origin);url.searchParams.set('novel',novel);return url.pathname+url.search+url.hash;
}
export function showCatalogScope(scope,root=document.querySelector('[data-directory-shell],[data-dashboard-shell]')){
 if(!scope||!root)return;
 let message=root.querySelector('[data-novel-scope]');
 if(!message){message=document.createElement('p');message.className='directory-intro';message.dataset.novelScope='';root.prepend(message);}
 message.replaceChildren(document.createTextNode('Linked material for '+scope.title+'. '));
 const link=document.createElement('a'),url=new URL(location.href);url.searchParams.delete('novel');link.href=url.pathname+url.search;link.textContent='Browse the whole library';message.append(link);
}
