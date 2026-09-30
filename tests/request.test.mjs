import test from 'node:test';
import assert from 'node:assert/strict';
import {requestJSON} from '../public/profiles/request.js';

test('shared JSON requests retain same-origin credentials, fresh reads and cancellation',async t=>{
 const controller=new AbortController(),calls=[];
 t.mock.method(globalThis,'fetch',async(path,options)=>{
  calls.push({path,options});
  return new Response('{"version":2}',{headers:{'content-type':'Application/JSON; charset=utf-8'}});
 });
 const options={method:'PUT',headers:{'content-type':'application/json'},body:'{"version":1}',signal:controller.signal};
 assert.deepEqual(await requestJSON('/api/example',options),{version:2});
 assert.equal(calls[0].path,'/api/example');assert.equal(calls[0].options.credentials,'same-origin');assert.equal(calls[0].options.cache,'no-store');
 for(const key of Object.keys(options))assert.equal(calls[0].options[key],options[key],key);
 assert.equal(Object.hasOwn(options,'credentials'),false);
});

test('empty successful responses need no JSON body or content type',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:204}));
 assert.equal(await requestJSON('/api/example',{method:'DELETE'}),null);
});

test('JSON failures retain server messages and HTTP status for conflict recovery',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('{"error":"Your draft is still here."}',{status:409,headers:{'content-type':'application/json'}}));
 await assert.rejects(requestJSON('/api/example'),error=>error.message==='Your draft is still here.'&&error.status===409);
});

test('invalid error envelopes use the caller fallback instead of crashing or leaking object text',async t=>{
 let payload;
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(payload),{status:503,headers:{'content-type':'application/json'}}));
 for(payload of [null,[],{}, {error:42},{error:{message:'Not a message'}},{error:''}])await assert.rejects(requestJSON('/api/example',{}, {errorMessage:'Keep this draft open.'}),error=>error.message==='Keep this draft open.'&&error.status===503);
});

test('HTML session responses and lookalike JSON types retain the caller session message',async t=>{
 let type;
 t.mock.method(globalThis,'fetch',async()=>new Response('<html>Sign in</html>',{headers:{'content-type':type}}));
 for(type of ['text/html','application/json-invalid','application/jsonp',''])await assert.rejects(requestJSON('/api/example',{}, {sessionMessage:'Keep your writing before signing in.'}),error=>error.message==='Keep your writing before signing in.'&&error.status===200);
});

test('network, cancellation and malformed JSON failures are not swallowed',async t=>{
 let failure=new Error('Network unavailable');
 t.mock.method(globalThis,'fetch',async()=>{throw failure;});
 await assert.rejects(requestJSON('/api/example'),error=>error===failure);
 failure=new DOMException('Request canceled','AbortError');
 await assert.rejects(requestJSON('/api/example'),error=>error===failure);
 t.mock.method(globalThis,'fetch',async()=>new Response('{',{headers:{'content-type':'application/json'}}));
 await assert.rejects(requestJSON('/api/example'),SyntaxError);
});