import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { build as buildFrontend } from 'vite';
import {collectAssets} from './collect-assets.mjs';
import {revisionForAssets,stampAssets} from './asset-revision.mjs';
await buildFrontend();
const manifest=JSON.parse(await readFile('dist/client/.vite/manifest.json','utf8'));
const [legacyAssets,frontendAssets]=await Promise.all([collectAssets('public'),collectAssets('dist/client','/frontend')]);
if(Object.keys(legacyAssets).some(path=>path.startsWith('/frontend/')))throw new Error('The /frontend/ asset prefix belongs to Vite.');
const assets={...legacyAssets,...frontendAssets};
await mkdir('.sites-runtime',{recursive:true});
const revision=revisionForAssets(assets);
// Vite owns its content hashes/imports. Only legacy sources need revision stamping.
const stampedAssets={...stampAssets(legacyAssets,revision),...frontendAssets};
await writeFile('.sites-runtime/entry.mjs',`import {createWorker} from '../server/app.js'; export default createWorker(${JSON.stringify(stampedAssets)});`);
await build({entryPoints:['.sites-runtime/entry.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js',define:{__WTF_ASSET_REVISION__:JSON.stringify(revision),__WTF_FRONTEND_MANIFEST__:JSON.stringify(manifest)}});
console.log(`Built Worker with ${Object.keys(assets).length} assets.`);
