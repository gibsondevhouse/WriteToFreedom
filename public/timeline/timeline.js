import {observeWorkspaceChanges} from '../profiles/workspace-events.js?v=__WTF_ASSET_REVISION__';
import {types,kinds,filterEvents,timelineRows,zoomAt,fitView,rulerTicks,parseStoryDate,minScale,maxScale} from './model.js?v=__WTF_ASSET_REVISION__';
const $=selector=>document.querySelector(selector),stage=$('#timeline'),ruler=$('#ruler'),grid=$('#grid'),lanes=$('#lanes'),message=$('#timeline-message'),filters=$('#filters'),orb=$('#filter-toggle');
const ROW=104,RULER=57;
let data={events:[],unplaced:[],undated:0,counts:{}},visible=[],rows=[],view={start:1,scale:120,y:0},size={width:stage.clientWidth,height:stage.clientHeight},loaded=false,loading=false,frame=0,filterDirty=false,lastFocus=null,suppressClick=false;
const selection={query:'',types:Object.keys(types),kinds:Object.keys(kinds)};
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;render();});}
function clampY(){view.y=Math.max(0,Math.min(view.y,Math.max(0,rows.length*ROW+140-(size.height-RULER))));}
function updateScale(){const span=size.width/view.scale;$('#scale-label').textContent=span>=2?`${Math.round(span).toLocaleString()} years in view`:span>=.15?`${Math.max(1,Math.round(span*12))} months in view`:`${Math.max(1,Math.round(span*365))} days in view`;$('#zoom-level').value=100*Math.log(view.scale/minScale)/Math.log(maxScale/minScale);}
function render(){
 clampY();const ticks=rulerTicks(view.start,size.width,view.scale),axis=document.createDocumentFragment(),lines=document.createDocumentFragment();
 for(const tick of ticks){const x=(tick.value-view.start)*view.scale;if(x< -120||x>size.width)continue;const mark=node('div',tick.label,'tick'+(tick.major?' major':''));mark.style.left=x+'px';if(tick.year)mark.append(node('small',tick.year));axis.append(mark);const line=node('div',undefined,'grid-line'+(tick.major?' major':''));line.style.left=x+'px';lines.append(line);}
 ruler.replaceChildren(axis);grid.replaceChildren(lines);
 const fragment=document.createDocumentFragment();const first=Math.max(0,Math.floor((view.y-28)/ROW)-1),last=Math.min(rows.length,first+Math.ceil(size.height/ROW)+3);
 for(let index=first;index<last;index++){
  const row=rows[index],points=row.events.map(event=>({event,x:(event.date.position-view.start)*view.scale})),lo=points[0].x,hi=points.at(-1).x;
  if(hi< -220||lo>size.width+220)continue;
  const lane=node('div',undefined,'timeline-row');lane.dataset.type=row.type;lane.style.top=(28+index*ROW-view.y)+'px';
  const name=node('div',undefined,'row-name');name.style.left=Math.max(18,lo)+'px';name.append(node('span',undefined,'row-dot'),node('span',row.name),node('small',row.type));lane.append(name);
  if(points.length>1){const span=node('div',undefined,'event-span');span.style.left=Math.max(-2,lo)+'px';span.style.width=Math.max(1,Math.min(size.width+2,hi)-Math.max(-2,lo))+'px';lane.append(span);}
  fragment.append(lane);
 }
 lanes.replaceChildren(fragment);
 updateScale();
}
function showMessage(title,text,links=[]){message.replaceChildren(node('span','◇','empty-mark'),node('h2',title),node('p',text));if(links.length){const list=node('div',undefined,'empty-links');for(const [label,href] of links){const link=node('a',label);link.href=href;list.append(link);}message.append(list);}message.hidden=false;}
function applyFilters({fit=false}={}){
 visible=filterEvents(data.events,selection);rows=timelineRows(visible);filterDirty=selection.query.trim()!==''||selection.types.length!==Object.keys(types).length||selection.kinds.length!==Object.keys(kinds).length;$('#filter-active').hidden=!filterDirty;
 if(fit)view={...fitView(visible,size.width),y:0};
 $('#timeline-count').textContent=`${visible.length.toLocaleString()} ${visible.length===1?'event':'events'}${visible.length!==data.events.length?' of '+data.events.length:''}`;
 $('#filter-summary').textContent=`${data.undated} ${data.undated===1?'profile has':'profiles have'} no dates yet`;
 if(!data.events.length)showMessage('Your story’s timeline starts here','Saved birth dates, founding years, and other dated milestones will appear here automatically.',[['Characters','/characters/'],['Factions','/factions/'],['Locations','/locations/']]);
 else if(!visible.length)showMessage('No matching events','Open the filter below to change what appears on your timeline.');
 else message.hidden=true;
 schedule();
}
function makeFilters(host,values,key){for(const [value,label] of Object.entries(values)){const wrapper=node('label'),input=node('input');input.type='checkbox';input.value=value;input.checked=true;input.dataset.filter=key;wrapper.dataset.type=value;const count=node('span','0','filter-number');count.dataset.count=value;wrapper.append(input,node('span',label),count);host.append(wrapper);input.addEventListener('change',()=>{selection[key]=[...host.querySelectorAll('input:checked')].map(n=>n.value);applyFilters();});}}
makeFilters($('#type-filters'),types,'types');makeFilters($('#kind-filters'),kinds,'kinds');
$('#timeline-search').addEventListener('input',event=>{selection.query=event.target.value;applyFilters();});
$('#reset-filters').addEventListener('click',()=>{selection.query='';selection.types=Object.keys(types);selection.kinds=Object.keys(kinds);$('#timeline-search').value='';filters.querySelectorAll('input[type=checkbox]').forEach(n=>n.checked=true);applyFilters();});
function fit(){view={...fitView(visible,size.width),y:0};schedule();}
function zoom(factor,x=size.width/2){view=zoomAt(view,factor,x);schedule();}
$('#zoom-out').addEventListener('click',()=>zoom(1/1.7));$('#zoom-in').addEventListener('click',()=>zoom(1.7));$('#fit-view').addEventListener('click',fit);
$('#zoom-level').addEventListener('input',event=>zoom(minScale*(maxScale/minScale)**(Number(event.target.value)/100)/view.scale));
$('#go-to-year').addEventListener('submit',event=>{event.preventDefault();const date=parseStoryDate($('#jump-year').value);$('#jump-error').hidden=Boolean(date);if(!date)return;view.start=date.position-size.width/view.scale/2;schedule();lastFocus=stage;filters.close();});
$('#jump-year').addEventListener('input',()=>$('#jump-error').hidden=true);
function openDialog(dialog,focus){lastFocus=document.activeElement;dialog.showModal();(focus||dialog.querySelector('.close-dialog')).focus();}
orb.addEventListener('click',()=>openDialog(filters,$('#timeline-search')));
filters.querySelector('.close-dialog').addEventListener('click',()=>filters.close());
filters.addEventListener('click',event=>{const box=filters.getBoundingClientRect();if(event.target===filters&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom))filters.close();});
filters.addEventListener('close',()=>{if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});else stage.focus({preventScroll:true});});
function populateMetadata(){
 for(const count of $('#type-filters').querySelectorAll('[data-count]'))count.textContent=data.events.filter(e=>e.type===count.dataset.count).length;
 for(const count of $('#kind-filters').querySelectorAll('[data-count]'))count.textContent=data.events.filter(e=>e.kind===count.dataset.count).length;
 $('#unplaced-label').textContent=`Unplaced dates (${data.unplaced.length})`;$('#unplaced-dates').hidden=!data.unplaced.length;
 const list=$('#unplaced-list');list.replaceChildren();for(const entry of data.unplaced){const li=node('li'),link=node('a',entry.name+' · '+entry.label);link.href=entry.href;li.append(link,node('span',entry.rawDate));list.append(li);}
}
async function load(){
 if(loading)return;loading=true;
 try{const response=await fetch('/api/timeline',{credentials:'same-origin',cache:'no-store'});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Sign in again to load your saved timeline.');const next=await response.json();if(!response.ok)throw new Error(next.error||'Please try again.');const needsFit=!loaded||!data.events.length&&next.events.length;data=next;loaded=true;populateMetadata();applyFilters({fit:needsFit});}
 catch(error){if(!loaded){showMessage('Timeline unavailable',error.message);const retry=node('button','Try again');retry.type='button';retry.addEventListener('click',load);message.append(retry);$('#timeline-count').textContent='Not loaded';}else $('#timeline-count').textContent='Could not refresh · showing last loaded events';}
 finally{loading=false;}
}
// A virtual viewport avoids giant elements and permits continuous travel through years.
stage.addEventListener('wheel',event=>{
 if(event.target.closest('.timeline-message'))return;event.preventDefault();const unit=event.deltaMode===1?16:event.deltaMode===2?size.height:1,dx=event.deltaX*unit,dy=event.deltaY*unit;
 if(event.ctrlKey||event.metaKey){const rect=stage.getBoundingClientRect();zoom(Math.exp(-Math.max(-120,Math.min(120,dy))*.009),event.clientX-rect.left);}
 else if(event.shiftKey||rows.length*ROW<size.height-RULER){view.start+=(dx||dy)/view.scale;schedule();}
 else{view.start+=dx/view.scale;view.y+=dy;schedule();}
},{passive:false});
const pointers=new Map();let gesture=null,dragDistance=0;
function snapshotGesture(){const points=[...pointers.values()];if(points.length>1){const [a,b]=points;gesture={kind:'pinch',distance:Math.hypot(a.x-b.x,a.y-b.y),midX:(a.x+b.x)/2,midY:(a.y+b.y)/2,view:{...view}};}else if(points.length){gesture={kind:'pan',x:points[0].x,y:points[0].y,view:{...view}};}else gesture=null;}
stage.addEventListener('pointerdown',event=>{
 if(event.button!==0||event.target.closest('.timeline-message'))return;const rect=stage.getBoundingClientRect();pointers.set(event.pointerId,{x:event.clientX-rect.left,y:event.clientY-rect.top});if(pointers.size===1){dragDistance=0;suppressClick=false;stage.focus({preventScroll:true});}else dragDistance=10;snapshotGesture();stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove',event=>{
 if(!pointers.has(event.pointerId)||!gesture)return;const rect=stage.getBoundingClientRect(),point={x:event.clientX-rect.left,y:event.clientY-rect.top};pointers.set(event.pointerId,point);
 if(gesture.kind==='pinch'&&pointers.size>1){const [a,b]=[...pointers.values()],midX=(a.x+b.x)/2,midY=(a.y+b.y)/2;view=zoomAt(gesture.view,Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,gesture.distance),gesture.midX);view.start+=(gesture.midX-midX)/view.scale;view.y=gesture.view.y+gesture.midY-midY;dragDistance=10;}
 else if(gesture.kind==='pan'){const dx=point.x-gesture.x,dy=point.y-gesture.y;dragDistance=Math.max(dragDistance,Math.hypot(dx,dy));if(dragDistance<5)return;view.start=gesture.view.start-dx/view.scale;view.y=gesture.view.y-dy;}
 if(!stage.hasPointerCapture(event.pointerId))stage.setPointerCapture(event.pointerId);
 stage.classList.add('dragging');suppressClick=dragDistance>=5;schedule();
});
function endPointer(event){if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);if(stage.hasPointerCapture(event.pointerId))stage.releasePointerCapture(event.pointerId);if(pointers.size)snapshotGesture();else{gesture=null;stage.classList.remove('dragging');}}
window.addEventListener('pointerup',endPointer);window.addEventListener('pointercancel',endPointer);
stage.addEventListener('click',event=>{if(suppressClick&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();}},true);
stage.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,select,textarea'))return;
 let handled=true;
 if(event.key==='ArrowLeft')view.start-=size.width/view.scale*.12;
 else if(event.key==='ArrowRight')view.start+=size.width/view.scale*.12;
 else if(event.key==='ArrowUp')view.y-=ROW;
 else if(event.key==='ArrowDown')view.y+=ROW;
 else if(event.key==='+'||event.key==='=')zoom(1.5);
 else if(event.key==='-'||event.key==='_')zoom(1/1.5);
 else if(event.key==='Home')fit();
 else handled=false;
 if(handled){event.preventDefault();schedule();}
});
new ResizeObserver(()=>{size={width:stage.clientWidth,height:stage.clientHeight};schedule();}).observe(stage);
window.addEventListener('focus',load);window.addEventListener('pageshow',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});observeWorkspaceChanges(load);setInterval(()=>{if(!document.hidden)load();},30000);
schedule();load();
