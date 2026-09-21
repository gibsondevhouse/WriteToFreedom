import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readdir,readFile,mkdir } from 'node:fs/promises';
import { d1Adapter } from './sqlite-adapter.mjs';
import worker from '../dist/server/index.js';
await mkdir('.sites-runtime',{recursive:true});
const sqlite=new DatabaseSync('.sites-runtime/development.sqlite');
sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const file of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort()){
 if(!sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(file)){sqlite.exec(await readFile('drizzle/'+file,'utf8'));sqlite.prepare('INSERT INTO local_migrations(name) VALUES(?)').run(file);}
}
const env={DB:d1Adapter(sqlite)};
createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);headers.set('oai-authenticated-user-id','local-development-author');const body=Buffer.concat(chunks);const request=new Request('http://127.0.0.1:4173'+req.url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body})});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){res.writeHead(500);res.end(error.message);}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
