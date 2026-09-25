// Replaced by the Worker build. Source-level API tests need no browser bundle.
const builtManifest = typeof __WTF_FRONTEND_MANIFEST__ === 'undefined' ? null : __WTF_FRONTEND_MANIFEST__;

function assetPath(file) {
 if(typeof file!=='string'||!file||file.startsWith('/')||file.split('/').some(part=>part==='..')||/["'<>?#\\]/.test(file))throw new Error('Invalid frontend asset path.');
 return '/frontend/'+file;
}

/** Render manifest-owned CSS and transitive module preloads for a browser entry. */
export function frontendAssets(entry,manifest=builtManifest){
 if(!manifest)return '';
 const root=manifest[entry];if(!root||!root.isEntry)throw new Error('Missing frontend entry: '+entry);
 const styles=new Set(),preloads=new Set(),visited=new Set();
 function visit(key){
  if(visited.has(key))return;visited.add(key);
  const chunk=manifest[key];if(!chunk)throw new Error('Missing frontend chunk: '+key);
  for(const css of chunk.css||[])styles.add(assetPath(css));
  for(const dependency of chunk.imports||[]){visit(dependency);preloads.add(assetPath(manifest[dependency].file));}
 }
 visit(entry);preloads.delete(assetPath(root.file));
 return [...styles].map(href=>`<link rel="stylesheet" href="${href}">`).join('')+
  [...preloads].map(href=>`<link rel="modulepreload" href="${href}">`).join('')+
  `<script type="module" src="${assetPath(root.file)}"></script>`;
}
