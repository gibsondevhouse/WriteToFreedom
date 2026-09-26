import {randomUUID} from 'node:crypto';
import {test,expect,type APIRequestContext} from '@playwright/test';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
interface Collection{id:string;name:string;kind:'manual'|'smart';version:number;order?:string[]}
interface Reference{kind:string;id:string;characterId?:string}
async function createCollection(request:APIRequestContext,name:string,extra:Record<string,unknown>={}):Promise<Collection>{
 const response=await request.post('/api/collections',{headers:{origin},data:{id:randomUUID(),name,kind:'manual',...extra}});
 expect(response.status(),await response.text()).toBe(201);return response.json();
}
async function createCharacter(request:APIRequestContext){
 const response=await request.post('/api/characters',{headers:{origin},data:{id:randomUUID(),name:'Collection person '+randomUUID()}});
 expect(response.status()).toBe(201);return response.json();
}
async function createNovel(request:APIRequestContext){
 const response=await request.post('/api/novels',{headers:{origin},data:{id:randomUUID(),title:'Collection novel '+randomUUID()}});
 expect(response.status()).toBe(201);return response.json();
}
async function addMember(request:APIRequestContext,collection:Collection,ref:Reference):Promise<Collection>{
 const response=await request.post('/api/collections/'+collection.id+'/members',{headers:{origin},data:{version:collection.version,ref}});
 expect(response.status(),await response.text()).toBe(200);return response.json();
}
async function associate(request:APIRequestContext,novelId:string,characterId:string){
 const response=await request.post('/api/novels/'+novelId+'/associations',{headers:{origin},data:{id:randomUUID(),targetKind:'character',targetId:characterId,relationKind:'appears_in',prose:''}});
 expect(response.status()).toBe(201);return response.json();
}

test('manual mixed collections keep references after reload and removing a member preserves its source and novel link',async({page,request})=>{
 const character=await createCharacter(request),novel=await createNovel(request);
 await associate(request,novel.id,character.id);
 const collection=await createCollection(request,'Mixed collection '+randomUUID());
 await page.goto('/collections/'+collection.id+'/');
 for(const [kind,id] of [['character',character.id],['novel',novel.id]]){
  await page.getByRole('button',{name:'Add entry',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:'Add a library entry',exact:true});
  await expect(dialog.locator('#collection-member-target option[value="'+kind+'::'+id+'"]').first()).toBeAttached();
  await dialog.locator('#collection-member-target').selectOption(kind+'::'+id);
  await dialog.getByRole('button',{name:'Add entry',exact:true}).click();
  await expect(dialog).toBeHidden();
 }
 await page.reload();
 await expect(page.locator('[data-library-key="character::'+character.id+'"]')).toBeVisible();
 await expect(page.locator('[data-library-key="novel::'+novel.id+'"]')).toBeVisible();
 await page.getByRole('button',{name:'Remove '+character.name+' from collection',exact:true}).click();
 await expect(page.locator('[data-library-key="character::'+character.id+'"]')).toHaveCount(0);
 expect((await request.get('/api/characters/'+character.id)).status()).toBe(200);
 const associations=await (await request.get('/api/novels/'+novel.id+'/associations')).json();
 expect(associations).toContainEqual(expect.objectContaining({targetId:character.id}));
 const entries=await (await request.get('/api/collections/'+collection.id+'/entries')).json();
 expect(entries.entries.map((entry:{id:string})=>entry.id)).toEqual([novel.id]);
});

test('smart criteria stay in the editor and results follow distinct novel associations',async({page,request})=>{
 const character=await createCharacter(request),one=await createNovel(request),two=await createNovel(request);
 const first=await associate(request,one.id,character.id);await associate(request,two.id,character.id);
 await page.goto('/collections/');
 await page.getByRole('button',{name:'New collection',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'New collection',exact:true});
 const name='Shared cast '+randomUUID();
 await dialog.getByLabel('Name',{exact:true}).fill(name);
 await dialog.getByRole('combobox',{name:'Kind',exact:true}).selectOption('smart');
 await dialog.getByRole('button',{name:'Add criterion',exact:true}).click();
 await dialog.locator('.collection-rule-row').nth(1).getByLabel('Criterion',{exact:true}).selectOption('minNovelCount');
 await dialog.getByLabel('Minimum linked novel count',{exact:true}).fill('2');
 await dialog.getByRole('button',{name:'Save collection',exact:true}).click();
 await expect(page).toHaveURL(/\/collections\/[0-9a-f-]{36}\//);
 await expect(page.locator('#collection-rule-summary')).toContainText('Linked to at least 2 novels');
 await expect(page.locator('#collection-rule-editor')).toBeHidden();
 await expect(page.locator('[data-library-key="character::'+character.id+'"]')).toBeVisible();
 const removed=await request.delete('/api/novels/'+one.id+'/associations/'+first.id,{headers:{origin,'content-type':'application/json'},data:{version:first.version}});
 expect(removed.status()).toBe(204);
 await page.reload();
 await expect(page.locator('[data-library-key="character::'+character.id+'"]')).toHaveCount(0);
 expect((await request.get('/api/characters/'+character.id)).status()).toBe(200);
});

test('conflicting collection ordering retains the proposed order and does not overwrite a newer revision',async({page,request})=>{
 const one=await createNovel(request),two=await createNovel(request);
 let collection=await createCollection(request,'Order conflict '+randomUUID());
 collection=await addMember(request,collection,{kind:'novel',id:one.id});collection=await addMember(request,collection,{kind:'novel',id:two.id});
 await page.goto('/collections/'+collection.id+'/');
 await page.getByRole('button',{name:'Move '+two.title+' earlier',exact:true}).click();
 const updated=await request.put('/api/collections/'+collection.id,{headers:{origin},data:{version:collection.version,name:'Newer title '+randomUUID()}});
 expect(updated.status()).toBe(200);
 await page.getByRole('button',{name:'Save order',exact:true}).click();
 await expect(page.locator('[data-directory-error]')).toContainText('changed in another tab');
 await expect(page.locator('[data-directory-list] > li').first().locator('.collection-entry')).toHaveAttribute('data-library-key','novel::'+two.id);
 await expect(page.getByRole('button',{name:'Save order',exact:true})).toBeVisible();
 const saved=await (await request.get('/api/collections/'+collection.id)).json();
 expect(saved.name).toMatch(/^Newer title /);expect(saved.version).toBe(collection.version+1);
});

test('mixed cards and lists resolve canonical articles, embedded notes and exact writing contexts',async({page,request})=>{
 const create=async(path:string,fields:Record<string,unknown>)=>{
  const response=await request.post(path,{headers:{origin},data:{id:randomUUID(),...fields}});
  expect(response.status(),await response.text()).toBe(201);return response.json();
 };
 const character=await createCharacter(request),novel=await createNovel(request),noteId=randomUUID();
 const noteSave=await request.put('/api/characters/'+character.id,{headers:{origin},data:{...character,notes:[{id:noteId,title:'Treaty research',text:'A note about the lost treaty.',field:'summary',type:'detail'}]}});
 expect(noteSave.status(),await noteSave.text()).toBe(200);
 const series=await create('/api/series',{title:'The Archive Sequence'});
 const lore=await create('/api/lore',{type:'book',name:'The Royal Accord'});
 const arc=await create('/api/story-arcs',{name:'The missing treaty'});
 const chapter=await create('/api/chapters',{novelId:novel.id,title:'The first page',summary:'A winter arrival.'});
 const scene=await create('/api/scenes',{chapterId:chapter.id,title:'At the archive gate',summary:'The courier arrives.',status:'draft',contentSchemaVersion:1,content:{type:'doc',content:[{type:'paragraph'}]}});
 const library=await (await request.get('/api/library')).json();
 const selected=[['character',character.id],['faction','sample-ember'],['location','sample-capital'],['lore',lore.id],['story_arc',arc.id],['note',noteId],['novel',novel.id],['series',series.id],['chapter',chapter.id],['scene',scene.id]];
 const entries=selected.map(([kind,id])=>library.entries.find((entry:Reference)=>entry.kind===kind&&entry.id===id));
 expect(entries.every(Boolean)).toBe(true);
 let collection=await createCollection(request,'Archive research shelf',{summary:'A mixed shelf of shared articles and manuscript links.'});
 for(const entry of entries)collection=await addMember(request,collection,{kind:entry.kind,id:entry.id,...(entry.kind==='note'?{characterId:entry.characterId}:{})});
 await page.goto('/collections/'+collection.id+'/');
 await expect(page.locator('[data-directory-list] > li')).toHaveCount(entries.length);
 const destinations=new Map<string,string[]>();
 for(const entry of entries){
  const libraryKey=entry.kind+':'+(entry.characterId||'')+':'+entry.id;
  const card=page.locator('[data-library-key="'+libraryKey+'"]');
  const hrefs=await card.locator('a[href]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')!));
  expect(hrefs).toContain(entry.href);
  for(const href of hrefs){
   expect(href.split('#').length).toBeLessThanOrEqual(2);
   const url=new URL(href,origin),canonical=new URL(entry.href,origin);
   if(['chapter','scene','note','series'].includes(entry.kind))expect(href).toBe(entry.href);
   else if(entry.kind==='novel')expect([entry.href,'/scenes/?novel='+entry.id]).toContain(href);
   else expect(url.pathname).toBe(canonical.pathname);
   const route=url.pathname+url.search;if(!destinations.has(route))destinations.set(route,[]);
   if(url.hash)destinations.get(route)!.push(url.hash.slice(1));
  }
 }
 for(const [route,anchors] of destinations){
  const response=await request.get(route);expect(response.status(),route).toBe(200);const html=await response.text();
  for(const anchor of anchors)expect(html,route+'#'+anchor).toContain('id="'+anchor+'"');
 }
 await page.screenshot({path:'/tmp/wtf-review-collection-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/wtf-review-collection-mobile.png',fullPage:true});
 await page.getByRole('combobox',{name:'Archive research shelf view',exact:true}).selectOption('list');
 for(const entry of entries){
  const libraryKey=entry.kind+':'+(entry.characterId||'')+':'+entry.id;
  await expect(page.locator('[data-library-key="'+libraryKey+'"] .collection-list-entry')).toHaveAttribute('href',entry.href);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
