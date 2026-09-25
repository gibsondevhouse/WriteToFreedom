/** Version 1 is a bounded Tiptap/ProseMirror JSON document, never stored HTML. */
export const writingContentSchemaVersion=1;
export const writingContentLimits=Object.freeze({bytes:1048576,text:200000,depth:30,nodes:20000});
export const writingRequestMaxBytes=writingContentLimits.bytes+32768;
const blockTypes=new Set(['paragraph','heading','bulletList','orderedList','blockquote','horizontalRule']);
const inlineTypes=new Set(['text','hardBreak']);
const markTypes=new Set(['bold','italic','strike','underline','code']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>{throw new Error(message);};
function keys(value,allowed){for(const key of Object.keys(value))if(!allowed.includes(key))fail('This writing document contains unsupported properties.');}
export function emptyWritingContent(){return {type:'doc',content:[{type:'paragraph'}]};}

/**
 * Validate structure before persistence so an editor cannot silently discard
 * unsupported content. Returns fresh, allowlisted JSON; never mutates a draft.
 */
export function validateWritingContent(input){
 let count=0,length=0;
 const ancestors=new Set();
 function marks(input){
  if(!Array.isArray(input))fail('Writing marks must be a list.');
  const seen=new Set();
  const result=input.map(mark=>{
   if(!object(mark)||!markTypes.has(mark.type))fail('This writing document contains unsupported formatting.');
   keys(mark,['type','attrs']);
   if(mark.attrs!==undefined){if(!object(mark.attrs)||Object.keys(mark.attrs).length)fail('This writing document contains unsupported formatting attributes.');}
   if(seen.has(mark.type))fail('Each writing format may appear only once per text run.');seen.add(mark.type);
   return {type:mark.type};
  });
  // ProseMirror's code mark excludes every other mark. Reject the unsupported
  // combination instead of allowing its editor normalization to lose a format.
  if(seen.has('code')&&result.length>1)fail('Inline code cannot be combined with other formatting.');
  return result;
 }
 function node(value,depth,parent){
  if(depth>writingContentLimits.depth)fail('Keep writing document nesting within 30 levels.');
  if(++count>writingContentLimits.nodes)fail('This writing document contains too many elements.');
  if(!object(value)||typeof value.type!=='string')fail('Choose a supported writing document.');
  if(ancestors.has(value))fail('Writing documents cannot contain circular references.');
  ancestors.add(value);
  const {type}=value;
  if(parent===null?type!=='doc':parent==='doc'||parent==='blockquote'? !blockTypes.has(type):parent==='listItem'? !blockTypes.has(type):parent==='bulletList'||parent==='orderedList'?type!=='listItem':!inlineTypes.has(type))fail('This writing document contains an unsupported element or nesting.');
  keys(value,type==='text'?['type','text','marks']:['type','content','attrs',...(type==='hardBreak'?['marks']:[])]);
  const result={type};
  if(type==='text'){
   if(typeof value.text!=='string'||!value.text.length)fail('Writing text runs must contain text.');
   length+=value.text.length;if(length>writingContentLimits.text)fail('Keep scene writing within 200,000 characters.');
   result.text=value.text;
   if(value.marks!==undefined){const clean=marks(value.marks);if(clean.length)result.marks=clean;}
  }else{
   if(value.attrs!==undefined&&!object(value.attrs))fail('Writing element attributes must be an object.');
   if(type==='heading'){
    const attrs=value.attrs||{};keys(attrs,['level']);const level=attrs.level??1;
    if(!Number.isInteger(level)||level<1||level>3)fail('Use heading levels 1 through 3.');result.attrs={level};
   }else if(type==='orderedList'){
    const attrs=value.attrs||{};keys(attrs,['start','type']);const start=attrs.start??1;
    if(!Number.isSafeInteger(start)||start<1)fail('Ordered lists must start with a positive whole number.');
    // StarterKit includes a null type by default and preserves standard HTML
    // list styles when pasting. All other attributes remain outside the schema.
    if(attrs.type!==undefined&&attrs.type!==null&&!['1','a','A','i','I'].includes(attrs.type))fail('Choose a supported ordered-list style.');
    result.attrs={start,type:attrs.type??null};
   }else if(value.attrs!==undefined&&Object.keys(value.attrs).length)fail('This writing element has unsupported attributes.');
   if(type==='horizontalRule'||type==='hardBreak'){
    if(value.content!==undefined)fail('Writing separators cannot contain child elements.');
    if(value.marks!==undefined){const clean=marks(value.marks);if(clean.length)result.marks=clean;}
   }else{
    if(value.content!==undefined&&!Array.isArray(value.content))fail('Writing content must be a list.');
    const content=value.content||[];
    if(['doc','blockquote','bulletList','orderedList','listItem'].includes(type)&&!content.length)fail('Writing containers must contain at least one element.');
    if(type==='listItem'&&content[0]?.type!=='paragraph')fail('List items must begin with a paragraph.');
    const clean=content.map(child=>node(child,depth+1,type));
    if(clean.length)result.content=clean;
   }
  }
  ancestors.delete(value);return result;
 }
 const result=node(input,1,null);
 if(new TextEncoder().encode(JSON.stringify(result)).byteLength>writingContentLimits.bytes)fail('Keep a scene document within 1 MiB.');
 return result;
}

/** Text projection used for word counts and search; stored rich text stays intact. */
export function contentText(content){
 if(content?.type==='text')return typeof content.text==='string'?content.text:'';
 if(content?.type==='hardBreak')return '\n';
 if(content?.type==='horizontalRule')return '\n';
 const children=Array.isArray(content?.content)?content.content:[];
 return children.map(contentText).join(['paragraph','heading'].includes(content?.type)?'':'\n');
}
