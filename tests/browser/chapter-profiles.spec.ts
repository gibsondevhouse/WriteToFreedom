import {randomUUID} from 'node:crypto';
import {test,expect,type APIRequestContext,type Page,type Locator} from '@playwright/test';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
interface Novel{id:string;title:string;version:number}
interface Chapter{id:string;novelId:string;title:string;summary:string;version:number}
interface RichNode{type:string;text?:string;marks?:Array<{type:string}>;attrs?:Record<string,unknown>;content?:RichNode[]}
interface Scene{id:string;chapterId:string;title:string;content:RichNode;version:number}
const documentFrom=(prose:string):RichNode=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:prose}]}]});
const bookArtwork='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><defs><linearGradient id="night" x2="1" y2="1"><stop stop-color="#233c4c"/><stop offset="1" stop-color="#0d171e"/></linearGradient></defs><rect width="400" height="600" fill="url(#night)"/><rect x="20" y="20" width="360" height="560" fill="none" stroke="#a38b5c"/><path d="M65 410 180 220 325 410M80 425h240" fill="none" stroke="#a38b5c" stroke-width="2"/><circle cx="265" cy="175" r="35" fill="none" stroke="#a38b5c" stroke-width="2"/><text x="200" y="90" fill="#e6dcc4" font-family="Georgia,serif" font-size="35" text-anchor="middle">THE WINTER</text><text x="200" y="135" fill="#e6dcc4" font-family="Georgia,serif" font-size="35" text-anchor="middle">ARCHIVE</text><text x="200" y="530" fill="#a38b5c" font-family="Georgia,serif" font-size="19" text-anchor="middle">MARA VALE</text></svg>';
async function createNovel(request:APIRequestContext):Promise<Novel>{
 const response=await request.post('/api/novels',{headers:{origin},data:{id:randomUUID(),title:'Chapter profiles '+randomUUID()}});
 expect(response.status(),await response.text()).toBe(201);return response.json();
}
async function createChapter(request:APIRequestContext,novel:Novel):Promise<Chapter>{
 const response=await request.post('/api/chapters',{headers:{origin},data:{id:randomUUID(),novelId:novel.id,title:'Chapter '+randomUUID(),summary:'The saved chapter outline.'}});
 expect(response.status(),await response.text()).toBe(201);return response.json();
}
async function createScene(request:APIRequestContext,chapter:Chapter,content:RichNode=documentFrom('Saved scene prose.')):Promise<Scene>{
 const response=await request.post('/api/scenes',{headers:{origin},data:{id:randomUUID(),chapterId:chapter.id,title:'Scene '+randomUUID(),summary:'The saved scene outline.',status:'draft',contentSchemaVersion:1,content}});
 expect(response.status(),await response.text()).toBe(201);return response.json();
}
function saveResponse(page:Page,chapter:Chapter){return page.waitForResponse(response=>new URL(response.url()).pathname==='/api/chapters/'+chapter.id&&response.request().method()==='PUT');}
const inlineScene=(page:Page,scene:Scene)=>page.locator('.chapter-inline-scene[data-scene-id="'+scene.id+'"]');
const sceneEditor=(article:Locator)=>article.getByRole('textbox',{name:'Scene text',exact:true});
const sceneSaveResponse=(page:Page,scene:Scene)=>page.waitForResponse(response=>new URL(response.url()).pathname==='/api/scenes/'+scene.id&&response.request().method()==='PUT');
async function expectLandscape(image:Locator){
 await expect(image).toBeVisible();const box=await image.boundingBox();expect(box).not.toBeNull();
 expect(Math.abs(box!.width/box!.height-16/9)).toBeLessThan(.025);
}
async function expectWrappingTitle(page:Page){
 const title=page.getByRole('textbox',{name:'Chapter title',exact:true});
 expect(await title.evaluate(element=>element.tagName)).toBe('TEXTAREA');
 expect(await title.evaluate(element=>element.scrollWidth<=element.clientWidth+1&&element.scrollHeight<=element.clientHeight+1)).toBe(true);
}
async function expectCardContents(card:Locator){
 await expectLandscape(card);const bounds=(await card.boundingBox())!;
 for(const child of ['.chapter-scene-cover-well','.chapter-scene-card-copy','.chapter-scene-card-summary']){
  const box=await card.locator(child).boundingBox();expect(box,child).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(bounds.x-1);expect(box!.y).toBeGreaterThanOrEqual(bounds.y-1);
  expect(box!.x+box!.width).toBeLessThanOrEqual(bounds.x+bounds.width+1);expect(box!.y+box!.height).toBeLessThanOrEqual(bounds.y+bounds.height+1);
 }
}

test('chapter cards open profiles with safe rich prose and landscape images above inline scene editors',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel);
 const content:RichNode={type:'doc',content:[
  {type:'heading',attrs:{level:2},content:[{type:'text',text:'The winter archive'}]},
  {type:'paragraph',content:[{type:'text',text:'A <script>window.profileUnsafe=true</script> & secret',marks:[{type:'bold'},{type:'italic'}]},{type:'hardBreak'},{type:'text',text:'Second line'}]},
  {type:'blockquote',content:[{type:'paragraph',content:[{type:'text',text:'Remember the treaty.'}]}]},
  {type:'orderedList',attrs:{start:3,type:'A'},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Third entry'}]}]}]},
 ]};
 const scene=await createScene(request,chapter,content),otherNovel=await createNovel(request),otherChapter=await createChapter(request,otherNovel);
 const privateScene=await createScene(request,otherChapter,documentFrom('Other manuscript must stay private.'));
 await page.goto('/chapters/?novel='+novel.id);
 const card=page.locator('article.writing-chapter-story-card').filter({has:page.getByRole('heading',{name:chapter.title,exact:true})});
 await expect(card.getByRole('link',{name:'Open chapter profile: '+chapter.title,exact:true}).first()).toHaveAttribute('href','/chapters/'+chapter.id+'/?novel='+novel.id);
 await card.getByRole('link',{name:'Open chapter profile: '+chapter.title,exact:true}).first().click();
 await expect(page).toHaveURL(origin+'/chapters/'+chapter.id+'/?novel='+novel.id);
 await expect(page.locator('#profile-form')).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Chapter title',exact:true})).toHaveValue(chapter.title);
 const article=inlineScene(page,scene),editor=sceneEditor(article);
 await expect(editor).toBeVisible();
 await expect(editor.locator('h2').filter({hasText:'The winter archive'})).toBeVisible();
 await expect(editor.locator('strong em, em strong')).toContainText('A <script>window.profileUnsafe=true</script> & secret');
 await expect(editor.locator('blockquote')).toHaveText('Remember the treaty.');
 await expect(editor.locator('ol')).toHaveAttribute('start','3');
 await expect(editor.locator('ol')).toHaveAttribute('type','A');
 expect(await page.evaluate(()=>Object.hasOwn(window,'profileUnsafe'))).toBe(false);
 await expect(page.locator('#chapter-scenes-editor')).not.toContainText('Other manuscript must stay private.');
 await expect(page.locator('#scenes')).not.toContainText(privateScene.title);
 await expect(page.locator('#manuscript')).toHaveCount(0);
 await expect(page.locator('#scenes').getByRole('link',{name:/Write scenes|Write scene/})).toHaveCount(0);
 await expectLandscape(article.locator('.chapter-scene-image'));
 expect((await article.locator('.chapter-scene-image').boundingBox())!.y).toBeLessThan((await editor.boundingBox())!.y);
 await expectWrappingTitle(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/wtf-chapter-profile-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expectWrappingTitle(page);await expectLandscape(article.locator('.chapter-scene-image'));
 await page.screenshot({path:'/tmp/wtf-chapter-profile-mobile.png',fullPage:true});
 await expect(article.getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(scene.title);
 await expect(page.locator('.workspace-context')).toContainText(novel.title);
});

test('chapter profile title and outline edits save their revision and persist after reload',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),scene=await createScene(request,chapter);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const title='The sealed letter that led the keeper of forgotten things through the winter archive and into the sleeping city '+randomUUID().slice(0,8),summary='A revised outline with <literal> characters & punctuation.';
 await page.getByRole('textbox',{name:'Chapter title',exact:true}).fill(title);
 await expectWrappingTitle(page);
 await page.getByRole('textbox',{name:'Chapter summary',exact:true}).fill(summary);
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 const saved=saveResponse(page,chapter);
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 const response=await saved;expect(response.status(),await response.text()).toBe(200);
 expect(response.request().postDataJSON()).toMatchObject({title,summary,version:chapter.version});
 await expect(page.locator('#save-status')).toHaveText('Saved');
 await page.reload();
 await expect(page.getByRole('textbox',{name:'Chapter title',exact:true})).toHaveValue(title);
 await expect(page.getByRole('textbox',{name:'Chapter summary',exact:true})).toHaveValue(summary);
 await page.setViewportSize({width:390,height:844});await expectWrappingTitle(page);
 const titleBox=await page.getByRole('textbox',{name:'Chapter title',exact:true}).boundingBox();
 expect(titleBox!.height).toBeGreaterThan(40);
 const persisted=await (await request.get('/api/chapters/'+chapter.id)).json();
 expect(persisted).toMatchObject({title,summary,novelId:novel.id,version:chapter.version+1});
 expect((await (await request.get('/api/scenes/'+scene.id)).json()).content).toEqual(scene.content);
 await page.goto('/chapters/?novel='+novel.id);
 await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
});

test('a stale chapter profile save retains its local title and summary without replacing the newer revision',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const localTitle='My unsaved chapter '+randomUUID(),localSummary='Keep the unsaved outline on this page.';
 await page.getByRole('textbox',{name:'Chapter title',exact:true}).fill(localTitle);
 await page.getByRole('textbox',{name:'Chapter summary',exact:true}).fill(localSummary);
 const updated=await request.put('/api/chapters/'+chapter.id,{headers:{origin},data:{version:chapter.version,title:'Newer chapter in another tab',summary:'The newer saved outline.'}});
 expect(updated.status(),await updated.text()).toBe(200);
 const saved=saveResponse(page,chapter);
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 const conflict=await saved;expect(conflict.status()).toBe(409);
 await expect(page.locator('#editor-error')).toContainText(/changed in another tab|conflict/i);
 await expect(page.locator('#save-status')).toHaveText('Not saved — your changes are still here');
 await expect(page.getByRole('textbox',{name:'Chapter title',exact:true})).toHaveValue(localTitle);
 await expect(page.getByRole('textbox',{name:'Chapter summary',exact:true})).toHaveValue(localSummary);
 const stored=await (await request.get('/api/chapters/'+chapter.id)).json();
 expect(stored).toMatchObject({title:'Newer chapter in another tab',summary:'The newer saved outline.',version:chapter.version+1});
});

test('an empty chapter profile creates its first scene without leaving its inline workspace',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const profile=page.url();
 await expectLandscape(page.locator('#chapter-scenes-editor .chapter-scene-image'));
 await expect(page.locator('#chapter-scene-count')).toHaveText('0');
 await page.getByRole('button',{name:'Add scene',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'New scene',exact:true});await expect(dialog).toBeVisible();
 const sceneTitle='First profile scene '+randomUUID();
 await dialog.getByLabel('Scene title',{exact:true}).fill(sceneTitle);
 await dialog.getByLabel('Scene summary',{exact:true}).fill('A first scene from its chapter profile.');
 const created=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/scenes'&&response.request().method()==='POST');
 await dialog.getByRole('button',{name:'Create scene',exact:true}).click();
 const response=await created;expect(response.status(),await response.text()).toBe(201);const scene=await response.json();
 expect(scene.chapterId).toBe(chapter.id);
 await expect(page).toHaveURL(profile);await expect(dialog).toHaveCount(0);
 const article=inlineScene(page,scene);await expect(article.getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(sceneTitle);
 await expect(sceneEditor(article)).toBeVisible();await expectLandscape(article.locator('.chapter-scene-image'));
 await expect(page.locator('#chapter-scene-count')).toHaveText('1');
 await page.reload();
 await expect(inlineScene(page,scene).getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(sceneTitle);
 const catalog=await (await request.get('/api/scenes?novelId='+novel.id+'&chapterId='+chapter.id)).json();
 expect(catalog.scenes.map((row:Scene)=>row.id)).toEqual([scene.id]);
});

test('inline scene editing persists rich prose and metadata while retaining the independent chapter draft',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),scene=await createScene(request,chapter);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const article=inlineScene(page,scene),editor=sceneEditor(article);
 await expect(editor).toBeVisible();
 const chapterDraft='An unsaved chapter outline that remains separate from scene edits.';
 const sceneTitle='The lantern at the archive door',sceneSummary='A visitor arrives with a letter for Mara.',prose='The last lantern trembled when Mara opened the archive door.';
 await article.getByRole('textbox',{name:'Scene title',exact:true}).fill(sceneTitle);
 await article.getByRole('textbox',{name:'Scene summary',exact:true}).fill(sceneSummary);
 await article.getByRole('combobox',{name:'Scene status',exact:true}).selectOption('revising');
 await editor.fill(prose);await editor.press('ControlOrMeta+a');await editor.press('ControlOrMeta+b');
 await expect(editor.locator('strong')).toHaveText(prose);
 await expect(page.locator('#save-status')).toHaveText('Saved');
 await page.getByRole('textbox',{name:'Chapter summary',exact:true}).fill(chapterDraft);
 const saved=sceneSaveResponse(page,scene);await article.getByRole('button',{name:'Save scene',exact:true}).click();
 const response=await saved;expect(response.status(),await response.text()).toBe(200);
 const record=await response.json();expect(record).toMatchObject({chapterId:chapter.id,title:sceneTitle,summary:sceneSummary,status:'revising',version:scene.version+1});
 expect(record.content).toEqual({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:prose,marks:[{type:'bold'}]}]}]});
 await expect(article.getByRole('status')).toHaveText('Saved');
 await expect(page.getByRole('textbox',{name:'Chapter summary',exact:true})).toHaveValue(chapterDraft);
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 expect(await (await request.get('/api/chapters/'+chapter.id)).json()).toEqual(chapter);
 const chapterSaved=saveResponse(page,chapter);await page.getByRole('button',{name:'Save changes',exact:true}).click();
 expect((await chapterSaved).status()).toBe(200);
 await page.reload();
 const reloaded=inlineScene(page,scene);
 await expect(reloaded.getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(sceneTitle);
 await expect(reloaded.getByRole('textbox',{name:'Scene summary',exact:true})).toHaveValue(sceneSummary);
 await expect(reloaded.getByRole('combobox',{name:'Scene status',exact:true})).toHaveValue('revising');
 await expect(sceneEditor(reloaded).locator('strong')).toHaveText(prose);
 expect((await (await request.get('/api/scenes/'+scene.id)).json()).version).toBe(scene.version+1);
});

test('an inline scene conflict protects newer prose and retains drafts in every scene',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),first=await createScene(request,chapter),second=await createScene(request,chapter);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const firstArticle=inlineScene(page,first),secondArticle=inlineScene(page,second);
 const firstDraft='Keep this unsaved scene beside the conflicting scene.',localProse='My unsaved version of the second scene.',localTitle='My unsaved second scene',localSummary='A local scene outline.';
 await sceneEditor(firstArticle).fill(firstDraft);
 await sceneEditor(secondArticle).fill(localProse);
 await secondArticle.getByRole('textbox',{name:'Scene title',exact:true}).fill(localTitle);
 await secondArticle.getByRole('textbox',{name:'Scene summary',exact:true}).fill(localSummary);
 const updated=await request.put('/api/scenes/'+second.id,{headers:{origin},data:{version:second.version,title:'Newer second scene',content:documentFrom('The newer saved prose from another tab.')}});
 expect(updated.status(),await updated.text()).toBe(200);
 const conflicting=sceneSaveResponse(page,second);await secondArticle.getByRole('button',{name:'Save scene',exact:true}).click();
 const response=await conflicting;expect(response.status()).toBe(409);
 await expect(secondArticle.getByRole('alert')).toContainText(/changed in another tab|conflict/i);
 await expect(sceneEditor(secondArticle)).toHaveText(localProse);
 await expect(secondArticle.getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(localTitle);
 await expect(secondArticle.getByRole('textbox',{name:'Scene summary',exact:true})).toHaveValue(localSummary);
 await expect(sceneEditor(firstArticle)).toHaveText(firstDraft);
 const stored=await (await request.get('/api/scenes/'+second.id)).json();
 expect(stored).toMatchObject({title:'Newer second scene',version:second.version+1,content:documentFrom('The newer saved prose from another tab.')});
 expect((await (await request.get('/api/scenes/'+first.id)).json()).content).toEqual(first.content);
 const saved=sceneSaveResponse(page,first);await firstArticle.getByRole('button',{name:'Save scene',exact:true}).click();expect((await saved).status()).toBe(200);
 await expect(sceneEditor(secondArticle)).toHaveText(localProse);
});

test('the inline scene save shortcut preserves an unsaved chapter draft and saves only scene prose',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),scene=await createScene(request,chapter);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const article=inlineScene(page,scene),editor=sceneEditor(article);
 await expect(editor).toBeVisible();
 const metadataDraft='This chapter outline must stay unsaved when I save the scene.',prose='Mara folded the letter and reached for the missing map.';
 await page.getByRole('textbox',{name:'Chapter summary',exact:true}).fill(metadataDraft);
 await editor.fill(prose);
 const chapterWrites:string[]=[];
 page.on('request',candidate=>{if(new URL(candidate.url()).pathname==='/api/chapters/'+chapter.id&&candidate.method()==='PUT')chapterWrites.push(candidate.url());});
 const saved=sceneSaveResponse(page,scene);await editor.press('ControlOrMeta+s');
 const response=await saved;expect(response.status(),await response.text()).toBe(200);
 await expect(article.getByRole('status')).toHaveText('Saved');
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 await expect(page.getByRole('textbox',{name:'Chapter summary',exact:true})).toHaveValue(metadataDraft);
 expect(chapterWrites).toEqual([]);
 expect(await (await request.get('/api/chapters/'+chapter.id)).json()).toEqual(chapter);
 expect(await (await request.get('/api/scenes/'+scene.id)).json()).toMatchObject({version:scene.version+1,content:documentFrom(prose)});
});

test('external chapter deletion prunes clean inline scenes and keeps a dirty draft read-only and copyable',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),dirty=await createScene(request,chapter),clean=await createScene(request,chapter);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const dirtyArticle=inlineScene(page,dirty),cleanArticle=inlineScene(page,clean),editor=sceneEditor(dirtyArticle);
 await expect(editor).toBeVisible();await expect(sceneEditor(cleanArticle)).toBeVisible();
 const draft='Keep these unsaved words available after the chapter is deleted.';
 await editor.fill(draft);
 const removed=await request.delete('/api/chapters/'+chapter.id+'?novelId='+novel.id,{headers:{origin},data:{version:chapter.version}});
 expect(removed.status()).toBe(204);
 const refreshed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/scenes'&&new URL(response.url()).searchParams.get('chapterId')===chapter.id&&response.request().method()==='GET');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 expect((await refreshed).status()).toBe(404);
 await expect(cleanArticle).toHaveCount(0);
 await expect(dirtyArticle).toBeVisible();
 await expect(dirtyArticle.getByRole('alert')).toContainText(/deleted|removed/i);
 await expect(dirtyArticle.getByRole('alert')).toContainText(/copy/i);
 await expect(editor).toHaveText(draft);await expect(editor).toHaveAttribute('contenteditable','false');
 await expect(dirtyArticle.getByRole('button',{name:'Save scene',exact:true})).toBeDisabled();
 await expect(page.locator('#chapter-scene-count')).toHaveText('0');
 const copied=await editor.evaluate(element=>{
  const range=document.createRange();range.selectNodeContents(element);
  const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);return selection?.toString();
 });
 expect(copied).toBe(draft);
 for(const scene of [dirty,clean])expect((await request.get('/api/scenes/'+scene.id)).status()).toBe(404);
 expect((await request.get('/api/chapters/'+chapter.id)).status()).toBe(404);
 const scenes=await (await request.get('/api/scenes?novelId='+novel.id)).json();expect(scenes.scenes).toEqual([]);
 const chapters=await (await request.get('/api/chapters?novelId='+novel.id)).json();expect(chapters.chapters).toEqual([]);
});

test('a direct chapter profile infers its novel and presents the latest inline prose in scene order',async({page,request})=>{
 const coverUrl='https://chapter-cover.example/winter-archive.svg';
 await page.route(coverUrl,route=>route.fulfill({status:200,contentType:'image/svg+xml',body:bookArtwork}));
 const novelResponse=await request.post('/api/novels',{headers:{origin},data:{id:randomUUID(),title:'The Winter Archive',coverUrl}});
 expect(novelResponse.status(),await novelResponse.text()).toBe(201);const novel:Novel=await novelResponse.json();
 const chapterResponse=await request.post('/api/chapters',{headers:{origin},data:{id:randomUUID(),novelId:novel.id,title:'The sealed letter',summary:'An archivist discovers a letter that should have been destroyed, and follows its trail through the sleeping city.'}});
 expect(chapterResponse.status(),await chapterResponse.text()).toBe(201);const chapter:Chapter=await chapterResponse.json();
 // Chronological order remains deterministic even if both inserts share a clock tick.
 const ids=[randomUUID(),randomUUID()].sort();
 const scene=async(id:string,title:string,summary:string,content:RichNode):Promise<Scene>=>{
  const response=await request.post('/api/scenes',{headers:{origin},data:{id,chapterId:chapter.id,title,summary,status:'draft',contentSchemaVersion:1,content}});
  expect(response.status(),await response.text()).toBe(201);return response.json();
 };
 const first=await scene(ids[0],'A visitor after midnight','Mara finds a stranger waiting among the forbidden shelves.',{type:'doc',content:[
  {type:'paragraph',content:[{type:'text',text:'Snow drifted against the archive windows. Mara had nearly extinguished the last lamp when she heard three measured knocks at the door.'}]},
  {type:'paragraph',content:[{type:'text',text:'The stranger held out a sealed letter. '},{type:'text',text:'For the keeper of forgotten things,',marks:[{type:'italic'}]},{type:'text',text:' he said, and stepped back into the dark.'}]},
 ]});
 const oldProse='The letter lay unopened on the reading desk.';
 const second=await scene(ids[1],'The broken seal','The letter names a place Mara knows only from a missing map.',documentFrom(oldProse));
 const profile='/chapters/'+chapter.id+'/';
 await page.goto(profile);
 await expect(page).toHaveURL(origin+profile);
 await expect(page.locator('.workspace-context')).toContainText(novel.title);
 await expect(page.locator('#workspace-navigation .nav-link[aria-label="Scenes"]')).toHaveAttribute('href','/scenes/?novel='+novel.id);
 const articles=page.locator('#chapter-scenes-editor .chapter-inline-scene');
 await expect(articles).toHaveCount(2);
 await expect(articles.nth(0)).toHaveAttribute('data-scene-id',first.id);
 await expect(articles.nth(1)).toHaveAttribute('data-scene-id',second.id);
 await expect(sceneEditor(articles.nth(1))).toHaveText(oldProse);
 const latestProse='Under the wax seal, a single line crossed the page: the winter archive was never meant to keep books.';
 const latest:RichNode={type:'doc',content:[
  {type:'paragraph',content:[{type:'text',text:latestProse}]},
  {type:'blockquote',content:[{type:'paragraph',content:[{type:'text',text:'Come before dawn. Bring the map.'}]}]},
 ]};
 const updated=await request.put('/api/scenes/'+second.id,{headers:{origin},data:{version:second.version,content:latest}});
 expect(updated.status(),await updated.text()).toBe(200);
 await page.goto('/chapters/?novel='+novel.id);
 await page.getByRole('link',{name:'Open chapter profile: '+chapter.title,exact:true}).first().click();
 await expect(articles).toHaveCount(2);
 await expect(articles.nth(0)).toHaveAttribute('data-scene-id',first.id);
 await expect(articles.nth(1)).toHaveAttribute('data-scene-id',second.id);
 await expect(sceneEditor(articles.nth(1))).toContainText(latestProse);
 await expect(page.locator('#chapter-scenes-editor')).not.toContainText(oldProse);
 await expect(sceneEditor(articles.nth(1)).getByText(latestProse,{exact:true})).toHaveCount(1);
 const chapterSaved=await (await request.get('/api/chapters/'+chapter.id)).json();
 expect(chapterSaved).toEqual(chapter);expect(chapterSaved).not.toHaveProperty('content');
 expect((await (await request.get('/api/scenes/'+first.id)).json()).content).toEqual(first.content);
 expect((await (await request.get('/api/scenes/'+second.id)).json()).content).toEqual(latest);
 await page.setViewportSize({width:1440,height:1000});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expectWrappingTitle(page);
 for(const article of await articles.all())await expectLandscape(article.locator('.chapter-scene-image'));
 await page.screenshot({path:'/tmp/wtf-chapter-profile-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expectWrappingTitle(page);
 for(const article of await articles.all())await expectLandscape(article.locator('.chapter-scene-image'));
 await page.screenshot({path:'/tmp/wtf-chapter-profile-mobile.png',fullPage:true});
});

test('scene cards share the owned book cover with editable summaries and retain useful artwork fallbacks',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),scene=await createScene(request,chapter);
 const coverUrl='https://chapter-cover.example/'+randomUUID()+'.svg';
 const updated=await request.put('/api/novels/'+novel.id,{headers:{origin},data:{version:novel.version,coverUrl}});
 expect(updated.status(),await updated.text()).toBe(200);
 await page.route(coverUrl,route=>route.fulfill({status:200,contentType:'image/svg+xml',body:bookArtwork}));
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const article=inlineScene(page,scene),card=article.getByRole('group',{name:'Scene card: '+scene.title,exact:true});
 const cover=card.getByRole('img',{name:'Book cover for '+novel.title,exact:true}),summary=card.getByRole('textbox',{name:'Scene summary',exact:true});
 await expect(cover).toBeVisible();await expect(cover).toHaveAttribute('src',coverUrl);
 await expect(cover).toHaveAttribute('referrerpolicy','no-referrer');
 await expect.poll(()=>cover.evaluate(element=>(element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 await expect(summary).toBeVisible();await expect(summary).toHaveValue('The saved scene outline.');
 await expectCardContents(card);
 const longSummary=Array.from({length:55},(_,index)=>'Clue '+(index+1)+': Mara follows the letter through the winter archive and records another piece of the missing map.').join('\n');
 await summary.fill(longSummary);
 expect(await summary.evaluate(element=>element.scrollHeight>element.clientHeight)).toBe(true);
 expect(await summary.evaluate(element=>getComputedStyle(element).overflowY)).toMatch(/auto|scroll/);
 await expectCardContents(card);
 const saved=sceneSaveResponse(page,scene);await article.getByRole('button',{name:'Save scene',exact:true}).click();
 const response=await saved;expect(response.status(),await response.text()).toBe(200);expect((await response.json()).summary).toBe(longSummary);
 await page.reload();await expect(summary).toHaveValue(longSummary);await expectCardContents(card);
 await page.setViewportSize({width:390,height:844});await expectCardContents(card);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await summary.evaluate(element=>{element.scrollTop=element.scrollHeight;});
 expect(await summary.evaluate(element=>element.scrollTop>0)).toBe(true);
 await expect(summary).toHaveValue(longSummary);
 // A failed remote image still leaves the title and editable outline inside the card.
 await page.unroute(coverUrl);await page.route(coverUrl,route=>route.fulfill({status:404,body:''}));
 await page.reload();
 await expect(card.getByRole('img',{name:'Book cover for '+novel.title,exact:true})).toHaveCount(0);
 await expect(card.getByRole('img',{name:'Book cover placeholder for '+novel.title,exact:true})).toBeVisible();
 await expect(summary).toHaveValue(longSummary);await expectCardContents(card);
 const emptyNovel=await createNovel(request),emptyChapter=await createChapter(request,emptyNovel);
 await page.goto('/chapters/'+emptyChapter.id+'/?novel='+emptyNovel.id);
 const emptyCard=page.getByRole('group',{name:'New scene card',exact:true});
 await expectLandscape(emptyCard);
 await expect(emptyCard.getByRole('img',{name:'Book cover placeholder for '+emptyNovel.title,exact:true})).toBeVisible();
 await expect(emptyCard).toContainText('Your next scene');await expect(emptyCard.getByRole('button',{name:'Add scene',exact:true})).toBeVisible();
});
