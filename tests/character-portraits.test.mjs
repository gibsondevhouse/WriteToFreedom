import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';

const origin='https://novel.example';
const pngSignature=Uint8Array.from([137,80,78,71,13,10,26,10]);

function setup(){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({}),env={DB:d1Adapter(sqlite)};
 return async(path,{method='GET',body,owner='author-a',source=origin,type='application/json'}={})=>{
  const headers=new Headers();if(owner)headers.set('oai-authenticated-user-id',owner);
  if(body!==undefined){headers.set('origin',source);headers.set('content-type',type);}
  const bytes=body===undefined?undefined:body instanceof Uint8Array||body instanceof ReadableStream?body:JSON.stringify(body);
  return worker.fetch(new Request(origin+path,{method,headers,...(bytes===undefined?{}:{body:bytes}),...(bytes instanceof ReadableStream?{duplex:'half'}:{})}),env);
 };
}

test('portrait upload is durable, owner-scoped, and usable by the character save',async()=>{
 const request=setup(),id=crypto.randomUUID();
 const created=await (await request('/api/characters',{method:'POST',body:{id}})).json();
 const image=new Uint8Array(2*1024*1024);image.set(pngSignature);image[image.length-1]=37;
 const upload=await request('/api/characters/'+id+'/portraits',{method:'POST',body:image,type:'image/png'});
 assert.equal(upload.status,201);const {url}=await upload.json();
 assert.match(url,new RegExp('^/api/characters/'+id+'/portraits/[0-9a-f-]{36}$'));
 const fetched=await request(url);assert.equal(fetched.status,200);
 assert.equal(fetched.headers.get('content-type'),'image/png');
 assert.equal(fetched.headers.get('cache-control'),'private, no-store');
 assert.equal(fetched.headers.get('content-length'),String(image.length));
 assert.deepEqual(new Uint8Array(await fetched.arrayBuffer()),image);
 const head=await request(url,{method:'HEAD'});assert.equal(head.status,200);
 assert.equal(head.headers.get('content-length'),String(image.length));assert.equal((await head.arrayBuffer()).byteLength,0);
 assert.equal((await request(url,{owner:'author-b'})).status,404);
 assert.equal((await request(url,{owner:null})).status,401);
 const saved=await request('/api/characters/'+id,{method:'PUT',body:{...created,portraitUrl:url}});
 assert.equal(saved.status,200);assert.equal((await saved.json()).portraitUrl,url);
 assert.equal((await (await request('/api/characters/'+id)).json()).portraitUrl,url);
});

test('portrait upload rejects invalid files and cross-character references',async()=>{
 const request=setup(),first=crypto.randomUUID(),second=crypto.randomUUID();
 const firstRecord=await (await request('/api/characters',{method:'POST',body:{id:first}})).json();
 const secondRecord=await (await request('/api/characters',{method:'POST',body:{id:second}})).json();
 const image=Uint8Array.from([...pngSignature,1,2,3,4]);
 assert.equal((await request('/api/characters/'+first+'/portraits',{method:'POST',body:image,type:'image/jpeg'})).status,400);
 assert.equal((await request('/api/characters/'+first+'/portraits',{method:'POST',body:image,type:'image/svg+xml'})).status,415);
 assert.equal((await request('/api/characters/'+first+'/portraits',{method:'POST',body:image,type:'image/png',source:'https://other.example'})).status,403);
 assert.equal((await request('/api/characters/'+crypto.randomUUID()+'/portraits',{method:'POST',body:image,type:'image/png'})).status,404);
 const tooLarge=new Uint8Array(2*1024*1024+1);tooLarge.set(pngSignature);
 assert.equal((await request('/api/characters/'+first+'/portraits',{method:'POST',body:tooLarge,type:'image/png'})).status,413);
 let canceled=false,pulls=0;
 const oversizedStream=new ReadableStream({
  pull(controller){pulls++;controller.enqueue(pulls===1?pngSignature:new Uint8Array(2*1024*1024));},
  cancel(){canceled=true;}
 },{highWaterMark:0});
 assert.equal((await request('/api/characters/'+first+'/portraits',{method:'POST',body:oversizedStream,type:'image/png'})).status,413);
 assert.equal(canceled,true,'the upload stream is canceled once it exceeds the limit');
 const url=(await (await request('/api/characters/'+first+'/portraits',{method:'POST',body:image,type:'image/png'})).json()).url;
 assert.equal((await request('/api/characters/'+second,{method:'PUT',body:{...secondRecord,portraitUrl:url}})).status,400);
 assert.equal((await request('/api/characters/'+first,{method:'PUT',body:{...firstRecord,portraitUrl:'/api/characters/'+first+'/portraits/'+crypto.randomUUID()}})).status,400);
 assert.equal((await request('/api/characters/'+first,{method:'PUT',body:{...firstRecord,portraitUrl:'https://example.org/portrait.png'}})).status,200);
 assert.equal((await request(url,{owner:'author-b'})).status,404);
});

test('sample characters can upload private portraits without creating a draft first',async()=>{
 const request=setup(),sample=await (await request('/api/characters/claude')).json();
 const image=Uint8Array.from([...pngSignature,7,8]);
 const upload=await request('/api/characters/claude/portraits',{method:'POST',body:image,type:'image/png'});
 assert.equal(upload.status,201);const {url}=await upload.json();
 assert.deepEqual(new Uint8Array(await (await request(url)).arrayBuffer()),image);
 const saved=await request('/api/characters/claude',{method:'PUT',body:{...sample,portraitUrl:url}});
 assert.equal(saved.status,200);assert.equal((await saved.json()).portraitUrl,url);
 assert.equal((await request(url,{owner:'author-b'})).status,404);
});
