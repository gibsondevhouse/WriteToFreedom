import {scopedCatalogUrl,novelContextHref} from '../profiles/novel-context.js?v=__WTF_ASSET_REVISION__';
import {initDirectoryShell,fetchDirectory} from '../directory/shell.js?v=__WTF_ASSET_REVISION__';
import {createProfileStoryCard} from '../components/story-card/profile-card.js?v=__WTF_ASSET_REVISION__';

const directory=initDirectoryShell({
 async load(options){return (await fetchDirectory('/api/story-arcs',options)).storyArcs;},
 select(records,{query,sort,reversed}){
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),matches=records.filter(record=>terms.every(term=>JSON.stringify(record).toLocaleLowerCase().includes(term)));
  if(sort==='name')matches.sort((a,b)=>(a.name||'Untitled story arc').localeCompare(b.name||'Untitled story arc'));
  if(sort==='status')matches.sort((a,b)=>(a.status||'').localeCompare(b.status||'')||(a.name||'').localeCompare(b.name||''));
  if(sort==='type')matches.sort((a,b)=>(a.arcType||'').localeCompare(b.arcType||'')||(a.name||'').localeCompare(b.name||''));
  return reversed?matches.reverse():matches;
 },
 renderItem(arc){
  const dates=[arc.startDate,arc.endDate].filter(Boolean).join(' → '),record={...arc,name:arc.name||'Untitled story arc',href:novelContextHref('/story-arcs/'+encodeURIComponent(arc.id)+'/')};
  return createProfileStoryCard(record,{headingLevel:2,label:arc.arcType||'Story Arc',contextLabel:arc.status||'Outlining',contextText:dates||arc.logline||'Set the scope and shape of this storyline.',sections:[{label:'Pacing',hash:'pacing',icon:'overview'},{label:'Narrative',hash:'exposition',icon:'story'},{label:'Stakes',hash:'stakes',icon:'relationships'},{label:'Key scenes',hash:'key-scenes',icon:'notes'}],cardClass:'story-arc-card'});
 }
});

const button=document.querySelector('#new-story-arc');let creating=false,pendingId;
button.addEventListener('click',async()=>{
 if(creating)return;creating=true;button.disabled=true;button.textContent='Creating…';directory.clearError();pendingId??=crypto.randomUUID();
 try{const response=await fetch(scopedCatalogUrl('/api/story-arcs'),{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id:pendingId})});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');const arc=await response.json();if(!response.ok)throw new Error(arc.error||'Unable to create your story arc.');location.assign(novelContextHref('/story-arcs/'+encodeURIComponent(arc.id)+'/'));}
 catch(error){directory.showError(error);creating=false;button.disabled=false;button.textContent='+ New story arc';}
});
window.addEventListener('pageshow',event=>{if(event.persisted){creating=false;pendingId=undefined;button.disabled=false;button.textContent='+ New story arc';}});
