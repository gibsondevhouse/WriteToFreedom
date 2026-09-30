const revision=typeof __WTF_ASSET_REVISION__==='string'?__WTF_ASSET_REVISION__:'dev';

/** Give every server-authored asset URL the same build identity. */
export function assetUrl(path){
 if(typeof path!=='string'||!/^\/(?!\/)/.test(path))throw new Error('Asset URLs must be local absolute paths.');
 const url=new URL(path,'https://assets.invalid');
 url.searchParams.set('v',revision);
 return url.pathname+url.search+url.hash;
}

export function assetCacheControl(url,type,expectedRevision=revision){
 if(type.split(';',1)[0].trim().toLowerCase()==='text/html')return 'no-cache';
 const versioned=expectedRevision!=='dev'&&url.searchParams.get('v')===expectedRevision;
 const fingerprinted=/^\/frontend\/assets\/[^/]+-[a-z0-9_-]{8}\.(?:js|css)$/i.test(url.pathname);
 return versioned||fingerprinted?'public, max-age=31536000, immutable':'no-cache';
}
