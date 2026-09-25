import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function node(tag='div'){
 const handlers=new Map();
 return {tagName:tag.toUpperCase(),className:'',textContent:'',children:[],attrs:{},disabled:false,scrollLeft:0,clientWidth:0,scrollWidth:0,
  append(...items){this.children.push(...items);},setAttribute(key,value){this.attrs[key]=value;},
  addEventListener(type,fn){if(!handlers.has(type))handlers.set(type,new Set());handlers.get(type).add(fn);},
  removeEventListener(type,fn){handlers.get(type)?.delete(fn);},dispatch(type,event={}){for(const fn of handlers.get(type)||[])fn(event);},
  scrollBy(options){this.lastScroll=options.left;},get firstElementChild(){return this.children[0]||null;},
  getBoundingClientRect(){return {left:0,right:this.clientWidth,width:this.clientWidth};}
 };
}
function session(){
 let frame;
 class ResizeObserver{constructor(fn){this.fn=fn;}observe(){}disconnect(){}}
 const document={createElement:tag=>node(tag),createElementNS:tag=>node(tag),documentElement:{lang:'en'}};
 const context=vm.createContext({document,URL,ResizeObserver,getComputedStyle:()=>({gap:'16px'}),requestAnimationFrame(fn){frame=fn;return 1;},cancelAnimationFrame(){}});
 const source=readFileSync('public/dashboard/components.js','utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,'');
 vm.runInContext(source+'\nglobalThis.makeRails=createRails;',context);
 return {makeRails:context.makeRails,runFrame:()=>frame()};
}

test('rail controls start disabled and page to real card boundaries',()=>{
 const {makeRails,runFrame}=session(),rails=makeRails({idPrefix:'test'});
 const section=rails.rail('Factions',[1,2,3,4],()=>node('a'));
 const header=section.children[0],actions=header.children[1],[prev,next]=actions.children,list=section.children[1];
 assert.equal(prev.disabled,true);assert.equal(next.disabled,true);
 list.clientWidth=620;list.scrollWidth=1264;list.getBoundingClientRect=()=>({left:0,right:620,width:620});
 list.children.forEach((item,index)=>{item.getBoundingClientRect=()=>({left:index*316-list.scrollLeft,right:index*316-list.scrollLeft+300,width:300});});
 runFrame();assert.equal(prev.disabled,true);assert.equal(next.disabled,false);
 next.dispatch('click');assert.equal(list.lastScroll,632);
 list.scrollLeft=632;list.dispatch('scroll');assert.equal(prev.disabled,false);assert.equal(next.disabled,false);
 prev.dispatch('click');assert.equal(list.lastScroll,-632);
 list.scrollLeft=644;list.dispatch('scroll');assert.equal(next.disabled,true);
 rails.destroy();
});
