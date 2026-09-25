import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

class FakeElement {
 constructor(tag,owner){
  this.tagName=tag.toUpperCase();this.ownerDocument=owner;this.children=[];this.parentNode=null;this.attrs={};this.handlers=new Map();this._text='';
  this.className='';this.hidden=false;this.disabled=false;this.open=false;this.tabIndex=0;this.dataset={};this.value='';this.checked=false;this.readOnly=false;this.validity={valid:true};this.scrollTop=0;
  this.style={values:{},setProperty:(key,value)=>{this.style.values[key]=value;}};
  this.classList={add:(...names)=>this.setClasses([...this.classes(),...names]),remove:(...names)=>this.setClasses(this.classes().filter(name=>!names.includes(name))),contains:name=>this.classes().includes(name)};
 }
 classes(){return this.className.split(/\s+/).filter(Boolean);}
 setClasses(names){this.className=[...new Set(names)].join(' ');}
 set textContent(value){this._text=String(value??'');this.children=[];}
 get textContent(){return this._text+this.children.map(child=>child.textContent||'').join('');}
 get childNodes(){return this.children;}
 append(...items){for(const item of items){item.parentNode=this;this.children.push(item);}}
 replaceChildren(...items){this.children=[];this._text='';this.append(...items);}
 setAttribute(key,value){this.attrs[key]=String(value);}
 getAttribute(key){return this.attrs[key]??null;}
 addEventListener(type,handler){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(handler);}
 removeEventListener(type,handler){this.handlers.get(type)?.delete(handler);}
 dispatch(type,extra={}){const event={target:this,currentTarget:this,preventDefault(){this.defaultPrevented=true;},...extra};for(const handler of this.handlers.get(type)||[])handler(event);return event;}
 click(){this.dispatch('click');}
 focus(){this.ownerDocument.activeElement=this;this.focused=true;}
 showModal(){this.open=true;}
 close(){this.open=false;this.dispatch('close');}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}
 checkValidity(){return this.validity.valid;}
 setCustomValidity(message){this.validationMessage=message;this.validity.valid=!message;this.validity.customError=!!message;}
 reportValidity(){return this.validity.valid;}
 closest(selector){let node=this;while(node){if(node.matches(selector))return node;node=node.parentNode;}return null;}
 getBoundingClientRect(){return {left:0,right:560,top:0,bottom:760};}
 matches(selector){
  if(selector.startsWith('#'))return this.id===selector.slice(1);
  if(selector.startsWith('.'))return this.classes().includes(selector.slice(1));
  const role=selector.match(/^\[role=["']?([^"'\]]+)["']?\]$/);if(role)return this.getAttribute('role')===role[1];
  return this.tagName===selector.toUpperCase();
 }
 querySelectorAll(selector){
  const selectors=selector.split(',').map(value=>value.trim()),found=[];
  const visit=node=>{for(const child of node.children){if(selectors.some(item=>child.matches(item)))found.push(child);visit(child);}};
  visit(this);return found;
 }
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}

function fakeDom(){
 const handlers=new Map(),document={activeElement:null,createElement(tag){return new FakeElement(tag,document);},createElementNS(_namespace,tag){return new FakeElement(tag,document);},createTextNode(text){const node=new FakeElement('#text',document);node.textContent=text;return node;},querySelectorAll(selector){return document.body.querySelectorAll(selector);},addEventListener(type,handler){if(!handlers.has(type))handlers.set(type,new Set());handlers.get(type).add(handler);},removeEventListener(type,handler){handlers.get(type)?.delete(handler);}};
 document.body=new FakeElement('body',document);
 const opener=new FakeElement('button',document);opener.isConnected=true;document.activeElement=opener;
 const windowHandlers=new Map();
 const window={addEventListener(type,handler){if(!windowHandlers.has(type))windowHandlers.set(type,new Set());windowHandlers.get(type).add(handler);},removeEventListener(type,handler){windowHandlers.get(type)?.delete(handler);},dispatchEvent(event){for(const handler of windowHandlers.get(event.type)||[])handler(event);return true;}};
 return {document,window,opener};
}

function response(data){return {ok:true,headers:{get:key=>key==='content-type'?'application/json':null},async json(){return structuredClone(data);}};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('character More opens accessible About, Ratings, and reserved Mentions tabs',async()=>{
 const previous={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch};
 const {document,window,opener}=fakeDom();globalThis.document=document;globalThis.window=window;
 const longBiography=('A careful archivist follows every clue through the margins. '.repeat(10)).trim();
 const saved={id:'hero',version:4,firstName:'Avery',name:'Avery Vale',portraitUrl:'https://example.org/avery.jpg',biography:longBiography,height:'172',heightUnit:'cm',weight:'64',weightUnit:'kg',birthDate:'Late Frost, Year 18',alignment:'Legacy compass',attributeRatings:{speed:70},relationships:[],hiddenFields:[]};
 const calls=[],putBodies=[];let onUpdate;
 globalThis.fetch=async(url,options={})=>{
  calls.push({url,options});
  if(options.method==='PUT'){
   const putBody=JSON.parse(options.body);putBodies.push(putBody);
   return response({...putBody,version:saved.version+putBodies.length});
  }
  return response(saved);
 };
 try{
  const {openCharacter}=await import('../public/components/character-card/details.js?overlay-test='+Date.now());
  openCharacter({id:'hero',name:'Avery Vale',href:'/characters/hero/',image:'',summary:'Card summary',mentions:[]},'attributes',record=>{onUpdate=record;});
  await flush();
  const dialog=document.body.querySelector('.character-detail-overlay'),tabs=dialog.querySelectorAll('.character-detail-tab');
  assert.ok(dialog.open);assert.equal(calls.length,1);assert.deepEqual(tabs.map(tab=>tab.textContent),['About','Ratings','Mentions']);
  assert.equal(dialog.querySelector('.character-detail-tabs').getAttribute('role'),'tablist');
  assert.deepEqual(tabs.map(tab=>tab.getAttribute('aria-selected')),['true','false','false']);
  assert.equal(document.activeElement,tabs[0]);
  const about=dialog.querySelector('#character-detail-panel-about'),ratings=dialog.querySelector('#character-detail-panel-ratings'),mentions=dialog.querySelector('#character-detail-panel-mentions');
  assert.equal(about.hidden,false);assert.equal(ratings.hidden,true);assert.equal(mentions.hidden,true);
  assert.equal(about.getAttribute('role'),'tabpanel');assert.equal(about.getAttribute('aria-labelledby'),tabs[0].id);
  assert.equal(about.querySelector('.character-about-photo').src,saved.portraitUrl);
  const height=about.querySelector('#character-about-height'),heightUnit=about.querySelector('#character-about-heightUnit');
  const weight=about.querySelector('#character-about-weight'),weightUnit=about.querySelector('#character-about-weightUnit');
  const birthday=about.querySelector('#character-about-birthDate'),alignment=about.querySelector('#character-about-alignment');
  assert.equal(height.value,'172');assert.equal(height.type,'text');assert.equal(height.inputMode,'decimal');assert.equal(height.maxLength,10000);assert.equal(height.getAttribute('aria-label'),'Height');
  assert.equal(heightUnit.value,'cm');assert.equal(heightUnit.getAttribute('aria-label'),'Height unit');
  assert.equal(weight.value,'64');assert.equal(weight.type,'text');assert.equal(weight.inputMode,'decimal');assert.equal(weight.maxLength,10000);assert.equal(weight.getAttribute('aria-label'),'Weight');
  assert.equal(weightUnit.value,'kg');assert.equal(weightUnit.getAttribute('aria-label'),'Weight unit');
  assert.equal(birthday.value,'Late Frost, Year 18');assert.equal(birthday.type,'text');assert.equal(birthday.readOnly,true);assert.equal(birthday.dataset.dateInput,'');assert.equal(birthday.getAttribute('aria-label'),'Birthday');assert.equal(birthday.getAttribute('aria-haspopup'),'dialog');assert.equal(birthday.getAttribute('aria-controls'),'profile-date-picker');
  assert.equal(alignment.value,'Legacy compass');assert.equal(alignment.getAttribute('aria-label'),'Moral alignment');assert.match(alignment.textContent,/Legacy compass/);
  assert.ok(about.querySelector('.character-about-bio').textContent.endsWith('…'));assert.ok(about.querySelector('.character-about-bio').textContent.length<longBiography.length);
  const save=dialog.querySelector('.attribute-save');assert.equal(save.textContent,'Save details');assert.equal(save.hidden,false);assert.equal(save.disabled,true);

  height.value='180';height.dispatch('input');heightUnit.value='in';heightUnit.dispatch('change');
  weight.value='150';weight.dispatch('input');weightUnit.value='lb';weightUnit.dispatch('change');
  birthday.value='First Dawn, Year 21';birthday.dispatch('input');alignment.value='Good';alignment.dispatch('change');
  assert.equal(save.disabled,false);assert.match(dialog.querySelector('.character-detail-notice').textContent,/Unsaved changes/);
  tabs[1].click();height.validity.valid=false;save.click();await flush();
  assert.equal(calls.length,1,'an invalid hidden About control blocks the request');assert.equal(tabs[0].getAttribute('aria-selected'),'true');assert.equal(document.activeElement,height);
  height.validity.valid=true;
  save.click();await flush();
  assert.equal(calls.length,2);assert.equal(putBodies.length,1);
  assert.equal(putBodies[0].version,4);assert.equal(putBodies[0].height,'180');assert.equal(putBodies[0].heightUnit,'in');assert.equal(putBodies[0].weight,'150');assert.equal(putBodies[0].weightUnit,'lb');assert.equal(putBodies[0].birthDate,'First Dawn, Year 21');assert.equal(putBodies[0].alignment,'Good');
  assert.equal(putBodies[0].biography,longBiography);assert.deepEqual(putBodies[0].attributeRatings,saved.attributeRatings);assert.equal(putBodies[0].portraitUrl,saved.portraitUrl);assert.deepEqual(putBodies[0].relationships,saved.relationships);assert.deepEqual(putBodies[0].hiddenFields,saved.hiddenFields);
  assert.equal(onUpdate.height,'180');assert.equal(onUpdate.birthDate,'First Dawn, Year 21');assert.equal(onUpdate.alignment,'Good');

  let prevented=false;tabs[0].dispatch('keydown',{key:'ArrowRight',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(tabs[1].getAttribute('aria-selected'),'true');assert.equal(document.activeElement,tabs[1]);
  assert.equal(ratings.hidden,false);assert.equal(save.hidden,false);assert.equal(save.textContent,'Save ratings');assert.equal(dialog.querySelector('.attribute-power'),null);
  const portrait=dialog.querySelector('#attribute-portrait-url');portrait.value='https://example.org/revised.jpg';portrait.dispatch('input');
  tabs[0].click();assert.equal(about.querySelector('.character-about-photo').src,portrait.value,'portrait drafts refresh the About preview');tabs[1].click();
  const strength=dialog.querySelector('#rating-strength');strength.value='42';strength.dispatch('input');
  assert.equal(save.disabled,false);
  tabs[0].click();tabs[1].click();assert.equal(dialog.querySelector('#rating-strength'),strength);assert.equal(strength.value,'42','rating drafts survive tab switches');
  save.click();await flush();
  assert.equal(calls.length,3);assert.equal(putBodies.length,2);assert.equal(putBodies[1].version,5);assert.equal(putBodies[1].attributeRatings.strength,42);
  assert.equal(putBodies[1].height,'180');assert.equal(putBodies[1].heightUnit,'in');assert.equal(putBodies[1].weight,'150');assert.equal(putBodies[1].weightUnit,'lb');assert.equal(putBodies[1].birthDate,'First Dawn, Year 21');assert.equal(putBodies[1].alignment,'Good');
  assert.equal(putBodies[1].biography,longBiography);assert.equal(putBodies[1].portraitUrl,portrait.value);assert.equal(onUpdate.image,portrait.value);

  tabs[0].click();assert.equal(height.value,'180');assert.equal(heightUnit.value,'in');assert.equal(weight.value,'150');assert.equal(weightUnit.value,'lb');assert.equal(birthday.value,'First Dawn, Year 21');assert.equal(alignment.value,'Good');

  tabs[2].click();assert.equal(mentions.hidden,false);assert.match(mentions.textContent,/Mentions will appear here/);assert.equal(save.hidden,true);assert.equal(calls.length,3);
  dialog.querySelector('.character-detail-close').click();assert.equal(document.body.querySelector('.character-detail-overlay'),null);assert.equal(document.activeElement,opener);

  const css=readFileSync('public/components/character-card/details.css','utf8');
  assert.match(css,/aspect-ratio:\s*3\s*\/\s*2/);assert.match(css,/object-fit:\s*cover/);assert.match(css,/-webkit-line-clamp:\s*5/);
 }finally{
  globalThis.document=previous.document;globalThis.window=previous.window;globalThis.fetch=previous.fetch;
 }
});
