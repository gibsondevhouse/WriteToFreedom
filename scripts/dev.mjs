import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import {dirname} from 'node:path';
import { d1Adapter } from './sqlite-adapter.mjs';
import { migrateDatabase } from './migrate.mjs';
import worker from '../dist/server/index.js';
const port=Number(process.env.PORT||4173);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be between 1 and 65535.');
const localHosts=new Set([`localhost:${port}`,`127.0.0.1:${port}`,...(port===80?['localhost','127.0.0.1']:[])]);
const requestOrigin=host=>localHosts.has(String(host||'').toLowerCase())?'http://'+host:'http://127.0.0.1:'+port;
const databasePath=process.env.WTF_DATABASE_PATH||'.sites-runtime/development.sqlite';
await mkdir(dirname(databasePath),{recursive:true});
const sqlite=new DatabaseSync(databasePath);
await migrateDatabase(sqlite);
const env={DB:d1Adapter(sqlite)};
const server=createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);headers.set('oai-authenticated-user-id','local-development-author');const body=Buffer.concat(chunks);const request=new Request(requestOrigin(req.headers.host)+req.url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body})});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){res.writeHead(500);res.end(error.message);}}).listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
// Tests use their own database and can stop the server without leaving it open.
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>{sqlite.close();process.exit(0);}));
