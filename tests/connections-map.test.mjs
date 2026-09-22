import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionGraph,layoutConnections} from '../public/dashboard/connections-model.js';
const outgoing=(id,type='Ally')=>({id,connections:[{type,description:'Shared history',direction:'outgoing'}]});
const incoming=(id,type='Ally')=>({id,connections:[{type,description:'Shared history',direction:'incoming'}]});
const cast=[
 {id:'a',name:'A',href:'/characters/a/',relationships:[outgoing('b'),outgoing('c','Rival')]},
 {id:'b',name:'B',href:'/characters/b/',relationships:[incoming('a'),outgoing('c'),outgoing('d')]},
 {id:'c',name:'C',href:'/characters/c/',relationships:[incoming('a','Rival'),incoming('b')]},
 {id:'d',name:'D',href:'/characters/d/',relationships:[incoming('b')]},
 {id:'isolated',name:'E',href:'/characters/e/',relationships:[]},
];
test('connections map includes the real connected component, including links between neighbors',()=>{
 const graph=connectionGraph(cast,'a');assert.deepEqual(graph.nodes.map(n=>n.id),['a','b','c','d']);assert.equal(graph.edges.length,4);
 assert.ok(graph.edges.some(e=>e.source==='b'&&e.target==='c'));
 assert.equal(graph.edges.find(e=>e.source==='a'&&e.target==='b').connections.length,1,'reciprocal API descriptions are deduplicated');
 assert.deepEqual(graph.edges.find(e=>e.source==='a'&&e.target==='c').connections[0],{from:'a',to:'c',type:'Rival',description:'Shared history'});
});
test('missing targets and isolated characters never acquire invented links',()=>{
 const graph=connectionGraph([{id:'a',name:'A',relationships:[outgoing('missing'),outgoing('a')]}],'a');assert.equal(graph.edges.length,0);assert.equal(graph.nodes.length,1);
 assert.equal(connectionGraph(cast,'isolated').nodes.length,1);assert.deepEqual(connectionGraph(cast,'unknown'),{nodes:[],edges:[]});
});
test('graph layout is finite, deterministic and keeps the focal character centered',()=>{
 const graph=connectionGraph(cast,'a'),layout=layoutConnections(graph,'a');assert.deepEqual(layout,layoutConnections(graph,'a'));
 assert.equal(layout.nodes[0].x,450);assert.equal(layout.nodes[0].y,280);
 for(const node of layout.nodes){assert.ok(Number.isFinite(node.x)&&Number.isFinite(node.y));assert.ok(node.x>=65&&node.x<=835);assert.ok(node.y>=55&&node.y<=505);}
 for(let i=0;i<layout.nodes.length;i++)for(let j=i+1;j<layout.nodes.length;j++)assert.ok(Math.hypot(layout.nodes[i].x-layout.nodes[j].x,layout.nodes[i].y-layout.nodes[j].y)>35,'nodes remain distinguishable');
 assert.deepEqual(layoutConnections({nodes:[],edges:[]},'missing'),{nodes:[],edges:[]});
});
