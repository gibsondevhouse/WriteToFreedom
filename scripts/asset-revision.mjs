import {createHash} from 'node:crypto';

export const ASSET_REVISION_PLACEHOLDER='__WTF_ASSET_REVISION__';

export function revisionForAssets(assets){
 const hash=createHash('sha256');
 for(const path of Object.keys(assets).sort()){
  hash.update(path);hash.update('\0');hash.update(String(assets[path].content));hash.update('\0');
 }
 return hash.digest('hex').slice(0,12);
}

function revisioned(specifier,revision){
 if(!specifier.startsWith('.')&&!/^\/(?!\/)/.test(specifier))return specifier;
 const hashIndex=specifier.indexOf('#'),hash=hashIndex<0?'':specifier.slice(hashIndex),withoutHash=hashIndex<0?specifier:specifier.slice(0,hashIndex);
 const queryIndex=withoutHash.indexOf('?'),pathname=queryIndex<0?withoutHash:withoutHash.slice(0,queryIndex),params=new URLSearchParams(queryIndex<0?'':withoutHash.slice(queryIndex+1));
 params.set('v',revision);return pathname+'?'+params+hash;
}

export function stampAssets(assets,revision=revisionForAssets(assets)){
 return Object.fromEntries(Object.entries(assets).map(([path,asset])=>{
  if(typeof asset.content!=='string'||asset.encoding==='base64')return [path,asset];
  let content=asset.content.replaceAll(ASSET_REVISION_PLACEHOLDER,revision);
  if(path.endsWith('.js'))content=content.replace(/((?:\bfrom\s*|\bimport\s*)['"])([^'"]+)(['"])/g,(_,open,specifier,close)=>open+revisioned(specifier,revision)+close);
  if(path.endsWith('.css'))content=content.replace(/(@import\s+url\(["']?)([^"')]+)(["']?\))/g,(_,open,specifier,close)=>open+revisioned(specifier,revision)+close);
  return [path,{...asset,content}];
 }));
}
