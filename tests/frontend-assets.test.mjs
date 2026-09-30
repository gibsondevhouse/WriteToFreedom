import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectAssets} from '../scripts/collect-assets.mjs';
import {stampAssets} from '../scripts/asset-revision.mjs';
import {frontendAssets} from '../server/frontend-assets.js';
import {createWorker} from '../server/app.js';
import {workspaceShell} from '../server/workspace-shell.js';

test('manifest renders nested shared styles and chunks once, leaving lazy entries lazy',()=>{
 const manifest={
  'frontend/lore-profile.tsx':{isEntry:true,file:'assets/lore-123.js',css:['assets/lore-123.css'],imports:['_shared','_other'],dynamicImports:['lazy']},
  _shared:{file:'assets/shared-123.js',css:['assets/shared-123.css'],imports:['_base']},
  _other:{file:'assets/other-123.js',imports:['_base']},
  _base:{file:'assets/base-123.js',css:['assets/shared-123.css']},
  lazy:{file:'assets/lazy-123.js'},
 };
 const html=frontendAssets('frontend/lore-profile.tsx',manifest);
 for(const file of ['lore-123.js','lore-123.css','shared-123.js','shared-123.css','other-123.js','base-123.js'])assert.equal(html.split('/frontend/assets/'+file).length-1,1,file);
 assert.doesNotMatch(html,/lazy-123/);
 assert.match(html,/<script type="module" src="\/frontend\/assets\/lore-123.js"><\/script>/);
 const document=workspaceShell('<html><head>'+html+'</head><body></body></html>','/lore/example/');
 assert.ok(document.includes(html),'workspace decoration preserves manifest URLs so preloads match module imports');
 assert.throws(()=>frontendAssets('missing',manifest),/Missing frontend entry/);
 assert.throws(()=>frontendAssets('entry',{entry:{isEntry:true,file:'../escape.js'}}),/Invalid frontend asset path/);
 assert.throws(()=>frontendAssets('entry',{entry:{isEntry:true,file:'assets/app.js',imports:['missing']}}),/Missing frontend chunk/);
});

test('embedded assets preserve binary bytes and MIME types through the Worker, including HEAD',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'wtf-assets-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const png=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0xff,0x80]);
 const font=Buffer.from([0x77,0x4f,0x46,0x32,0x00,0xfe]);
 await mkdir(join(directory,'.vite'));
 await mkdir(join(directory,'assets'));
 await Promise.all([
  writeFile(join(directory,'assets','photo.png'),png),
  writeFile(join(directory,'assets','font.woff2'),font),
  writeFile(join(directory,'assets','entry.js'),'export const title="Freedom — ✍";'),
  writeFile(join(directory,'.vite','manifest.json'),'{}'),
  writeFile(join(directory,'.secret'),'not public'),
 ]);
 const assets=await collectAssets(directory,'/frontend');
 assert.equal(Object.keys(assets).length,3);
 const stamped=stampAssets(assets,'revision');
 assert.deepEqual(stamped['/frontend/assets/photo.png'],assets['/frontend/assets/photo.png']);
 const worker=createWorker(stamped);
 for(const [file,bytes,type] of [['photo.png',png,'image/png'],['font.woff2',font,'font/woff2']]){
  const url='https://example.test/frontend/assets/'+file;
  const response=await worker.fetch(new Request(url),{});
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),type);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  const head=await worker.fetch(new Request(url,{method:'HEAD'}),{});
  assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(head.headers.get('content-type'),type);
 }
 const script=await worker.fetch(new Request('https://example.test/frontend/assets/entry.js'),{});
 assert.match(script.headers.get('content-type'),/text\/javascript/);
 assert.equal(await script.text(),'export const title="Freedom — ✍";');
 assert.equal((await worker.fetch(new Request('https://example.test/frontend/.vite/manifest.json'),{})).status,404);
});

test('binary assets decode once per Worker instance and HEAD stays lazy',async t=>{
 const bytes=Buffer.from([0x89,0x50,0x4e,0x47,0x00,0xff]),assets={'/photo.png':{content:bytes.toString('base64'),type:'image/png',encoding:'base64'}};
 const decode=t.mock.method(globalThis,'atob'),worker=createWorker(assets),url='https://example.test/photo.png';
 const head=await worker.fetch(new Request(url,{method:'HEAD'}),{});
 assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(decode.mock.callCount(),0);
 for(let attempt=0;attempt<2;attempt++){
  const response=await worker.fetch(new Request(url),{});
  const returned=new Uint8Array(await response.arrayBuffer());assert.deepEqual(Buffer.from(returned),bytes);returned[0]=0;
 }
 assert.equal(decode.mock.callCount(),1);
 assert.deepEqual(Buffer.from(await (await createWorker(assets).fetch(new Request(url),{})).arrayBuffer()),bytes);assert.equal(decode.mock.callCount(),2);
});

test('fingerprinted frontend responses cache immutably without caching HTML',async()=>{
 const worker=createWorker({
  '/frontend/assets/entry-12345678.js':{content:'export const ready=true;',type:'text/javascript; charset=utf-8'},
  '/frontend/assets/entry.js':{content:'export const ready=true;',type:'text/javascript; charset=utf-8'},
  '/example/index.html':{content:'<html><head></head><body>Example</body></html>',type:'text/html; charset=utf-8'},
 });
 for(const method of ['GET','HEAD']){
  for(const [path,cache] of [['/frontend/assets/entry-12345678.js','public, max-age=31536000, immutable'],['/frontend/assets/entry.js','no-cache'],['/example/?v=12345678','no-cache']]){
   const response=await worker.fetch(new Request('https://example.test'+path,{method}),{});
   assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),cache,path);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
   if(method==='HEAD')assert.equal(await response.text(),'');
  }
 }
});
