import {initProfileEditor} from '../profiles/editor.js?v=__WTF_ASSET_REVISION__';
import {arcBeats,pacingMetrics,storyArcFields} from './template.js?v=__WTF_ASSET_REVISION__';

const {record,targets,otherArcs}=JSON.parse(document.querySelector('#profile-data').textContent),form=document.querySelector('#profile-form');
const targetMap=new Map(targets.map(target=>[target.kind+':'+target.id,target])),keyEntityIds=new Set(record.keyEntities.map(target=>target.kind+':'+target.id)),connectedRows=[],sceneRows=[];
const dirty=()=>form.dispatchEvent(new Event('change',{bubbles:true}));
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}

function updateGraph(){
 const height=190,top=20,bottom=34,y=value=>top+(99-value)*(height-top-bottom)/99;
 for(const input of form.querySelectorAll('[data-pacing-beat]')){
  const metric=input.dataset.pacingMetric,beat=input.dataset.pacingBeat,value=Number(input.value);input.nextElementSibling.value=String(value);input.style.setProperty('--pacing-value',value+'%');
  for(const points of form.querySelectorAll(`[data-graph-points="${metric}"]`))points.querySelector(`[data-beat="${beat}"]`)?.setAttribute('cy',String(y(value)));
 }
 for(const [metric] of pacingMetrics)for(const line of form.querySelectorAll(`[data-graph-line="${metric}"]`)){const chart=line.closest('.pacing-chart'),points=arcBeats.map(beat=>{const point=chart.querySelector(`[data-graph-points="${metric}"] [data-beat="${beat.id}"]`);return point.getAttribute('cx')+','+point.getAttribute('cy');}).join(' ');line.setAttribute('points',points);}
}
form.querySelectorAll('[data-pacing-beat]').forEach(input=>input.addEventListener('input',()=>{updateGraph();dirty();}));

const mainPacing=document.querySelector('#pacing .pacing-chart'),stickyPacing=document.querySelector('#sticky-pacing'),articleBar=document.querySelector('.article-bar');let stickyFrame=0;
function updateStickyPacing(){stickyFrame=0;if(!mainPacing||!stickyPacing)return;const bounds=mainPacing.getBoundingClientRect(),edge=articleBar?.getBoundingClientRect().bottom||0;stickyPacing.hidden=matchMedia('(max-width: 650px)').matches||bounds.height===0||bounds.bottom>edge;}
function scheduleStickyPacing(){if(!stickyFrame)stickyFrame=requestAnimationFrame(updateStickyPacing);}
window.addEventListener('scroll',scheduleStickyPacing,{passive:true});window.addEventListener('resize',scheduleStickyPacing);form.addEventListener('toggle',scheduleStickyPacing,true);updateStickyPacing();

const entityValues=document.querySelector('#key-entity-values'),entitySelect=document.querySelector('#key-entity-select');
function paintEntities(){
 entityValues.replaceChildren();
 for(const key of keyEntityIds){const target=targetMap.get(key);if(!target)continue;const chip=element('span','key-entity-chip'),link=element('a','',target.label),remove=element('button','','×');link.href=target.href;remove.type='button';remove.setAttribute('aria-label','Remove '+target.label);remove.addEventListener('click',()=>{keyEntityIds.delete(key);paintEntities();dirty();entitySelect.focus();});chip.append(link,remove);entityValues.append(chip);}
 for(const option of entitySelect.options)option.disabled=keyEntityIds.has(option.value);entitySelect.value='';
}
entitySelect.addEventListener('change',()=>{if(entitySelect.value){keyEntityIds.add(entitySelect.value);paintEntities();dirty();}});paintEntities();

function addConnectedArc(id='',focus=false){
 const row=element('div','connected-arc-row'),select=element('select'),open=element('a','connected-arc-link','Open arc →'),remove=element('button','quiet-button','Remove');
 select.setAttribute('aria-label','Connected story arc');select.required=true;select.append(new Option('Choose a story arc',''));for(const arc of otherArcs)select.append(new Option(arc.name||'Untitled story arc',arc.id));select.value=id;
 open.hidden=!id;open.href=id?'/story-arcs/'+encodeURIComponent(id)+'/':'#';remove.type='button';const source={row,select};connectedRows.push(source);
 select.addEventListener('change',()=>{open.hidden=!select.value;open.href=select.value?'/story-arcs/'+encodeURIComponent(select.value)+'/':'#';dirty();});
 remove.addEventListener('click',()=>{connectedRows.splice(connectedRows.indexOf(source),1);row.remove();dirty();document.querySelector('#add-connected-arc').focus();});
 row.append(select,open,remove);document.querySelector('#connected-arc-list').append(row);if(focus){select.focus();dirty();}
}
for(const id of record.connectedArcIds)addConnectedArc(id);
document.querySelector('#add-connected-arc').addEventListener('click',()=>addConnectedArc('',true));

function field(label,control){const wrapper=element('label');wrapper.append(element('span','',label),control);return wrapper;}
function addKeyScene(scene={title:'',chapter:'',beat:'',summary:''},focus=false){
 const row=element('div','key-scene-row'),title=element('input'),chapter=element('input'),beat=element('select'),summary=element('textarea'),remove=element('button','quiet-button','Remove scene');
 title.value=scene.title;title.maxLength=160;title.required=true;title.placeholder='Scene title';chapter.value=scene.chapter;chapter.maxLength=160;chapter.placeholder='Chapter or section';
 beat.append(new Option('Choose a narrative beat',''));for(const item of arcBeats)beat.append(new Option(item.title,item.id));beat.value=scene.beat;summary.value=scene.summary;summary.maxLength=10000;summary.rows=2;summary.placeholder='What changes in this scene?';remove.type='button';
 const source={id:scene.id||crypto.randomUUID(),row,title,chapter,beat,summary};sceneRows.push(source);for(const control of [title,chapter,beat,summary])control.addEventListener('input',dirty);
 remove.addEventListener('click',()=>{sceneRows.splice(sceneRows.indexOf(source),1);row.remove();dirty();document.querySelector('#add-key-scene').focus();});
 row.append(field('Scene',title),field('Chapter',chapter),field('Beat',beat),field('Purpose & change',summary),remove);document.querySelector('#key-scene-list').append(row);if(focus){title.focus();dirty();}
}
for(const scene of record.keyScenes)addKeyScene(scene);
document.querySelector('#add-key-scene').addEventListener('click',()=>addKeyScene(undefined,true));

form.elements.namedItem('arcType').addEventListener('change',event=>{document.querySelector('.arc-type-label').textContent=event.target.value;});
initProfileEditor({fieldNames:storyArcFields,endpoint:'/api/story-arcs',type:'story arc',readExtra(){
 const connectedArcIds=connectedRows.map(({select})=>select.value);if(connectedArcIds.some(id=>!id))throw new Error('Choose an arc for every connected subplot.');if(new Set(connectedArcIds).size!==connectedArcIds.length)throw new Error('Choose every connected subplot once.');
 const keyEntities=Array.from(keyEntityIds,key=>{const target=targetMap.get(key);return {kind:target.kind,id:target.id};});
 const keyScenes=sceneRows.map(({id,title,chapter,beat,summary})=>({id,title:title.value,chapter:chapter.value,beat:beat.value,summary:summary.value}));
 const pacing=Object.fromEntries(arcBeats.map(beat=>[beat.id,Object.fromEntries(pacingMetrics.map(([metric])=>[metric,Number(form.querySelector(`[data-pacing-beat="${beat.id}"][data-pacing-metric="${metric}"]`).value)]))]));
 return {keyEntities,connectedArcIds,keyScenes,pacing};
}});
