import {initDirectoryShell,fetchDirectory} from '../directory/shell.js?v=1';
import {createProfileStoryCard} from '../components/story-card/profile-card.js?v=__WTF_ASSET_REVISION__';

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
  const record={...f,name:f.name||'Untitled faction',href:'/factions/'+encodeURIComponent(f.id)+'/',image:f.imageUrl||''};
  return createProfileStoryCard(record,{headingLevel:2,label:f.type||'Faction',contextLabel:[f.status,f.location].filter(Boolean).join(' · ')||'Faction',contextText:f.motto||f.purpose||f.summary||f.introduction||'Open this faction to add its story.',sections:[{label:'Overview',hash:'overview',icon:'overview'},{label:'Relations',hash:'relations',icon:'relationships'},{label:'Open questions',hash:'field-questions',icon:'notes'},{label:'Ratings',hash:'ratings',icon:'overview'}],cardClass:'faction-card'});
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
