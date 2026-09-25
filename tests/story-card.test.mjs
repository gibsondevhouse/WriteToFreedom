import test from 'node:test';
import assert from 'node:assert/strict';

class FakeElement {
 constructor(tag,namespaceURI='http://www.w3.org/1999/xhtml'){
  this.tagName=tag.toUpperCase();this.namespaceURI=namespaceURI;this.children=[];this.attributes={};this.dataset={};this.className='';this.textContent='';this.open=false;this.handlers=new Map();this.style={values:{},setProperty:(name,value)=>{this.style.values[name]=value;}};
 }
 append(...children){this.children.push(...children);}
 setAttribute(name,value){this.attributes[name]=String(value);}
 addEventListener(type,listener){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push(listener);}
 dispatch(type,event={}){for(const listener of this.handlers.get(type)||[])listener(event);}
 focus(){this.focused=true;}
 remove(){this.removed=true;}
}

globalThis.document={
 createElement:tag=>new FakeElement(tag),
 createElementNS:(namespace,tag)=>new FakeElement(tag,namespace)
};

const story=await import('../public/components/story-card/card.js?story-card-test');
const {createProfileStoryCard}=await import('../public/components/story-card/profile-card.js?story-card-test');

test('story card frame owns artwork, context, actions, and the reusable menu',()=>{
 const record={id:'archive',name:'Royal Archive',href:'/locations/landmarks/archive/',image:'https://images.example/archive.jpg'};
 const context=document.createElement('span');context.textContent='The Capital';
 const card=story.createStoryCardFrame(record,{
  tone:'blue',eyebrow:'Landmark',context:[context],
  actions:[story.createStoryCardAction({href:record.href+'#history',label:'History',icon:'overview',count:3})],
  menuItems:[{label:'Open profile',href:record.href},{label:'Questions',href:record.href+'#open-questions'}]
 });

 assert.equal(card.tagName,'ARTICLE');
 assert.match(card.className,/story-character-card/);assert.match(card.className,/story-card/);assert.match(card.className,/blue/);
 assert.equal(card.children.length,3);assert.equal(card.children[0].href,record.href);
 assert.equal(card.children[0].children[0].children[1].src,'https://images.example/archive.jpg');
 assert.equal(card.children[1].children[0],context);
 const footer=card.children[2];assert.equal(footer.attributes.role,'group');assert.equal(footer.style.values['--story-card-actions'],'2');
 assert.equal(footer.children[0].href,record.href+'#history');assert.equal(footer.children[1].tagName,'DETAILS');
 assert.equal(footer.children[1].children[1].children[0].href,record.href);
});

test('story card artwork rejects credentialed URLs and menus restore focus on Escape',()=>{
 const picture=story.storyCardPicture({name:'Private',image:'https://user:secret@example.com/private.jpg'},'art');
 assert.equal(picture.children.length,1);

 const menu=story.createStoryCardMenu({name:'Private'},[{label:'Inspect',href:'/inspect'}]);menu.open=true;
 let prevented=false;menu.dispatch('keydown',{key:'Escape',preventDefault(){prevented=true;}});
 assert.equal(menu.open,false);assert.equal(prevented,true);assert.equal(menu.children[0].focused,true);
});

test('profile adapter produces the same complete shell for any profile-backed entity',()=>{
 const card=createProfileStoryCard({id:'ember',kind:'faction',name:'The House of Ember',href:'/factions/ember/',summary:'Every promise leaves a trace.'},{
  label:'House',sections:[{label:'Overview',hash:'overview'},{label:'Questions',hash:'open-questions',count:2}],cardClass:'faction-card'
 });
 assert.match(card.className,/story-profile-card/);assert.match(card.className,/faction-card/);
 assert.equal(card.dataset.entityId,'ember');assert.equal(card.dataset.entityType,'faction');
 assert.equal(card.children[2].children.length,3,'two section actions plus the shared menu');
 assert.equal(card.children[2].children[2].children[1].children[0].href,'/factions/ember/');
});
