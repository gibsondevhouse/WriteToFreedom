export function hiddenFieldNames(sections){return sections.filter(s=>!['identity','symbols'].includes(s.id)).flatMap(s=>s.fields.map(f=>f[0]));}
export function readHiddenFields(input,current,allowed){
 const hidden=Object.hasOwn(input,'hiddenFields')?input.hiddenFields:current.hiddenFields||[];
 if(!Array.isArray(hidden)||hidden.length>allowed.length||hidden.some(key=>!allowed.includes(key)))return null;
 return [...new Set(hidden)];
}
