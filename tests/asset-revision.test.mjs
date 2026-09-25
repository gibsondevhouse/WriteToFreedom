import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ASSET_REVISION_PLACEHOLDER,revisionForAssets,stampAssets} from '../scripts/asset-revision.mjs';
import {assetUrl} from '../server/asset-url.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

test('one content revision identifies and stamps a complete asset build',()=>{
 const first={'/b.js':{content:'import "./a.js"; import {c} from "./c.js?v=old"',type:'text/javascript'},'/a.js':{content:'export default 1',type:'text/javascript'},'/theme.css':{content:'@import url("./base.css?v='+ASSET_REVISION_PLACEHOLDER+'");',type:'text/css'}};
 const reordered={'/theme.css':first['/theme.css'],'/a.js':first['/a.js'],'/b.js':first['/b.js']};
 const revision=revisionForAssets(first);
 assert.equal(revision,revisionForAssets(reordered));
 assert.notEqual(revision,revisionForAssets({...first,'/a.js':{...first['/a.js'],content:'export default 2'}}));
 const stamped=stampAssets(first,revision);
 assert.equal((stamped['/b.js'].content.match(new RegExp(`v=${revision}`,'g'))||[]).length,2);
 assert.ok(stamped['/theme.css'].content.includes(`?v=${revision}`));
 assert.ok(Object.values(stamped).every(asset=>!asset.content.includes(ASSET_REVISION_PLACEHOLDER)));
 assert.match(assetUrl('/dashboard/shell.css'),/^\/dashboard\/shell\.css\?v=dev$/);
});

test('the complete Home and Lore dependency graph shares the build revision',()=>{
 const starts=['public/dashboard/dashboard.js','public/lore/dashboard.js','public/dashboard/shell.css'];
 const visited=new Set(),legacy=/species-cards-1|collection-order-1|shell-2|shared-1/;
 function visit(relative){
  const file=resolve(root,relative);if(visited.has(file))return;visited.add(file);
  const source=readFileSync(file,'utf8');assert.doesNotMatch(source,legacy,relative);
  const specs=[];
  if(relative.endsWith('.css'))for(const match of source.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)/g))specs.push(match[1]);
  else for(const match of source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g))specs.push(match[1]);
  for(const spec of specs){
   if(!spec.startsWith('.')&&!spec.startsWith('/'))continue;
   assert.ok(spec.endsWith(`?v=${ASSET_REVISION_PLACEHOLDER}`),`${relative} must revision ${spec}`);
   const pathname=spec.split('?',1)[0];
   const child=pathname.startsWith('/')?'public'+pathname:resolve(dirname(relative),pathname);
   visit(child);
  }
 }
 starts.forEach(visit);assert.ok(visited.size>15,'walked the nested dependency graph');
});

test('question transitions stay contained and short',()=>{
 const css=readFileSync(resolve(root,'public/dashboard/shell.css'),'utf8');
 const js=readFileSync(resolve(root,'public/dashboard/question-banner.js'),'utf8');
 assert.match(css,/\.dashboard-shell \.question-banner\s*\{[\s\S]*grid-template-rows:minmax\(0,1fr\) auto/);
 assert.match(css,/@media\(max-width:420px\)[\s\S]*grid-template-columns:1fr/);
 assert.doesNotMatch(js,/translateY\(100%\)|duration:1100/);
 assert.match(js,/duration:220/);assert.match(js,/duration:360/);
});
