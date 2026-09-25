import test from 'node:test';
import assert from 'node:assert/strict';
import {announceWorkspaceChange,observeWorkspaceChanges,workspaceChangeStorageKey} from '../public/profiles/workspace-events.js';

test('saved workspace changes reach the current document and other same-origin tabs',()=>{
 const previousWindow=globalThis.window,previousStorage=globalThis.localStorage,listeners=new Map(),writes=[];
 globalThis.window={
  addEventListener(type,handler){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(handler);},
  removeEventListener(type,handler){listeners.get(type)?.delete(handler);},
  dispatchEvent(event){for(const handler of listeners.get(event.type)||[])handler(event);return true;}
 };
 globalThis.localStorage={setItem(key,value){writes.push([key,value]);}};
 try{
  let changes=0;const stop=observeWorkspaceChanges(()=>changes++);
  announceWorkspaceChange();assert.equal(changes,1);assert.equal(writes.length,1);assert.equal(writes[0][0],workspaceChangeStorageKey);
  window.dispatchEvent({type:'storage',key:'unrelated'});assert.equal(changes,1);
  window.dispatchEvent({type:'storage',key:workspaceChangeStorageKey});assert.equal(changes,2);
  stop();announceWorkspaceChange();window.dispatchEvent({type:'storage',key:workspaceChangeStorageKey});assert.equal(changes,2);
 }finally{globalThis.window=previousWindow;globalThis.localStorage=previousStorage;}
});
