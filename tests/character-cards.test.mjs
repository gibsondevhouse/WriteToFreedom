import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorker} from '../server/app.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {characterCardDetails} from '../server/character-card-data.js';
import {validateRatings} from '../public/characters/attributes.js';

function setup(){
 const db=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
 const worker=createWorker({});
 return {db,async request(path,method='GET',data,owner='author'){
  return worker.fetch(new Request('https://novel.example'+path,{method,headers:{'oai-authenticated-user-id':owner,origin:'https://novel.example','content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})}),{DB:d1Adapter(db)});
 }};
}
test('ratings distinguish unrated from zero and reject invalid keys, fractions, or ranges',()=>{
 assert.deepEqual(validateRatings({strength:0,speed:99}),{strength:0,speed:99});assert.deepEqual(validateRatings({}),{});
 for(const ratings of [{strength:100},{speed:-1},{intelligence:1.5},{strength:'20'},{unknown:40},[],null])assert.throws(()=>validateRatings(ratings));
});
test('card relations include incoming links once and note mentions respect names and source ownership',()=>{
 const hero={id:'hero',name:'Ann',factionId:'house',relationships:[{targetId:'friend',type:'Ally',description:'Keeps the secret.'}]};
 const friend={id:'friend',name:'Jo',portraitUrl:'https://example.org/jo.jpg',relationships:[{targetId:'hero',type:'Sister',description:'Family notes.'}],biography:'Ann crossed the sea.',summary:'Annabelle is a different person.'};
 const faction={id:'house',name:'House of Dawn',type:'House',imageUrl:'https://example.org/house.jpg',questions:'Can Ann return?',hiddenFields:['questions']};
 const ctx={cast:[hero,friend],factions:[faction],countries:[],locations:[],profiles:{character:[hero,friend],faction:[faction],country:[],city:[]}};
 const data=characterCardDetails(hero,ctx);
 assert.equal(data.relationships.length,1);assert.equal(data.relationships[0].connections.length,2);assert.equal(data.affiliationCard.image,faction.imageUrl);assert.equal(data.mentions.length,3);
 assert.equal(data.mentions.find(m=>m.kind==='faction').href,'/factions/house/');assert.ok(!data.mentions.some(m=>m.text.includes('Annabelle')));
 hero.name='';assert.equal(characterCardDetails(hero,ctx).mentions.length,1,'blank names never match every note');
});
test('country artwork is used when a character has citizenship and no faction',()=>{
 const character={id:'a',name:'A',citizenshipId:'country'};
 const data=characterCardDetails(character,{cast:[character],factions:[],countries:[{id:'country',name:'Isles',flagUrl:'https://example.org/flag.png'}],locations:[],profiles:{character:[],faction:[],country:[],city:[]}});
 assert.equal(data.affiliationCard.name,'Isles');assert.equal(data.affiliationCard.image,'https://example.org/flag.png');
});
test('saved attributes and imagery survive regular profile edits, remain private, and reject stale writes',async()=>{
 const {db,request}=setup();let original=await (await request('/api/characters/claude')).json();
 let response=await request('/api/characters/claude','PUT',{...original,portraitUrl:'https://example.org/portrait.jpg',attributeRatings:{strength:0,speed:72,intelligence:93}});assert.equal(response.status,200);let saved=await response.json();
 const legacy={...saved,summary:'A new summary'};delete legacy.attributeRatings;delete legacy.portraitUrl;
 saved=await (await request('/api/characters/claude','PUT',legacy)).json();assert.equal(saved.attributeRatings.speed,72);assert.equal(saved.portraitUrl,'https://example.org/portrait.jpg');
 assert.equal((await request('/api/characters/claude','PUT',{...original,attributeRatings:{speed:44}})).status,409);
 assert.equal((await request('/api/characters/claude','PUT',{...saved,attributeRatings:{speed:100}})).status,400);
 assert.equal((await request('/api/characters/claude','PUT',{...saved,portraitUrl:'javascript:alert(1)'})).status,400);
 const other=await (await request('/api/characters/claude','GET',undefined,'other-author')).json();assert.deepEqual(other.attributeRatings,{});assert.equal(other.portraitUrl,'');
 const faction=await (await request('/api/factions/sample-ember')).json();response=await request('/api/factions/sample-ember','PUT',{...faction,imageUrl:'https://example.org/crest.png'});assert.equal(response.status,200);
 const dashboard=await (await request('/api/dashboard')).json();const card=dashboard.characters.find(c=>c.id==='claude');assert.equal(card.attributeRatings.speed,72);assert.equal(card.image,'https://example.org/portrait.jpg');assert.equal(card.affiliationCard.image,'https://example.org/crest.png');
 const profile=await (await request('/characters/claude/')).text();assert.match(profile,/name="portraitUrl"/);
 db.close();
});

test('morality selector saves independently of attribute ratings, imagery, and relationships',async()=>{
 const {db,request}=setup();const initial=await (await request('/api/characters/claude')).json();
 const saved=await (await request('/api/characters/claude','PUT',{...initial,attributeRatings:{strength:81},portraitUrl:'https://example.org/portrait.jpg'})).json();
 const response=await request('/api/characters/claude','PUT',{...saved,alignment:'Morally gray'});assert.equal(response.status,200);const updated=await response.json();
 assert.equal(updated.alignment,'Morally gray');assert.deepEqual(updated.attributeRatings,{strength:81});assert.equal(updated.portraitUrl,saved.portraitUrl);assert.deepEqual(updated.relationships,saved.relationships);
 const dashboard=await (await request('/api/dashboard')).json();assert.equal(dashboard.characters.find(c=>c.id==='claude').alignment,'Morally gray');
 assert.equal((await request('/api/characters/claude','PUT',{...updated,alignment:'invented'})).status,400);
 db.close();
});

test('section ratings save together without losing existing ratings or prose, and reach dashboard cards',async()=>{
 const {db,request}=setup();
 try{
  const original=await (await request('/api/characters/claude')).json();
  const attributeRatings={strength:72,intelligence:83,willpower:60,leadership:34,charisma:91,deception:18,adaptability:65,assertiveness:50,composure:77,workEthic:99,planning:0,ambition:42,consistency:80,loyalty:95};
  const response=await request('/api/characters/claude','PUT',{...original,attributeRatings});assert.equal(response.status,200);
  const saved=await (await request('/api/characters/claude')).json();
  assert.deepEqual(saved.attributeRatings,attributeRatings);assert.equal(saved.strength,original.strength);assert.equal(saved.personality,original.personality);assert.deepEqual(saved.relationships,original.relationships);
  const dashboard=await (await request('/api/dashboard')).json();assert.deepEqual(dashboard.characters.find(c=>c.id==='claude').attributeRatings,attributeRatings);
  const revised={...attributeRatings,consistency:82};delete revised.planning;
  const update=await request('/api/characters/claude','PUT',{...saved,attributeRatings:revised});assert.equal(update.status,200);assert.deepEqual((await update.json()).attributeRatings,revised);
 }finally{db.close();}
});

test('profile notes render numbered references to saved sources and escape their text',async()=>{
 const {db,request}=setup();try{
  const hero=await (await request('/api/characters/claude')).json();
  const source=await (await request('/api/characters/gpt')).json();
  const text=hero.name+' found the <sealed> ledger & kept it safe.';
  const saved=await request('/api/characters/gpt','PUT',{...source,biography:text});assert.equal(saved.status,200);
  const html=await (await request('/characters/claude/')).text();
  assert.match(html,/id="notes" class="profile-section"/);
  assert.match(html,/aria-controls="notes-body" data-collapse-target="notes-body"/);
  assert.match(html,/<ol id="mentioned-notes" class="profile-references" start="1"><li id="character-note-1">/);
  assert.ok(html.includes('href="/characters/gpt/#field-biography"'));
  assert.ok(html.includes('&lt;sealed&gt; ledger &amp; kept it safe.'));
  assert.ok(!html.includes('<sealed>'));
  const other=await (await request('/characters/claude/','GET',undefined,'other-author')).text();assert.ok(!other.includes('&lt;sealed&gt; ledger'));
 }finally{db.close();}
});

test('reusable card records match dashboard cards while retaining directory search data and ownership',async()=>{
 const {db,request}=setup();try{
  const original=await (await request('/api/characters/claude')).json();
  await request('/api/characters/claude','PUT',{...original,firstName:'Changed name',biography:'A unique detail for search',alignment:'Morally gray'});
  const dashboard=await (await request('/api/dashboard')).json();
  const cards=await (await request('/api/characters?view=cards')).json();
  const record=cards.characters.find(c=>c.id==='claude');
  for(const [key,value] of Object.entries(dashboard.characters.find(c=>c.id==='claude')))assert.deepEqual(record[key],value,key+' matches on both surfaces');
  assert.equal(record.biography,'A unique detail for search');assert.ok(Array.isArray(record.roles));
  const other=await (await request('/api/characters?view=cards','GET',undefined,'other-author')).json();assert.notEqual(other.characters.find(c=>c.id==='claude').biography,record.biography);
  const raw=await (await request('/api/characters')).json();assert.equal(typeof raw.characters[0].roles,'string','existing API consumers keep the original contract');
 }finally{db.close();}
});
test('shared card defaults and colors stay stable across rail and grid consumers',async()=>{
 const {normalizeCard,characterTone}=await import('../public/components/character-card/model.js');
 const sparse=normalizeCard({id:'new-person',name:'  ',roles:'Explorer · Diplomat'});
 assert.equal(sparse.name,'Untitled character');assert.equal(sparse.href,'/characters/new-person/');assert.deepEqual(sparse.roles,['Explorer','Diplomat']);assert.deepEqual(sparse.relationships,[]);assert.deepEqual(sparse.mentions,[]);assert.equal(sparse.affiliationCard.name,'Independent');
 assert.equal(characterTone({id:'claude'}),'clay');assert.equal(characterTone(sparse),characterTone({...sparse,name:'A renamed character'}));assert.equal(characterTone(sparse,'gold'),'gold');assert.equal(characterTone(sparse,'invalid'),characterTone(sparse));
});

test('power is bounded, exponential, monotonic, and honest about incomplete attributes',async()=>{
 const {characterPower}=await import('../public/characters/power.js');
 const {attributeKeys}=await import('../public/characters/attributes.js');
 const ratings=value=>Object.fromEntries(attributeKeys.map(key=>[key,value]));
 assert.equal(characterPower({}).score,null);
 assert.deepEqual(characterPower(ratings(0)),{score:0,rated:20,total:20,provisional:false});
 assert.equal(characterPower(ratings(99)).score,9999);
 const low=characterPower(ratings(20)).score,mid=characterPower(ratings(40)).score,high=characterPower(ratings(60)).score;
 assert.ok(high-mid>mid-low);assert.ok(characterPower({strength:99}).score<low);assert.ok(characterPower({strength:99}).provisional);
 assert.equal(characterPower({strength:100,speed:-1,unknown:99}).score,null);
 let previous=-1;for(let rating=0;rating<=99;rating++){const score=characterPower(ratings(rating)).score;assert.ok(score>previous&&score<=9999);previous=score;}
});

test('featured items persist independently, validate ownership, and work across both card surfaces',async()=>{
 const {db,request}=setup();try{
  let original=await (await request('/api/characters/claude')).json();
  const picker=await (await request('/api/characters/claude?view=connections')).json();
  assert.ok(picker.options.some(option=>option.ref.kind==='faction'));assert.ok(picker.options.some(option=>option.ref.kind==='location'));assert.ok(!picker.options.some(option=>option.ref.kind==='character'&&option.ref.id==='claude'));
  let response=await request('/api/characters/claude','PUT',{...original,cardConnection:{kind:'character',id:'gemini'}});assert.equal(response.status,200);
  let saved=await response.json();assert.equal(saved.factionId,original.factionId);assert.deepEqual(saved.relationships,original.relationships);
  let dashboard=await (await request('/api/dashboard')).json();assert.equal(dashboard.characters.find(c=>c.id==='claude').affiliationCard.name,'Gemini');
  const cards=await (await request('/api/characters?view=cards')).json();assert.deepEqual(cards.characters.find(c=>c.id==='claude').affiliationCard,dashboard.characters.find(c=>c.id==='claude').affiliationCard);
  const legacy={...saved,summary:'Edited elsewhere'};delete legacy.cardConnection;
  response=await request('/api/characters/claude','PUT',legacy);assert.equal(response.status,200);saved=await response.json();assert.equal(saved.cardConnection.id,'gemini');
  assert.equal((await request('/api/characters/claude','PUT',{...original,cardConnection:null})).status,409);
  assert.equal((await request('/api/characters/claude','PUT',{...saved,cardConnection:{kind:'character',id:'claude'}})).status,400);
  const privateId='f591b330-8cb8-4977-b927-c075dd60f197';await request('/api/characters','POST',{id:privateId,name:'Private stranger'},'other-author');
  assert.equal((await request('/api/characters/claude','PUT',{...saved,cardConnection:{kind:'character',id:privateId}})).status,400);
  const other=await (await request('/api/characters/claude?view=connections','GET',undefined,'other-author')).json();assert.ok(!other.character.cardConnection);
  response=await request('/api/characters/claude','PUT',{...saved,cardConnection:null});assert.equal(response.status,200);
  dashboard=await (await request('/api/dashboard')).json();const card=dashboard.characters.find(c=>c.id==='claude');assert.deepEqual(card.affiliationCard,card.defaultAffiliationCard);
 }finally{db.close();}
});
