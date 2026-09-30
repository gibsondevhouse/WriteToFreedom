import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {test,expect,type APIRequestContext,type Locator,type Page} from '@playwright/test';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
interface RichNode{type:string;text?:string;attrs?:Record<string,unknown>;marks?:Array<{type:string;attrs?:Record<string,unknown>}>;content?:RichNode[]}
interface Chapter{id:string;title:string;summary:string;version:number}
let testNovelId='';
test.beforeEach(async({request})=>{
 const response=await request.post('/api/novels',{headers:{origin},data:{id:randomUUID(),title:'Writing regression '+randomUUID()}});
 expect(response.status(),await response.text()).toBe(201);testNovelId=(await response.json()).id;
});
interface Scene{id:string;chapterId:string;title:string;summary:string;status:string;contentSchemaVersion:number;content:RichNode;version:number}
const documentFrom=(...paragraphs:string[]):RichNode=>({type:'doc',content:paragraphs.map(text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})}))});
const textFrom=(node:RichNode):string=>node.text??(node.content||[]).map(textFrom).join(node.type==='doc'?'\n':'');
const editor=(page:Page)=>page.getByRole('textbox',{name:'Scene text',exact:true});
const focusedWritingRoutes=[
 {path:'/chapters/',heading:'Chapters',primaryAction:'New chapter'},
 {path:'/scenes/',heading:'Scenes',primaryAction:'New scene'},
] as const;
async function createChapter(request:APIRequestContext,title='Browser chapter '+randomUUID()):Promise<Chapter>{
 const response=await request.post('/api/chapters',{headers:{origin},data:{id:randomUUID(),novelId:testNovelId,title,summary:'A browser verification chapter.'}});
 expect(response.status(),await response.text()).toBe(201);
 return response.json();
}
async function createScene(request:APIRequestContext,chapter:Chapter,overrides:Partial<Scene>={}):Promise<Scene>{
 const response=await request.post('/api/scenes',{headers:{origin},data:{id:randomUUID(),chapterId:chapter.id,title:'Browser scene '+randomUUID(),summary:'A scene for browser verification.',status:'draft',contentSchemaVersion:1,content:documentFrom('The first line of the scene.'),...overrides}});
 expect(response.status(),await response.text()).toBe(201);
 return response.json();
}
async function readScene(request:APIRequestContext,id:string):Promise<Scene>{
 const response=await request.get('/api/scenes/'+id);
 expect(response.status()).toBe(200);
 return response.json();
}
async function openScene(page:Page,scene:Scene){
 expect((await page.goto('/scenes/?scene='+scene.id))?.status()).toBe(200);
 await expect(editor(page)).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(scene.title);
 await expect(editor(page)).toHaveText(textFrom(scene.content).replaceAll('\n',''));
}
async function saveScene(page:Page,id:string,shortcut=false):Promise<Scene>{
 const response=page.waitForResponse(response=>response.url()===origin+'/api/scenes/'+id&&response.request().method()==='PUT');
 if(shortcut)await page.keyboard.press('ControlOrMeta+s');
 else await page.getByRole('button',{name:'Save scene',exact:true}).click();
 const result=await response;
 expect(result.status(),await result.text()).toBe(200);
 await expect(page.locator('#scene-save-status')).toHaveText('Saved');
 return result.json();
}
async function selectedText(control:Locator){return control.evaluate(element=>element.ownerDocument.getSelection()?.toString()||'');}
async function deleteChapterCard(page:Page,chapter:Chapter){
 const response=page.waitForResponse(candidate=>candidate.url()===origin+'/api/chapters/'+chapter.id+'?novelId='+testNovelId&&candidate.request().method()==='DELETE');
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Delete chapter: '+chapter.title,exact:true}).click();
 const result=await response;
 expect(result.status()).toBe(204);
 await expect(page.getByRole('heading',{name:chapter.title,exact:true})).toHaveCount(0);
}

test('chapters and scenes open focused writing routes with their own primary actions',async({page})=>{
 for(const route of focusedWritingRoutes){
  expect((await page.goto(route.path+'?novel='+testNovelId))?.status()).toBe(200);
  await expect(page.getByRole('heading',{name:route.heading,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:route.primaryAction,exact:true}).first()).toBeVisible();
 }
});

test('empty chapter creation remains disabled until the novel context loads successfully',async({page})=>{
 await page.route('**/api/novels',route=>route.abort('failed'));
 await page.goto('/chapters/?novel='+testNovelId);
 await expect(page.getByRole('link',{name:'Open my novels',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'New chapter',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Create your first chapter',exact:true})).toBeDisabled();
 await expect(page.getByRole('dialog',{name:'New chapter',exact:true})).toHaveCount(0);
 await page.unroute('**/api/novels');await page.reload();
 await expect(page.getByRole('button',{name:'Create your first chapter',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Create your first chapter',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'New chapter',exact:true})).toBeVisible();
});

test('the local development host accepts a localhost same-origin chapter creation',async({page})=>{
 const localhostOrigin=origin.replace('127.0.0.1','localhost');
 await page.goto(localhostOrigin+'/chapters/?novel='+testNovelId);
 const chapter={id:randomUUID(),novelId:testNovelId,title:'Same-origin chapter '+randomUUID(),summary:'Created through the browser on the local development host.'};
 const mutation=page.waitForRequest(candidate=>candidate.url()===localhostOrigin+'/api/chapters'&&candidate.method()==='POST');
 const result=await page.evaluate(async body=>{
  const response=await fetch('/api/chapters',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
 },chapter);
 const browserRequest=await mutation;
 expect(await browserRequest.headerValue('origin')).toBe(localhostOrigin);
 expect(result.status).toBe(201);
 expect(result.body).toMatchObject(chapter);
 const catalog=await page.evaluate(async()=>{
  const response=await fetch('/api/chapters',{credentials:'same-origin'});
  return response.json();
 });
 expect(catalog.chapters).toContainEqual(expect.objectContaining({id:chapter.id,title:chapter.title}));
});

test('incomplete scene titles retain the mounted editor and prose until a corrected title saves',async({page,request})=>{
 const chapter=await createChapter(request),scene=await createScene(request,chapter),errors:string[]=[];
 let writes=0;
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',candidate=>{if(candidate.url()===origin+'/api/scenes/'+scene.id&&candidate.method()==='PUT')writes++;});
 await openScene(page,scene);
 await editor(page).fill('Retain this unsaved prose while replacing the scene title.');
 const title=page.getByRole('textbox',{name:'Scene title',exact:true});
 for(const incomplete of ['', '   ']){
  await title.fill(incomplete);
  await expect(editor(page)).toBeVisible();await expect(editor(page)).toHaveText('Retain this unsaved prose while replacing the scene title.');
  await title.press('ControlOrMeta+s');
  await expect(page.locator('#scene-error')).toContainText('Enter a scene title');
  await expect(title).toHaveValue(incomplete);expect(writes).toBe(0);
 }
 expect((await readScene(request,scene.id)).title).toBe(scene.title);
 await title.fill('Corrected scene title');
 const saved=await saveScene(page,scene.id);
 expect(saved.title).toBe('Corrected scene title');expect(textFrom(saved.content)).toBe('Retain this unsaved prose while replacing the scene title.');
 expect(writes).toBe(1);expect(errors).toEqual([]);
 await page.reload();await expect(title).toHaveValue('Corrected scene title');await expect(editor(page)).toHaveText('Retain this unsaved prose while replacing the scene title.');
});

test('chapter counts and outline groups follow draft moves without resetting scene prose or undo',async({page,request})=>{
 const first=await createChapter(request,'First indexed chapter '+randomUUID()),second=await createChapter(request,'Second indexed chapter '+randomUUID()),empty=await createChapter(request,'Empty indexed chapter '+randomUUID());
 const moving=await createScene(request,first,{title:'Moving scene '+randomUUID()}),retained=await createScene(request,first,{title:'Retained scene '+randomUUID()}),destination=await createScene(request,second,{title:'Destination scene '+randomUUID()});
 await page.goto('/chapters/?novel='+testNovelId);
 const card=(chapter:Chapter)=>page.locator('article.writing-chapter-story-card').filter({has:page.getByRole('heading',{name:chapter.title,exact:true})});
 await expect(card(first).locator('.character-power')).toHaveText('2 scenes');await expect(card(second).locator('.character-power')).toHaveText('1 scene');await expect(card(empty).locator('.character-power')).toHaveText('0 scenes');
 await openScene(page,moving);
 const prose=editor(page),original=textFrom(moving.content),suffix=' Retained edit while moving.';
 await prose.evaluate(element=>{
  element.focus();const selection=element.ownerDocument.getSelection(),range=element.ownerDocument.createRange();
  range.selectNodeContents(element);range.collapse(false);selection?.removeAllRanges();selection?.addRange(range);
 });
 await prose.pressSequentially(suffix);
 const firstGroup=page.locator('#chapter-scenes-'+first.id),secondGroup=page.locator('#chapter-scenes-'+second.id),emptyGroup=page.locator('#chapter-scenes-'+empty.id);
 await page.getByLabel('Scene chapter',{exact:true}).selectOption(second.id);
 await expect(firstGroup.getByRole('button',{name:'Open scene: '+moving.title,exact:true})).toHaveCount(0);
 await expect(firstGroup.getByRole('button',{name:'Open scene: '+retained.title,exact:true})).toBeVisible();
 await expect(secondGroup.getByRole('button',{name:'Open scene: '+moving.title,exact:true})).toBeVisible();await expect(secondGroup.getByRole('button',{name:'Open scene: '+destination.title,exact:true})).toBeVisible();
 await expect(emptyGroup).toContainText('No scenes yet');await expect(prose).toHaveText(original+suffix);
 expect((await readScene(request,moving.id)).chapterId).toBe(first.id);
 await prose.press('ControlOrMeta+z');await expect(prose).toHaveText(original);
 await prose.press('ControlOrMeta+Shift+z');await expect(prose).toHaveText(original+suffix);
 const saved=await saveScene(page,moving.id);expect(saved.chapterId).toBe(second.id);expect(textFrom(saved.content)).toBe(original+suffix);
 await page.goto('/chapters/?novel='+testNovelId);
 await expect(card(first).locator('.character-power')).toHaveText('1 scene');await expect(card(second).locator('.character-power')).toHaveText('2 scenes');await expect(card(empty).locator('.character-power')).toHaveText('0 scenes');
});

test('creates a chapter and a rich-text scene through the writing workspace',async({page,request})=>{
 await page.goto('/chapters/?novel='+testNovelId);
 await expect(page.getByRole('heading',{name:'Chapters',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'New chapter',exact:true}).first().click();
 const chapterDialog=page.getByRole('dialog',{name:'New chapter',exact:true});
 const title='New chapter '+randomUUID();
 await chapterDialog.getByLabel('Chapter title',{exact:true}).fill(title);
 await chapterDialog.getByLabel('Chapter summary',{exact:true}).fill('A discovery in the winter archive.');
 const chapterCreated=page.waitForResponse(response=>response.url()===origin+'/api/chapters'&&response.request().method()==='POST');
 await chapterDialog.getByRole('button',{name:'Create chapter',exact:true}).click();
 expect((await chapterCreated).status()).toBe(201);
 const chapter:Chapter=await (await chapterCreated).json();
 await expect(chapterDialog).toHaveCount(0);
 const chapterCard=page.locator('article.story-character-card.story-card.story-profile-card.writing-chapter-story-card').filter({has:page.getByRole('heading',{name:title,exact:true})});
 await expect(chapterCard).toBeVisible();
 await expect(chapterCard.locator('.character-role')).toHaveText(/^Chapter \d+$/);
 await expect(chapterCard).toContainText('0 scenes');
 await expect(chapterCard).toContainText('A discovery in the winter archive.');
 await expect(chapterCard.getByRole('group',{name:'Actions for '+title})).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:'is ready. Add its first scene'})).toBeVisible();
 await chapterCard.getByRole('button',{name:'Edit chapter: '+title}).click();
 const editChapterDialog=page.getByRole('dialog',{name:'Edit chapter',exact:true});
 await expect(editChapterDialog.getByLabel('Chapter title',{exact:true})).toHaveValue(title);
 await editChapterDialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await chapterCard.getByRole('button',{name:'Add scene to '+title}).click();
 const sceneDialog=page.getByRole('dialog',{name:'New scene',exact:true});
 const sceneTitle='An open door '+randomUUID();
 await sceneDialog.getByLabel('Scene title',{exact:true}).fill(sceneTitle);
 await sceneDialog.getByLabel('Scene summary',{exact:true}).fill('A visitor finds the hidden archive.');
 await expect(sceneDialog.getByLabel('Chapter',{exact:true})).toHaveValue(chapter.id);
 const sceneSubmitted=page.waitForRequest(candidate=>candidate.url()===origin+'/api/scenes'&&candidate.method()==='POST');
 const sceneCreated=page.waitForResponse(response=>response.url()===origin+'/api/scenes'&&response.request().method()==='POST');
 await sceneDialog.getByRole('button',{name:'Create scene',exact:true}).click();
 const [submittedScene, createdScene]=await Promise.all([sceneSubmitted,sceneCreated]);
 expect(createdScene.status()).toBe(201);
 const scene=await readScene(request,(submittedScene.postDataJSON() as {id:string}).id);
 await expect(sceneDialog).toHaveCount(0);
 await expect(editor(page)).toBeVisible();
 await editor(page).fill('The door opened without a sound.');
 expect(textFrom((await readScene(request,scene.id)).content)).toBe('');
 await saveScene(page,scene.id);
 expect(await readScene(request,scene.id)).toMatchObject({chapterId:chapter.id,title:sceneTitle,contentSchemaVersion:1,version:2});
 await page.reload();
 await expect(editor(page)).toHaveText('The door opened without a sound.');
});

test('chapter card deletion confirms and removes its scenes while preserving the remaining manuscript',async({page,request})=>{
 const removed=await createChapter(request,'Delete chapter '+randomUUID()),retained=await createChapter(request,'Keep chapter '+randomUUID());
 const first=await createScene(request,removed,{content:documentFrom('First deleted scene.')}),second=await createScene(request,removed,{content:documentFrom('Second deleted scene.')}),survivor=await createScene(request,retained,{content:documentFrom('Keep this manuscript text.')});
 await page.goto('/chapters/?novel='+testNovelId);
 const removedCard=page.locator('article.writing-chapter-story-card').filter({has:page.getByRole('heading',{name:removed.title,exact:true})});
 const retainedCard=page.locator('article.writing-chapter-story-card').filter({has:page.getByRole('heading',{name:retained.title,exact:true})});
 await expect(removedCard).toContainText('2 scenes');
 await expect(retainedCard).toContainText('1 scene');
 const response=page.waitForResponse(candidate=>candidate.url()===origin+'/api/chapters/'+removed.id+'?novelId='+testNovelId&&candidate.request().method()==='DELETE');
 const confirmation=page.waitForEvent('dialog');
 const clicking=removedCard.getByRole('button',{name:'Delete chapter: '+removed.title,exact:true}).click();
 const dialog=await confirmation;
 expect(dialog.type()).toBe('confirm');
 expect(dialog.message()).toBe(`Delete chapter “${removed.title}” and all of its scenes?`);
 await dialog.accept();
 await clicking;
 const deleted=await response;
 expect(deleted.status()).toBe(204);
 expect(deleted.request().postDataJSON()).toEqual({version:removed.version});
 await expect(removedCard).toHaveCount(0);
 await expect(retainedCard).toBeVisible();
 await expect(retainedCard).toContainText('1 scene');
 expect((await request.get('/api/chapters/'+removed.id+'?novelId='+testNovelId)).status()).toBe(404);
 for(const scene of [first,second])expect((await request.get('/api/scenes/'+scene.id+'?novelId='+testNovelId)).status()).toBe(404);
 const chapterCatalog=await (await request.get('/api/chapters?novelId='+testNovelId)).json();
 expect(chapterCatalog.chapters).toEqual([expect.objectContaining({id:retained.id,title:retained.title})]);
 const sceneCatalog=await (await request.get('/api/scenes?novelId='+testNovelId)).json();
 expect(sceneCatalog.scenes).toEqual([expect.objectContaining({id:survivor.id,chapterId:retained.id})]);
 expect(await readScene(request,survivor.id)).toEqual(survivor);
 await page.reload();
 await expect(removedCard).toHaveCount(0);
 await expect(retainedCard).toContainText('1 scene');
});

test('an open scene tab refreshes when every chapter is deleted in another tab',async({page,request,context})=>{
 const first=await createChapter(request),second=await createChapter(request);
 const selected=await createScene(request,first),other=await createScene(request,second);
 await page.goto('/scenes/?novel='+testNovelId+'&scene='+selected.id);
 await expect(editor(page)).toHaveText(textFrom(selected.content));
 await expect(page.getByRole('button',{name:'Open scene: '+other.title,exact:true})).toBeVisible();
 const chaptersPage=await context.newPage();
 await chaptersPage.goto('/chapters/?novel='+testNovelId);
 for(const chapter of [first,second])await deleteChapterCard(chaptersPage,chapter);
 await expect(page.getByRole('button',{name:/^Open scene: /})).toHaveCount(0);
 await expect(editor(page)).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Every story begins somewhere.',exact:true})).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:'Opening scene…'})).toHaveCount(0);
 expect(new URL(page.url()).searchParams.has('scene')).toBe(false);
});

test('external chapter deletion keeps a dirty scene draft available to copy and disables saving',async({page,request,context})=>{
 const chapter=await createChapter(request),scene=await createScene(request,chapter);
 await page.goto('/scenes/?novel='+testNovelId+'&scene='+scene.id);
 await expect(editor(page)).toHaveText(textFrom(scene.content));
 const draft='Keep my unsaved words after the chapter is removed.';
 await editor(page).fill(draft);
 await expect(page.getByRole('button',{name:'Save scene',exact:true})).toBeEnabled();
 const chaptersPage=await context.newPage();
 await chaptersPage.goto('/chapters/?novel='+testNovelId);
 await deleteChapterCard(chaptersPage,chapter);
 await expect(page.getByRole('alert').filter({hasText:/deleted|removed/i})).toContainText(/copy/i);
 await expect(editor(page)).toHaveText(draft);
 await expect(editor(page)).toHaveAttribute('contenteditable','false');
 await expect(page.getByRole('button',{name:'Save scene',exact:true})).toBeDisabled();
 await editor(page).evaluate(element=>{
  const range=document.createRange();range.selectNodeContents(element);
  const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);
 });
 expect(await selectedText(editor(page))).toBe(draft);
 expect((await request.get('/api/scenes/'+scene.id)).status()).toBe(404);
});

test('another tab refreshes a clean scene without replacing an unsaved draft',async({page,request,context})=>{
 const scene=await createScene(request,await createChapter(request));
 await openScene(page,scene);
 const other=await context.newPage();
 await openScene(other,scene);
 await editor(other).fill('Saved prose from another tab.');
 await saveScene(other,scene.id);
 await expect(editor(page)).toHaveText('Saved prose from another tab.');
 await expect(page.locator('#scene-save-status')).toHaveText('Saved');

 await editor(page).fill('Keep this unsaved local draft.');
 await editor(page).evaluate(element=>{Reflect.set(window,'__localSceneEditor',element);});
 await editor(other).fill('A newer competing save.');
 await saveScene(other,scene.id);
 await expect(page.locator('#scene-save-status')).toHaveText('Unsaved changes');
 await expect(editor(page)).toHaveText('Keep this unsaved local draft.');
 expect(await editor(page).evaluate(element=>element===Reflect.get(window,'__localSceneEditor'))).toBe(true);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(editor(page)).toHaveText('Saved prose from another tab.');
 await page.getByRole('button',{name:'Redo',exact:true}).click();
 await expect(editor(page)).toHaveText('Keep this unsaved local draft.');
 expect(textFrom((await readScene(request,scene.id)).content)).toBe('A newer competing save.');
});

test('open references refresh after a workspace change in another tab',async({page,request,context})=>{
 const scene=await createScene(request,await createChapter(request));
 await openScene(page,scene);
 await page.getByRole('button',{name:'Show references',exact:true}).click();
 await page.getByRole('button',{name:'Browse the whole library',exact:true}).click();
 const panel=page.locator('#writing-references');
 await expect(panel).toContainText('Your whole library.');
 const name='Cross-tab reference '+randomUUID();
 const created=await request.post('/api/characters',{headers:{origin},data:{id:randomUUID(),name}});
 expect(created.status(),await created.text()).toBe(201);
 await expect(panel).not.toContainText(name);
 const other=await context.newPage();
 await other.goto('/scenes/?novel='+testNovelId);
 await other.evaluate(()=>localStorage.setItem('write-to-freedom:workspace-change',Date.now()+':'+Math.random()));
 await expect(panel).toContainText(name);
});

test('a chapters page restored from browser history refreshes its saved catalog',async({page,request})=>{
 const removed=await createChapter(request),retained=await createChapter(request);
 await createScene(request,removed);
 await page.goto('/chapters/?novel='+testNovelId);
 await expect(page.getByRole('heading',{name:removed.title,exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:retained.title,exact:true})).toBeVisible();
 const deleted=await request.delete('/api/chapters/'+removed.id+'?novelId='+testNovelId,{headers:{origin},data:{version:removed.version}});
 expect(deleted.status(),await deleted.text()).toBe(204);
 await expect(page.getByRole('heading',{name:removed.title,exact:true})).toBeVisible();
 const refreshed=page.waitForResponse(candidate=>new URL(candidate.url()).pathname==='/api/chapters'&&new URL(candidate.url()).searchParams.get('novelId')===testNovelId&&candidate.request().method()==='GET');
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 expect((await refreshed).status()).toBe(200);
 await expect(page.getByRole('heading',{name:removed.title,exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:retained.title,exact:true})).toBeVisible();
});

test('workspace refresh bypasses a browser cache that reuses catalog responses by URL',async({page,request})=>{
 const removed=await createChapter(request),retained=await createChapter(request);
 const cachedCatalogs=new Map<string,string>();
 await page.route('**/api/chapters?*',async route=>{
  const url=route.request().url();
  if(route.request().method()!=='GET'||new URL(url).pathname!=='/api/chapters'){await route.continue();return;}
  let body=cachedCatalogs.get(url);
  if(body===undefined){
   const response=await route.fetch();
   expect(response.status()).toBe(200);
   body=await response.text();cachedCatalogs.set(url,body);
  }
  // Reproduce a host cache that ignores no-store and keys only on the full URL.
  await route.fulfill({status:200,contentType:'application/json',headers:{'cache-control':'no-store'},body});
 });
 await page.goto('/chapters/?novel='+testNovelId);
 await expect(page.getByRole('heading',{name:removed.title,exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:retained.title,exact:true})).toBeVisible();
 const previousURLs=new Set(cachedCatalogs.keys());
 expect(previousURLs.size).toBeGreaterThan(0);
 const deleted=await request.delete('/api/chapters/'+removed.id+'?novelId='+testNovelId,{headers:{origin},data:{version:removed.version}});
 expect(deleted.status()).toBe(204);
 const refreshed=page.waitForResponse(candidate=>candidate.request().method()==='GET'&&new URL(candidate.url()).pathname==='/api/chapters');
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 const response=await refreshed;
 expect(response.status()).toBe(200);
 expect(previousURLs.has(response.url())).toBe(false);
 await expect(page.getByRole('heading',{name:removed.title,exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:retained.title,exact:true})).toBeVisible();
});

test('a lost create response and edited retry preserve the newer scene form without duplicates',async({page,request})=>{
 const chapter=await createChapter(request);
 await page.goto('/scenes/?novel='+testNovelId);
 await page.getByRole('button',{name:'New scene',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'New scene',exact:true});
 const firstTitle='Initial request '+randomUUID(),latestTitle='Revised request '+randomUUID();
 await dialog.getByLabel('Scene title',{exact:true}).fill(firstTitle);
 await dialog.getByLabel('Scene summary',{exact:true}).fill('The first submitted summary.');
 await dialog.getByLabel('Chapter',{exact:true}).selectOption(chapter.id);
 let committed:Scene|undefined;
 await page.route('**/api/scenes',async route=>{
  const response=await route.fetch();
  expect(response.status()).toBe(201);
  committed=await response.json();
  // The Worker has committed the insert; only its response is lost in transit.
  await route.abort('failed');
 },{times:1});
 await dialog.getByRole('button',{name:'Create scene',exact:true}).click();
 await expect(dialog.getByRole('alert')).toBeVisible();
 expect(committed).toBeDefined();
 expect((await readScene(request,committed!.id)).title).toBe(firstTitle);
 await dialog.getByLabel('Scene title',{exact:true}).fill(latestTitle);
 await dialog.getByLabel('Scene summary',{exact:true}).fill('The revised summary must survive the retry.');
 await dialog.getByRole('button',{name:'Create scene',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(latestTitle);
 expect(await readScene(request,committed!.id)).toMatchObject({title:latestTitle,summary:'The revised summary must survive the retry.'});
 const catalog=await (await request.get('/api/scenes')).json();
 expect(catalog.scenes.filter((scene:Scene)=>scene.id===committed!.id)).toHaveLength(1);
 expect(new URL(page.url()).searchParams.get('scene')).toBe(committed!.id);
});

test('toolbar and keyboard formatting preserve selection, undo history and saved JSON',async({page,request},testInfo)=>{
 const scene=await createScene(request,await createChapter(request),{content:documentFrom('A quiet beginning.','A second thought.')});
 await openScene(page,scene);
 const text=editor(page);
 await text.click();
 await text.press('ControlOrMeta+a');
 const selected=await selectedText(text);
 expect(selected).toContain('A quiet beginning.');
 await page.getByRole('button',{name:'Bold',exact:true}).click();
 expect(await selectedText(text)).toBe(selected);
 await expect(text.locator('strong')).toHaveCount(2);
 await page.keyboard.press('ControlOrMeta+i');
 await expect(text.locator('em')).toHaveCount(2);
 expect(await selectedText(text)).toBe(selected);
 const formatted=await text.innerHTML();
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 expect(await text.innerHTML()).not.toBe(formatted);
 await page.getByRole('button',{name:'Redo',exact:true}).click();
 expect(await text.innerHTML()).toBe(formatted);
 const mutation=page.waitForRequest(request=>request.url()===origin+'/api/scenes/'+scene.id&&request.method()==='PUT');
 const saved=await saveScene(page,scene.id,true);
 await expect(text).toBeFocused();
 expect(await selectedText(text)).toBe(selected);
 const submitted=await mutation;
 expect(saved.content).toEqual(submitted.postDataJSON().content);
 expect(textFrom(saved.content)).toBe('A quiet beginning.\nA second thought.');
 expect((await readScene(request,scene.id)).content).toEqual(saved.content);
 await page.reload();
 await expect(text.locator('strong')).toHaveCount(2);
 await expect(text.locator('em')).toHaveCount(2);
 expect(await text.innerHTML()).toBe(formatted);
 await page.screenshot({path:testInfo.outputPath('writing-workspace-desktop.png'),fullPage:true});
});

test('scene properties and writing controls stay compact and clear during a long scene',async({page,request},testInfo)=>{
 await page.setViewportSize({width:1198,height:866});
 const chapter=await createChapter(request,'The Madness is Never Madness');
 const scene=await createScene(request,chapter,{title:'Shrimp & Okra',content:manuscript(1200)});
 await openScene(page,scene);

 const form=page.locator('.writing-scene-form');
 const title=page.getByRole('textbox',{name:'Scene title',exact:true});
 const properties=form.locator('.writing-scene-meta');
 const chapterControl=properties.getByRole('combobox',{name:'Scene chapter',exact:true});
 const statusControl=properties.getByRole('combobox',{name:'Scene status',exact:true});
 const summaryControl=properties.locator('summary');
 const save=page.getByRole('button',{name:'Save scene',exact:true});
 const canvas=page.locator('.writing-editor:not(.writing-editor-inline)');
 const toolbar=canvas.getByRole('toolbar',{name:'Text formatting'});
 const viewbar=page.locator('.writing-viewbar');
 await expect(chapterControl).toHaveValue(chapter.id);
 await expect(statusControl).toHaveValue('draft');
 await expect(summaryControl).toHaveText('Scene summary');
 await expect(form.locator('.writing-scene-heading')).toContainText('Save scene');
 await expect(form).toHaveAttribute('data-dirty','false');

 const titleBox=await title.boundingBox(),propertiesBox=await properties.boundingBox();
 const chapterBox=await chapterControl.boundingBox(),statusBox=await statusControl.boundingBox(),summaryBox=await summaryControl.boundingBox();
 const canvasBox=await canvas.boundingBox(),toolbarBox=await toolbar.boundingBox();
 expect(titleBox&&propertiesBox&&chapterBox&&statusBox&&summaryBox&&canvasBox&&toolbarBox).toBeTruthy();
 expect(propertiesBox!.y).toBeGreaterThanOrEqual(titleBox!.y+titleBox!.height-3);
 expect(propertiesBox!.y-(titleBox!.y+titleBox!.height)).toBeLessThan(24);
 expect(Math.max(chapterBox!.y,statusBox!.y,summaryBox!.y)-Math.min(chapterBox!.y,statusBox!.y,summaryBox!.y)).toBeLessThan(16);
 expect(Math.abs(toolbarBox!.y-canvasBox!.y)).toBeLessThan(8);
 expect(toolbarBox!.x).toBeGreaterThanOrEqual(canvasBox!.x-2);
 expect(toolbarBox!.x+toolbarBox!.width).toBeLessThanOrEqual(canvasBox!.x+canvasBox!.width+2);
 await page.screenshot({path:testInfo.outputPath('scene-layout-desktop-header.png')});

 const cleanBackground=await save.evaluate(element=>getComputedStyle(element).backgroundColor);
 expect(cleanBackground).toMatch(/^rgba\(/);
 await page.evaluate(()=>window.scrollTo(0,500));
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(300);
 const sticky=await viewbar.evaluate(element=>{
  const style=getComputedStyle(element),bounds=element.getBoundingClientRect();
  const blur=style.backdropFilter==='none'?style.getPropertyValue('-webkit-backdrop-filter'):style.backdropFilter;
  return {position:style.position,blur,top:parseFloat(style.top),y:bounds.y,bottom:bounds.bottom};
 });
 expect(sticky.position).toBe('sticky');
 expect(sticky.blur).toContain('blur(');
 expect(Math.abs(sticky.y-sticky.top)).toBeLessThan(5);
 const scrolledToolbar=await toolbar.boundingBox();
 expect(scrolledToolbar).not.toBeNull();
 expect(scrolledToolbar!.y).toBeGreaterThanOrEqual(sticky.bottom-2);
 await page.screenshot({path:testInfo.outputPath('scene-layout-desktop.png'),fullPage:true});

 await title.fill('Shrimp & Okra revised');
 await expect(form).toHaveAttribute('data-dirty','true');
 await expect.poll(()=>save.evaluate(element=>getComputedStyle(element).backgroundColor)).toMatch(/^rgb\(/);
 const dirtyBackground=await save.evaluate(element=>getComputedStyle(element).backgroundColor);
 expect(dirtyBackground).not.toBe(cleanBackground);

 await page.setViewportSize({width:390,height:844});
 await title.evaluate(element=>window.scrollTo(0,Math.max(0,window.scrollY+element.getBoundingClientRect().top-165)));
 await expect(chapterControl).toBeVisible();
 await expect(statusControl).toBeVisible();
 await expect(summaryControl).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('scene-layout-mobile-header.png')});
 await toolbar.scrollIntoViewIfNeeded();
 await expect(toolbar).toBeVisible();
 const mobile=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
 expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.width+1);
 const mobileCanvas=await canvas.boundingBox(),mobileToolbar=await toolbar.boundingBox();
 expect(mobileCanvas&&mobileToolbar).toBeTruthy();
 expect(Math.abs(mobileToolbar!.y-mobileCanvas!.y)).toBeLessThan(8);
 await page.screenshot({path:testInfo.outputPath('scene-layout-mobile.png'),fullPage:true});
});

test('rich HTML paste keeps supported prose and drops executable or unsupported elements',async({page,request})=>{
 const scene=await createScene(request,await createChapter(request),{content:documentFrom('')});
 await openScene(page,scene);
 await editor(page).click();
 await editor(page).evaluate(element=>{
  const clipboard=new DataTransfer();
  clipboard.setData('text/html','<h2>Imported research</h2><p onclick="window.__unsafePaste=true">Clean <strong>bold</strong> and <em>italic</em> <a href="javascript:alert(1)">linked words</a>.</p><script>window.__unsafePaste=true</script><style>body{display:none}</style><iframe src="https://example.com"></iframe><img src="x" onerror="window.__unsafePaste=true">');
  clipboard.setData('text/plain','Imported research\nClean bold and italic linked words.');
  element.dispatchEvent(new ClipboardEvent('paste',{clipboardData:clipboard,bubbles:true,cancelable:true}));
 });
 await expect(editor(page)).toContainText('Imported research');
 await expect(editor(page).locator('h2')).toHaveText('Imported research');
 await expect(editor(page).locator('strong')).toHaveText('bold');
 await expect(editor(page).locator('script,style,iframe,img,a,[onclick],[onerror]')).toHaveCount(0);
 expect(await page.evaluate(()=>Boolean(Reflect.get(window,'__unsafePaste')))).toBe(false);
 const saved=await saveScene(page,scene.id);
 expect(JSON.stringify(saved.content)).not.toMatch(/unsafePaste|javascript:|onclick|onerror|<script|iframe/);
 expect(textFrom(saved.content)).toContain('Clean bold and italic linked words.');
 await page.reload();
 await expect(editor(page).locator('h2')).toHaveText('Imported research');
 await expect(editor(page).locator('script,style,iframe,img,a')).toHaveCount(0);
});

for(const failure of ['network','server'] as const)test(`${failure} save failure retains the rich-text draft and permits retry`,async({page,request})=>{
 const scene=await createScene(request,await createChapter(request));
 await openScene(page,scene);
 await editor(page).fill('Retain this '+failure+' draft.');
 await editor(page).press('ControlOrMeta+a');
 await page.getByRole('button',{name:'Bold',exact:true}).click();
 await page.route('**/api/scenes/'+scene.id,async route=>{
  if(failure==='network')await route.abort('failed');
  else await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'The scene could not be saved. Please try again.'})});
 },{times:1});
 await page.getByRole('button',{name:'Save scene',exact:true}).click();
 await expect(page.locator('#scene-save-status')).toContainText('Not saved');
 await expect(page.locator('#scene-error')).toBeVisible();
 await expect(editor(page)).toHaveText('Retain this '+failure+' draft.');
 await expect(editor(page).locator('strong')).toHaveText('Retain this '+failure+' draft.');
 await expect(editor(page)).toHaveAttribute('contenteditable','true');
 expect((await readScene(request,scene.id)).content).toEqual(scene.content);
 const saved=await saveScene(page,scene.id);
 expect(textFrom(saved.content)).toBe('Retain this '+failure+' draft.');
 await page.reload();
 await expect(editor(page).locator('strong')).toHaveText('Retain this '+failure+' draft.');
});

test('a genuine version conflict protects both the competing saved scene and the local rich draft',async({page,request})=>{
 const scene=await createScene(request,await createChapter(request));
 await openScene(page,scene);
 await editor(page).fill('An unsaved first-tab draft.');
 const competing=await request.put('/api/scenes/'+scene.id,{headers:{origin},data:{...scene,content:documentFrom('The competing tab saved this.')}});
 expect(competing.status(),await competing.text()).toBe(200);
 const rejected=page.waitForResponse(response=>response.url()===origin+'/api/scenes/'+scene.id&&response.request().method()==='PUT');
 await page.getByRole('button',{name:'Save scene',exact:true}).click();
 expect((await rejected).status()).toBe(409);
 await expect(page.locator('#scene-error')).toContainText(/changed|another tab|reload/i);
 await expect(editor(page)).toHaveText('An unsaved first-tab draft.');
 await expect(editor(page)).toHaveAttribute('contenteditable','true');
 expect(await readScene(request,scene.id)).toMatchObject({version:2,content:documentFrom('The competing tab saved this.')});
});

test('scene switches retain independent drafts and undo history while panels retain editor selection',async({page,request})=>{
 const chapter=await createChapter(request),first=await createScene(request,chapter,{title:'First scene '+randomUUID()}),second=await createScene(request,chapter,{title:'Second scene '+randomUUID(),content:documentFrom('The second scene begins here.')});
 await openScene(page,first);
 await editor(page).fill('An independent first-scene draft.');
 await editor(page).press('ControlOrMeta+a');
 const selection=await selectedText(editor(page));
 await editor(page).evaluate(element=>{Reflect.set(window,'__originalSceneEditor',element);});
 for(const panel of ['references','outline']){
  const hide=page.getByRole('button',{name:'Hide '+panel,exact:true});
  if(await hide.count())await hide.click();
  else await page.getByRole('button',{name:'Show '+panel,exact:true}).click();
  expect(await selectedText(editor(page))).toBe(selection);
  expect(await editor(page).evaluate(element=>element===Reflect.get(window,'__originalSceneEditor'))).toBe(true);
  const show=page.getByRole('button',{name:'Show '+panel,exact:true});
  if(await show.count())await show.click();
 }
 await page.getByRole('button',{name:'Open scene: '+second.title,exact:true}).click();
 await expect(editor(page)).toHaveText('The second scene begins here.');
 await editor(page).fill('An independent second-scene draft.');
 await page.getByRole('button',{name:'Open scene: '+first.title,exact:true}).click();
 await expect(editor(page)).toHaveText('An independent first-scene draft.');
 await expect.poll(()=>selectedText(editor(page))).toBe(selection);
 expect(await editor(page).evaluate(element=>element===Reflect.get(window,'__originalSceneEditor'))).toBe(true);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(editor(page)).toHaveText('The first line of the scene.');
 await page.getByRole('button',{name:'Redo',exact:true}).click();
 await expect(editor(page)).toHaveText('An independent first-scene draft.');
 await saveScene(page,first.id);
 await page.getByRole('button',{name:'Open scene: '+second.title,exact:true}).click();
 await expect(editor(page)).toHaveText('An independent second-scene draft.');
 await saveScene(page,second.id);
 expect(textFrom((await readScene(request,first.id)).content)).toBe('An independent first-scene draft.');
 expect(textFrom((await readScene(request,second.id)).content)).toBe('An independent second-scene draft.');
});

function manuscript(words:number):RichNode{
 const vocabulary=['Across','the','winter','valley','a','traveler','followed','quiet','voices','toward','an','old','archive','where','stories','waited','for','someone','to','listen'];
 const tokens=Array.from({length:words},(_,index)=>index===words-1?'FINISH':vocabulary[index%vocabulary.length]);
 return documentFrom(...Array.from({length:Math.ceil(words/50)},(_,index)=>tokens.slice(index*50,index*50+50).join(' ')));
}
async function measured(page:Page,action:()=>Promise<unknown>):Promise<number>{
 const start=await page.evaluate(()=>performance.now());
 await action();
 const end=await page.evaluate(()=>new Promise<number>(resolve=>requestAnimationFrame(()=>resolve(performance.now()))));
 return end-start;
}
test('a 10000-word manuscript remains responsive against a 500-word baseline',async({page,request},testInfo)=>{
 const chapter=await createChapter(request),metrics:Array<Record<string,number>>=[];
 for(const words of [500,10000]){
  const scene=await createScene(request,chapter,{content:manuscript(words)});
  const started=performance.now();
  await openScene(page,scene);
  const readyMs=performance.now()-started;
  expect((await editor(page).innerText()).trim().split(/\s+/)).toHaveLength(words);
  // Place the native caret after the final block without timing a long scroll
  // or relying on platform-specific Home/End handling of an AllSelection.
  await editor(page).evaluate(element=>{
   (element as HTMLElement).focus();
   const range=document.createRange();range.selectNodeContents(element);range.collapse(false);
   const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);
   document.dispatchEvent(new Event('selectionchange'));
  });
  await expect.poll(()=>editor(page).evaluate(()=>window.getSelection()?.isCollapsed)).toBe(true);
  const keys:number[]=[];
  for(const key of ['Space',...'responsive'])keys.push(await measured(page,()=>page.keyboard.press(key)));
  const sorted=[...keys].sort((a,b)=>a-b),typingP95Ms=sorted[Math.ceil(sorted.length*.95)-1],typingMedianMs=sorted[Math.floor(sorted.length/2)];
  await editor(page).press('ControlOrMeta+Shift+ArrowLeft');
  const selection=await selectedText(editor(page));
  const formatMs=await measured(page,()=>page.getByRole('button',{name:'Bold',exact:true}).click());
  expect(await selectedText(editor(page))).toBe(selection);
  const references=page.getByRole('button',{name:/^(Show|Hide) references$/});
  const referencesMs=await measured(page,()=>references.click());
  expect(await selectedText(editor(page))).toBe(selection);
  const outlineMs=await measured(page,()=>page.getByRole('button',{name:/^(Show|Hide) outline$/}).click());
  expect(await selectedText(editor(page))).toBe(selection);
  const saved=await saveScene(page,scene.id);
  expect(textFrom(saved.content).trim().split(/\s+/)).toHaveLength(words+1);
  expect(textFrom(saved.content)).toMatch(/FINISH responsive$/);
  metrics.push({words,readyMs,typingMedianMs,typingP95Ms,formatMs,referencesMs,outlineMs});
 }
 const [baseline,target]=metrics;
 const report={measurement:'Chromium end-to-end actions through the next animation frame; includes Playwright round trips.',limits:{readyMs:5000,typingP95Ms:250,formatAndPanelMs:750},baseline,target,typingP95Ratio:target.typingP95Ms/baseline.typingP95Ms};
 const reportPath=testInfo.outputPath('writing-performance.json');
 await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 await testInfo.attach('writing-performance',{path:reportPath,contentType:'application/json'});
 console.log('Writing performance '+JSON.stringify(report));
 expect(target.readyMs).toBeLessThan(5000);
 expect(target.typingP95Ms).toBeLessThan(250);
 for(const key of ['formatMs','referencesMs','outlineMs'])expect(target[key],key).toBeLessThan(750);
});

test('the narrow workspace keeps writing and formatting controls reachable by keyboard',async({page,request},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 const scene=await createScene(request,await createChapter(request));
 await openScene(page,scene);
 await editor(page).fill('A scene written on a narrow screen.');
 await editor(page).press('ControlOrMeta+a');
 const bold=page.getByRole('button',{name:'Bold',exact:true});
 await bold.focus();
 await page.keyboard.press('ArrowRight');
 await expect(page.getByRole('button',{name:'Italic',exact:true})).toBeFocused();
 await page.keyboard.press('ArrowLeft');
 await expect(bold).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(editor(page).locator('strong')).toHaveText('A scene written on a narrow screen.');
 await saveScene(page,scene.id);
 const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
 expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width+1);
 await page.screenshot({path:testInfo.outputPath('writing-workspace-mobile.png'),fullPage:true});
});
