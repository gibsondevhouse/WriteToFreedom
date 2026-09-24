import {connectionGraph,layoutConnections} from './connections-model.js';
const ns='http://www.w3.org/2000/svg';
function svgNode(tag,attrs={}){const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
/**
 * Render an interactive SVG graph from rich card records, scoped to the connected
 * component containing focusId. Owns local pan/zoom/selection/drag state only;
 * does not fetch, save relationships, or persist positions. Returns a DOM subtree.
 */
export function createConnectionsMap(characters,focusId){
 const graph=layoutConnections(connectionGraph(characters,focusId),focusId),byId=new Map(graph.nodes.map(node=>[node.id,node]));
 const root=el('div','connections-map'),toolbar=el('div','connections-toolbar'),canvas=el('div','connections-canvas'),details=el('aside','connections-detail');details.setAttribute('aria-label','Selected connection');
 toolbar.append(el('p','',`${graph.nodes.length} characters · ${graph.edges.length} connections`));
 const controls=el('div','connections-zoom');let scale=1,pan={x:0,y:0},selected=focusId,gesture;
 const svg=svgNode('svg',{viewBox:'0 0 900 560',tabindex:0,'aria-label':'Character connections. Drag to pan, drag a node to move it, or use the zoom controls.'});
 const world=svgNode('g');svg.append(world);const lines=graph.edges.map(edge=>{const line=svgNode('line',{'class':'connection-edge'});world.append(line);return {edge,line};});
 const nodeViews=new Map();
 for(const node of graph.nodes){
  const group=svgNode('g',{'class':'connection-node',tabindex:0,role:'button','aria-label':'Show connections for '+node.name}),hit=svgNode('circle',{r:22,'class':'connection-hit'}),circle=svgNode('circle',{r:node.id===focusId?9:5}),label=svgNode('text',{y:26,'text-anchor':'middle'});label.textContent=node.name;const title=svgNode('title');title.textContent=node.name;
  group.append(title,hit,circle,label);world.append(group);nodeViews.set(node.id,group);
  group.addEventListener('click',()=>{if(!gesture?.moved)select(node.id);});
  group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(node.id);}});
  group.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.stopPropagation();gesture={node,start:point(event,world),moved:false};group.setPointerCapture(event.pointerId);});
  group.addEventListener('pointermove',event=>{if(gesture?.node!==node)return;const p=point(event,world);if(Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>2)gesture.moved=true;node.x=p.x;node.y=p.y;draw();});
  group.addEventListener('pointerup',()=>{if(gesture?.node===node){const moved=gesture.moved;gesture=null;if(!moved)select(node.id);}});
  group.addEventListener('pointercancel',()=>gesture=null);
 }
 function point(event,element){return new DOMPoint(event.clientX,event.clientY).matrixTransform(element.getScreenCTM().inverse());}
 function draw(){world.setAttribute('transform',`translate(${pan.x} ${pan.y}) scale(${scale})`);for(const {edge,line}of lines){const a=byId.get(edge.source),b=byId.get(edge.target);for(const [key,value]of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(key,value);line.classList.toggle('is-connected',edge.source===selected||edge.target===selected);}
  const neighbors=new Set(graph.edges.filter(e=>e.source===selected||e.target===selected).flatMap(e=>[e.source,e.target]));
  for(const node of graph.nodes){const view=nodeViews.get(node.id);view.setAttribute('transform',`translate(${node.x} ${node.y})`);view.classList.toggle('is-selected',node.id===selected);view.classList.toggle('is-neighbor',neighbors.has(node.id));view.classList.toggle('is-focus',node.id===focusId);view.classList.toggle('show-label',graph.nodes.length<=12||neighbors.has(node.id)||node.id===selected);view.setAttribute('aria-pressed',String(node.id===selected));}
 }
 function select(id){selected=id;draw();details.replaceChildren();const person=byId.get(id);if(!person)return;const heading=el('h3','',person.name),profile=el('a','connection-profile','Open profile ↗');profile.href=person.href;details.append(heading,profile);
  const connected=graph.edges.filter(edge=>edge.source===id||edge.target===id);
  if(!connected.length)details.append(el('p','detail-empty','No connections recorded yet. Add relationships on this character’s profile.'));
  for(const edge of connected){const other=byId.get(edge.source===id?edge.target:edge.source),section=el('section'),choose=el('button','connection-person',other.name);choose.type='button';choose.addEventListener('click',()=>select(other.id));section.append(choose);
   for(const connection of edge.connections){section.append(el('p','connection-type',connection.type),el('p','connection-direction',byId.get(connection.from).name+' → '+byId.get(connection.to).name));if(connection.description)section.append(el('p','connection-notes',connection.description));}details.append(section);
  }
  picker.value=id;
 }
 function zoom(factor,center={x:450,y:280}){const next=Math.max(.4,Math.min(3,scale*factor));pan={x:center.x-(center.x-pan.x)*next/scale,y:center.y-(center.y-pan.y)*next/scale};scale=next;draw();}
 for(const [label,text,action]of [['Zoom out','−',()=>zoom(1/1.25)],['Reset view','Reset',()=>{scale=1;pan={x:0,y:0};draw();}],['Zoom in','+',()=>zoom(1.25)]]){const b=el('button','',text);b.type='button';b.setAttribute('aria-label',label);b.addEventListener('click',action);controls.append(b);}
 const picker=el('select','connection-picker');picker.setAttribute('aria-label','Select a character in the connections map');for(const node of graph.nodes){const option=el('option','',node.name);option.value=node.id;picker.append(option);}picker.addEventListener('change',()=>select(picker.value));toolbar.append(picker,controls);
 svg.addEventListener('pointerdown',event=>{if(event.button!==0)return;gesture={start:point(event,svg),pan:{...pan},moved:false};svg.setPointerCapture(event.pointerId);});
 svg.addEventListener('pointermove',event=>{if(!gesture||gesture.node)return;const p=point(event,svg);pan={x:gesture.pan.x+p.x-gesture.start.x,y:gesture.pan.y+p.y-gesture.start.y};draw();});svg.addEventListener('pointerup',()=>gesture=null);svg.addEventListener('pointercancel',()=>gesture=null);
 svg.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.003),point(event,svg));},{passive:false});
 svg.addEventListener('keydown',event=>{if(event.target!==svg)return;const keys={ArrowLeft:[35,0],ArrowRight:[-35,0],ArrowUp:[0,35],ArrowDown:[0,-35]};if(keys[event.key]){event.preventDefault();pan.x+=keys[event.key][0];pan.y+=keys[event.key][1];draw();}if(event.key==='+'||event.key==='='){event.preventDefault();zoom(1.25);}if(event.key==='-'){event.preventDefault();zoom(.8);}});
 canvas.append(svg,el('p','connections-hint','Drag to move · Scroll to zoom · Select a character'));const body=el('div','connections-body');body.append(canvas,details);root.append(toolbar,body);select(focusId);return root;
}
