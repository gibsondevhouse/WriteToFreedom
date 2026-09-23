// Build one undirected edge per real connection, retaining its directional details.
export function connectionGraph(characters,focusId){
 const byId=new Map(characters.map(record=>[record.id,record])),edges=new Map();
 for(const record of characters)for(const relationship of record.relationships||[]){
  if(record.id===relationship.id||!byId.has(relationship.id))continue;
  const pair=[record.id,relationship.id].sort(),key=JSON.stringify(pair);
  if(!edges.has(key))edges.set(key,{source:pair[0],target:pair[1],connections:[]});
  for(const detail of relationship.connections||[]){
   const from=detail.direction==='incoming'?relationship.id:record.id,to=detail.direction==='incoming'?record.id:relationship.id;
   const connection={from,to,type:detail.type||'Connection',description:detail.description||''};
   const list=edges.get(key).connections;
   if(!list.some(item=>JSON.stringify(item)===JSON.stringify(connection)))list.push(connection);
  }
 }
 const reached=new Set(byId.has(focusId)?[focusId]:[]),queue=[...reached];
 for(let i=0;i<queue.length;i++)for(const edge of edges.values()){
  const next=edge.source===queue[i]?edge.target:edge.target===queue[i]?edge.source:null;
  if(next&&!reached.has(next)){reached.add(next);queue.push(next);}
 }
 return {nodes:characters.filter(record=>reached.has(record.id)).map(record=>({id:record.id,name:record.name,href:record.href})),edges:[...edges.values()].filter(edge=>reached.has(edge.source)&&reached.has(edge.target))};
}
export function layoutConnections(graph,focusId){
 const nodes=graph.nodes.map((record,index)=>({...record,x:record.id===focusId?450:450+Math.cos(index*2.39996)*190,y:record.id===focusId?280:280+Math.sin(index*2.39996)*190}));
 const byId=new Map(nodes.map(node=>[node.id,node]));
 for(let step=0;step<180;step++){
  const forces=new Map(nodes.map(node=>[node.id,{x:0,y:0}]));
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   const a=nodes[i],b=nodes[j],dx=a.x-b.x,dy=a.y-b.y,d2=Math.max(100,dx*dx+dy*dy),distance=Math.sqrt(d2),force=6500/d2;
   forces.get(a.id).x+=dx/distance*force;forces.get(a.id).y+=dy/distance*force;forces.get(b.id).x-=dx/distance*force;forces.get(b.id).y-=dy/distance*force;
  }
  for(const edge of graph.edges){const a=byId.get(edge.source),b=byId.get(edge.target);if(!a||!b)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),force=(d-125)*.025;forces.get(a.id).x+=dx/d*force;forces.get(a.id).y+=dy/d*force;forces.get(b.id).x-=dx/d*force;forces.get(b.id).y-=dy/d*force;}
  for(const node of nodes){if(node.id===focusId)continue;const force=forces.get(node.id),cooling=1-step/220;node.x=Math.max(65,Math.min(835,node.x+(force.x+(450-node.x)*.005)*cooling));node.y=Math.max(55,Math.min(505,node.y+(force.y+(280-node.y)*.005)*cooling));}
 }
 return {...graph,nodes};
}
