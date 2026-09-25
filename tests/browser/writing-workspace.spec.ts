import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {test,expect,type APIRequestContext,type Locator,type Page} from '@playwright/test';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
interface RichNode{type:string;text?:string;attrs?:Record<string,unknown>;marks?:Array<{type:string;attrs?:Record<string,unknown>}>;content?:RichNode[]}
interface Chapter{id:string;title:string;summary:string;version:number}
interface Scene{id:string;chapterId:string;title:string;summary:string;status:string;contentSchemaVersion:number;content:RichNode;version:number}
const documentFrom=(...paragraphs:string[]):RichNode=>({type:'doc',content:paragraphs.map(text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})}))});
const textFrom=(node:RichNode):string=>node.text??(node.content||[]).map(textFrom).join(node.type==='doc'?'\n':'');
const editor=(page:Page)=>page.getByRole('textbox',{name:'Scene text',exact:true});
const focusedWritingRoutes=[
 {path:'/chapters/',heading:'Chapters',primaryAction:'New chapter'},
 {path:'/scenes/',heading:'Scenes',primaryAction:'New scene'},
] as const;
async function createChapter(request:APIRequestContext,title='Browser chapter '+randomUUID()):Promise<Chapter>{
 const response=await request.post('/api/chapters',{headers:{origin},data:{id:randomUUID(),title,summary:'A browser verification chapter.'}});
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

test('chapters and scenes open focused writing routes with their own primary actions',async({page})=>{
 for(const route of focusedWritingRoutes){
  expect((await page.goto(route.path))?.status()).toBe(200);
  await expect(page.getByRole('heading',{name:route.heading,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:route.primaryAction,exact:true}).first()).toBeVisible();
 }
});

test('the local development host accepts a localhost same-origin chapter creation',async({page})=>{
 const localhostOrigin=origin.replace('127.0.0.1','localhost');
 await page.goto(localhostOrigin+'/chapters/');
 const chapter={id:randomUUID(),title:'Same-origin chapter '+randomUUID(),summary:'Created through the browser on the local development host.'};
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

test('creates a chapter and a rich-text scene through the writing workspace',async({page,request})=>{
 await page.goto('/chapters/');
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

test('a lost create response and edited retry preserve the newer scene form without duplicates',async({page,request})=>{
 const chapter=await createChapter(request);
 await page.goto('/scenes/');
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
