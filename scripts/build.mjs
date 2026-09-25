import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { build } from 'esbuild';
import {revisionForAssets,stampAssets} from './asset-revision.mjs';
const assets={};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
async function walk(path='') {for(const entry of await readdir('public'+path,{withFileTypes:true})){const next=path+'/'+entry.name;if(entry.isDirectory())await walk(next);else assets[next]={content:await readFile('public'+next,'utf8'),type:types[extname(next)]||'text/plain; charset=utf-8'};}}
await walk();await mkdir('.sites-runtime',{recursive:true});
const revision=revisionForAssets(assets),stampedAssets=stampAssets(assets,revision);
await writeFile('.sites-runtime/entry.mjs',`import {createWorker} from '../server/app.js'; export default createWorker(${JSON.stringify(stampedAssets)});`);
await build({entryPoints:['.sites-runtime/entry.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js',define:{__WTF_ASSET_REVISION__:JSON.stringify(revision)}});
console.log(`Built Worker with ${Object.keys(assets).length} assets.`);
