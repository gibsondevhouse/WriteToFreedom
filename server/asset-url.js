const revision=typeof __WTF_ASSET_REVISION__==='string'?__WTF_ASSET_REVISION__:'dev';

/** Give every server-authored asset URL the same build identity. */
export function assetUrl(path){
 if(typeof path!=='string'||!/^\/(?!\/)/.test(path))throw new Error('Asset URLs must be local absolute paths.');
 const url=new URL(path,'https://assets.invalid');
 url.searchParams.set('v',revision);
 return url.pathname+url.search+url.hash;
}

export const assetRevision=revision;
