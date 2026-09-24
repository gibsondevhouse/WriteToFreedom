import {initDirectoryShell,fetchDirectory} from '../directory/shell.js?v=1';

function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
const directory=initDirectoryShell({
 async load(options){return (await fetchDirectory('/api/factions',options)).factions;},
 select(records,{query,sort,reversed}){
  const needle=query.trim().toLocaleLowerCase(),matches=records.filter(f=>JSON.stringify(f).toLocaleLowerCase().includes(needle));
  if(sort==='name')matches.sort((a,b)=>(a.name||'Untitled faction').localeCompare(b.name||'Untitled faction'));
  if(sort==='type')matches.sort((a,b)=>(a.type||'').localeCompare(b.type||'')||(a.name||'').localeCompare(b.name||''));
  return reversed?matches.reverse():matches;
 },
 renderItem(f,filters,index){
  const article=node('article','faction-entry'),link=node('a','faction-summary'),heading=node('div','faction-heading'),name=f.name||'Untitled faction';
  link.href='/factions/'+encodeURIComponent(f.id)+'/';
  const initials=name.replace(/^The /,'').split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase(),avatar=node('span','faction-avatar',initials),info=node('div','faction-info'),arrow=node('span','faction-arrow','›');
  avatar.setAttribute('aria-hidden','true');arrow.setAttribute('aria-hidden','true');
  info.append(node('h2','',`${index+1}. ${name}`),node('p','faction-meta',[f.type,f.status,f.location].filter(Boolean).join(' · ')||'Faction in development'),node('p','faction-motto',f.motto||f.purpose||''));
  heading.append(avatar,info,arrow);
  link.append(heading,node('p','faction-preview',f.summary||f.introduction||'A blank faction, ready to take its place in your world.'));
  article.append(link);return article;
 }
});

const newButton=document.querySelector('#new-faction');
let pendingId,creating=false;
newButton.addEventListener('click',async()=>{
 if(creating)return;creating=true;newButton.disabled=true;newButton.textContent='Creating…';directory.clearError();pendingId??=crypto.randomUUID();
 try{
  const response=await fetch('/api/factions',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id:pendingId,blank:true})});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');
  const faction=await response.json();if(!response.ok)throw new Error(faction.error||'Unable to create your faction.');
  location.assign('/factions/'+encodeURIComponent(faction.id)+'/');
 }catch(error){directory.showError(error);creating=false;newButton.disabled=false;newButton.textContent='+ New faction';}
});
window.addEventListener('pageshow',event=>{if(event.persisted){creating=false;pendingId=undefined;newButton.disabled=false;newButton.textContent='+ New faction';}});
