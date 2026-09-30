import {randomUUID} from 'node:crypto';
import {test,expect,type APIRequestContext,type Page,type Locator} from '@playwright/test';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
interface Novel{id:string;title:string;version:number}
interface Chapter{id:string;novelId:string;title:string;summary:string;version:number;status?:string;chapterNumber?:number;connectedArcIds?:string[]}
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
async function createArc(request:APIRequestContext,name:string,novel?:Novel):Promise<{id:string;name:string}>{
 const response=await request.post('/api/story-arcs',{headers:{origin},data:{id:randomUUID()}});
 expect(response.status(),await response.text()).toBe(201);const arc=await response.json();
 const updated=await request.put('/api/story-arcs/'+arc.id,{headers:{origin},data:{...arc,name}});
 expect(updated.status(),await updated.text()).toBe(200);
 if(novel){
  const linked=await request.post('/api/novels/'+novel.id+'/associations',{headers:{origin},data:{id:randomUUID(),targetKind:'story_arc',targetId:arc.id,relationKind:'referenced_by',prose:''}});
  expect(linked.status(),await linked.text()).toBe(201);
 }
 return updated.json();
}
function saveResponse(page:Page,chapter:Chapter){return page.waitForResponse(response=>new URL(response.url()).pathname==='/api/chapters/'+chapter.id&&response.request().method()==='PUT');}
const inlineScene=(page:Page,scene:Scene)=>page.locator('.chapter-inline-scene[data-scene-id="'+scene.id+'"]');
const sceneEditor=(article:Locator)=>article.getByRole('textbox',{name:'Scene text',exact:true,includeHidden:true});
const sceneDock=(article:Locator)=>article.locator('.chapter-scene-editing-dock');
async function openSceneEditor(article:Locator){
 await sceneEditor(article).click();
 const toggle=article.locator('.chapter-scene-editor-panel').getByRole('button',{name:'Formatting tools',exact:true});
 if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await expect(article.getByRole('toolbar',{name:'Text formatting'})).toBeVisible();
 await expect(sceneEditor(article)).toBeVisible();
}
async function hideSceneTools(article:Locator){
 const toggle=article.locator('.chapter-scene-editor-panel').getByRole('button',{name:'Formatting tools',exact:true});
 if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await expect(article.getByRole('toolbar',{name:'Text formatting',includeHidden:true})).toBeHidden();
 await expect(sceneEditor(article)).toBeVisible();
}
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
 await expectLandscape(card);
 const cover=(await card.locator('.chapter-scene-book-cover').boundingBox())!;
 expect(Math.abs(cover.width/cover.height-2/3),'book artwork retains its portrait proportions').toBeLessThan(.015);
 if(await card.locator('.chapter-scene-card-header').count()){
  const header=card.locator('.chapter-scene-card-header'),title=header.getByRole('textbox',{name:'Scene title',exact:true});
  await expect(title).toBeVisible();
  const [cardBox,titleBox]=await Promise.all([card.boundingBox(),title.boundingBox()]);
  expect(cardBox).not.toBeNull();expect(titleBox).not.toBeNull();
  expect(Math.abs(titleBox!.x+titleBox!.width/2-(cardBox!.x+cardBox!.width/2)),'scene title is centered in the card header').toBeLessThan(3);
 }
 for(const child of ['.chapter-scene-cover-well','.chapter-scene-card-copy','.chapter-scene-card-summary']){
  await expect.poll(async()=>{
   const [outer,inner]=await Promise.all([card.boundingBox(),card.locator(child).boundingBox()]);
   return {inside:!!outer&&!!inner&&inner.x>=outer.x-1&&inner.y>=outer.y-1&&inner.x+inner.width<=outer.x+outer.width+1&&inner.y+inner.height<=outer.y+outer.height+1};
  },{message:child+' stays inside the scene card after layout settles'}).toEqual({inside:true});
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
 await expect(article.getByRole('textbox',{name:'Scene summary',exact:true})).toBeVisible();
 await expect(sceneDock(article)).toBeHidden();
 await openSceneEditor(article);
 await expect(sceneDock(article)).toBeVisible();
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
 await expect(page.locator('#scenes > .section-header')).toHaveCount(0);
 await expect(page.locator('.chapter-scene-actions')).toHaveCount(0);
 await expectLandscape(article.locator('.chapter-scene-image'));
 expect((await article.locator('.chapter-scene-image').boundingBox())!.y).toBeLessThan((await editor.boundingBox())!.y);
 await expectWrappingTitle(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await hideSceneTools(article);
 const opening=editor.getByRole('heading',{name:'The winter archive',exact:true,level:2});
 await expect(opening).toBeVisible();
 const cardBounds=(await article.locator('.chapter-scene-card').boundingBox())!,openingBounds=(await opening.boundingBox())!;
 expect(cardBounds.y+cardBounds.height).toBeLessThanOrEqual(openingBounds.y);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'/tmp/wtf-chapter-profile-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expectWrappingTitle(page);await expectLandscape(article.locator('.chapter-scene-image'));
 const mobilePanel=(await article.locator('.chapter-scene-editor-panel').boundingBox())!,mobileProse=(await editor.boundingBox())!;
 expect(mobileProse.x).toBeGreaterThanOrEqual(mobilePanel.x-1);
 expect(mobileProse.x+mobileProse.width).toBeLessThanOrEqual(mobilePanel.x+mobilePanel.width+1);
 expect(mobileProse.height,'the scene has room to write on a narrow screen').toBeGreaterThanOrEqual(200);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'/tmp/wtf-chapter-profile-mobile.png',fullPage:true});
 await expect(article.getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(scene.title);
 await expect(page.locator('.workspace-context')).toContainText(novel.title);
});

test('shared profile disclosures preserve unsaved chapter fields and the mounted scene draft',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),scene=await createScene(request,chapter);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const title=page.getByRole('textbox',{name:'Chapter title',exact:true}),summary=page.getByRole('textbox',{name:'Chapter summary',exact:true});
 const article=inlineScene(page,scene),editor=sceneEditor(article),mounted=await editor.elementHandle();
 const draftTitle='A chapter title kept through disclosure',draftSummary='The chapter outline remains in progress.',draftProse='A paragraph kept in the active scene draft.';
 await title.fill(draftTitle);await summary.fill(draftSummary);await editor.fill(draftProse);
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 await expect(article.getByRole('status')).toHaveText('Unsaved changes');
 const overview=page.locator('#overview-body'),overviewToggle=page.locator('[data-collapse-target="overview-body"]');
 await overviewToggle.click();await expect(overviewToggle).toHaveAttribute('aria-expanded','false');await expect(overview).toBeHidden();
 await expect(editor).toHaveText(draftProse);
 await overviewToggle.click();await expect(overviewToggle).toHaveAttribute('aria-expanded','true');await expect(overview).toBeVisible();
 const details=page.locator('#chapter-details'),detailsToggle=page.locator('[data-collapse-target="chapter-details"]');
 await detailsToggle.click();await expect(detailsToggle).toHaveAttribute('aria-expanded','false');await expect(details).toBeHidden();
 await detailsToggle.click();await expect(detailsToggle).toHaveAttribute('aria-expanded','true');await expect(details).toBeVisible();
 await expect(title).toHaveValue(draftTitle);await expect(summary).toHaveValue(draftSummary);
 await expect(editor).toHaveText(draftProse);
 expect(await editor.evaluate((current,original)=>current===original,mounted)).toBe(true);
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 await expect(article.getByRole('status')).toHaveText('Unsaved changes');
 expect((await (await request.get('/api/chapters/'+chapter.id)).json()).title).toBe(chapter.title);
 expect((await (await request.get('/api/scenes/'+scene.id)).json()).content).toEqual(scene.content);
});

test('a populated chapter keeps its shared profile and scene writing within a narrow article',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),scene=await createScene(request,chapter);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const article=inlineScene(page,scene),editor=sceneEditor(article);
 const longTitle='The lantern at the far end of the winter archive leads to the unopened room beneath the river where no one remembers Mara';
 const title=article.locator('.chapter-scene-card-header').getByRole('textbox',{name:'Scene title',exact:true});
 await title.fill(longTitle);
 await editor.fill('The keeper followed the lantern through a corridor of locked rooms.');
 await expectCardContents(article.locator('.chapter-scene-card'));
 const titleMetrics=await title.evaluate(element=>{const style=getComputedStyle(element);return {height:element.getBoundingClientRect().height,lineHeight:parseFloat(style.lineHeight),scrollHeight:element.scrollHeight,clientHeight:element.clientHeight};});
 expect(titleMetrics.height,'mobile title stays within two lines of the 16:9 card').toBeLessThanOrEqual(titleMetrics.lineHeight*2+5);
 expect(titleMetrics.scrollHeight,'long title remains scrollable rather than clipping its text').toBeGreaterThan(titleMetrics.clientHeight);
 const geometry=await page.evaluate(sceneId=>{
  const bounds=(selector:string)=>{const element=document.querySelector(selector);if(!element)throw new Error('Missing populated profile element: '+selector);const box=element.getBoundingClientRect();return {x:box.x,y:box.y,right:box.right,bottom:box.bottom,width:box.width};};
  const root=bounds('#editor-fields>article');
  return {root,hero:bounds('.profile-overview-card'),identity:bounds('#identity'),sceneTitleHeader:bounds('.chapter-inline-scene[data-scene-id="'+sceneId+'"] .chapter-scene-card-header'),card:bounds('.chapter-inline-scene[data-scene-id="'+sceneId+'"] .chapter-scene-card'),prose:bounds('.chapter-inline-scene[data-scene-id="'+sceneId+'"] .writing-prose'),documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth};
 },scene.id);
 expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
 for(const [name,box] of Object.entries({hero:geometry.hero,identity:geometry.identity,sceneTitleHeader:geometry.sceneTitleHeader,card:geometry.card,prose:geometry.prose})){
  expect(box.x,name+' begins inside the article').toBeGreaterThanOrEqual(geometry.root.x-1);
  expect(box.right,name+' ends inside the article').toBeLessThanOrEqual(geometry.root.right+1);
 }
 expect(geometry.identity.y).toBeGreaterThanOrEqual(geometry.hero.bottom);
 expect(geometry.card.y).toBeGreaterThanOrEqual(geometry.identity.bottom);
 expect(geometry.sceneTitleHeader.y).toBeGreaterThanOrEqual(geometry.card.y);
 expect(geometry.sceneTitleHeader.bottom).toBeLessThanOrEqual(geometry.card.bottom);
 expect(geometry.prose.y).toBeGreaterThanOrEqual(geometry.card.bottom);
 await expect(editor).toContainText('The keeper followed the lantern');
});

test('chapter overview saves its title, status, number, scoped arcs, and outline across reload',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),scene=await createScene(request,chapter);
 const linked=await createArc(request,'The archive conspiracy',novel),unlinked=await createArc(request,'An unrelated owned arc'),otherNovel=await createNovel(request),otherArc=await createArc(request,'Another novel story arc',otherNovel);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const hero=page.getByRole('group',{name:'Chapter overview',exact:true});await expect(hero).toBeVisible();
 expect((await hero.boundingBox())!.width).toBeGreaterThan((await page.locator('.chapter-infobox').boundingBox())!.width);
 await expect(hero.getByRole('textbox',{name:'Chapter title',exact:true})).toHaveCount(1);
 await expect(hero.getByRole('combobox',{name:'Chapter status',exact:true})).toHaveValue('draft');
 await expect(hero.getByRole('spinbutton',{name:'Chapter number',exact:true})).toHaveValue('1');
 const picker=hero.getByRole('combobox',{name:'Connect story arc',exact:true});
 await expect(picker.locator('option[value="'+linked.id+'"]')).toHaveText(linked.name);
 await expect(picker.locator('option[value="'+unlinked.id+'"], option[value="'+otherArc.id+'"]')).toHaveCount(0);
 const title='The sealed letter that led the keeper of forgotten things through the winter archive and into the sleeping city '+randomUUID().slice(0,8),summary='A revised outline with <literal> characters & punctuation.';
 await page.getByRole('textbox',{name:'Chapter title',exact:true}).fill(title);
 await expectWrappingTitle(page);
 await page.getByRole('textbox',{name:'Chapter summary',exact:true}).fill(summary);
 await hero.getByRole('combobox',{name:'Chapter status',exact:true}).selectOption('revising');
 await hero.getByRole('spinbutton',{name:'Chapter number',exact:true}).fill('27');
 await picker.selectOption(linked.id);
 const arcs=hero.getByRole('list',{name:'Connected story arcs',exact:true});
 await expect(arcs.getByRole('link',{name:linked.name,exact:true})).toHaveAttribute('href','/story-arcs/'+linked.id+'/?novel='+novel.id);
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 const saved=saveResponse(page,chapter);
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 const response=await saved;expect(response.status(),await response.text()).toBe(200);
 expect(response.request().postDataJSON()).toMatchObject({title,summary,status:'revising',chapterNumber:27,connectedArcIds:[linked.id],version:chapter.version});
 await expect(page.locator('#save-status')).toHaveText('Saved');
 await page.reload();
 await expect(page.getByRole('textbox',{name:'Chapter title',exact:true})).toHaveValue(title);
 await expect(page.getByRole('textbox',{name:'Chapter summary',exact:true})).toHaveValue(summary);
 await expect(hero.getByRole('combobox',{name:'Chapter status',exact:true})).toHaveValue('revising');
 await expect(hero.getByRole('spinbutton',{name:'Chapter number',exact:true})).toHaveValue('27');
 await expect(arcs.getByRole('link',{name:linked.name,exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await expectWrappingTitle(page);
 const titleBox=await page.getByRole('textbox',{name:'Chapter title',exact:true}).boundingBox();
 expect(titleBox!.height).toBeGreaterThan(40);
 const persisted=await (await request.get('/api/chapters/'+chapter.id)).json();
 expect(persisted).toMatchObject({title,summary,status:'revising',chapterNumber:27,connectedArcIds:[linked.id],novelId:novel.id,version:chapter.version+1});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const heroBox=(await hero.boundingBox())!;
 for(const control of [hero.getByRole('combobox',{name:'Chapter status',exact:true}),hero.getByRole('spinbutton',{name:'Chapter number',exact:true}),picker,hero.getByRole('textbox',{name:'Chapter summary',exact:true})]){
  const box=(await control.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(heroBox.x-1);expect(box.x+box.width).toBeLessThanOrEqual(heroBox.x+heroBox.width+1);
 }
 await arcs.getByRole('button',{name:'Disconnect story arc: '+linked.name,exact:true}).click();
 const disconnected=saveResponse(page,chapter);await page.getByRole('button',{name:'Save changes',exact:true}).click();
 expect((await disconnected).status()).toBe(200);await page.reload();
 await expect(arcs.getByRole('link',{name:linked.name,exact:true})).toHaveCount(0);
 expect((await (await request.get('/api/chapters/'+chapter.id)).json()).connectedArcIds).toEqual([]);
 expect((await (await request.get('/api/scenes/'+scene.id)).json()).content).toEqual(scene.content);
 await page.goto('/chapters/?novel='+novel.id);
 await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
});

test('a stale chapter overview save retains every local planning field without replacing the newer revision',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel);
 const linked=await createArc(request,'The lost map',novel);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const localTitle='My unsaved chapter '+randomUUID(),localSummary='Keep the unsaved outline on this page.';
 await page.getByRole('textbox',{name:'Chapter title',exact:true}).fill(localTitle);
 await page.getByRole('textbox',{name:'Chapter summary',exact:true}).fill(localSummary);
 await page.getByRole('combobox',{name:'Chapter status',exact:true}).selectOption('complete');
 await page.getByRole('spinbutton',{name:'Chapter number',exact:true}).fill('42');
 await page.getByRole('combobox',{name:'Connect story arc',exact:true}).selectOption(linked.id);
 const updated=await request.put('/api/chapters/'+chapter.id,{headers:{origin},data:{version:chapter.version,title:'Newer chapter in another tab',summary:'The newer saved outline.',status:'revising',chapterNumber:8,connectedArcIds:[]}});
 expect(updated.status(),await updated.text()).toBe(200);
 const saved=saveResponse(page,chapter);
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 const conflict=await saved;expect(conflict.status()).toBe(409);
 await expect(page.locator('#editor-error')).toContainText(/changed in another tab|conflict/i);
 await expect(page.locator('#save-status')).toHaveText('Not saved — your changes are still here');
 await expect(page.getByRole('textbox',{name:'Chapter title',exact:true})).toHaveValue(localTitle);
 await expect(page.getByRole('textbox',{name:'Chapter summary',exact:true})).toHaveValue(localSummary);
 await expect(page.getByRole('combobox',{name:'Chapter status',exact:true})).toHaveValue('complete');
 await expect(page.getByRole('spinbutton',{name:'Chapter number',exact:true})).toHaveValue('42');
 await expect(page.getByRole('list',{name:'Connected story arcs',exact:true}).getByRole('link',{name:linked.name,exact:true})).toBeVisible();
 const stored=await (await request.get('/api/chapters/'+chapter.id)).json();
 expect(stored).toMatchObject({title:'Newer chapter in another tab',summary:'The newer saved outline.',status:'revising',chapterNumber:8,connectedArcIds:[],version:chapter.version+1});
});

test('an empty chapter profile creates its first scene without leaving its inline workspace',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const profile=page.url();
 await expectLandscape(page.locator('#chapter-scenes-editor .chapter-scene-image'));
 await expect(page.locator('#chapter-scene-count')).toHaveText('0');
 await page.getByRole('group',{name:'Chapter overview',exact:true}).getByRole('button',{name:'New scene',exact:true}).click();
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
 await expect(sceneEditor(article)).toBeVisible();await expect(sceneDock(article)).toBeHidden();await expectLandscape(article.locator('.chapter-scene-image'));
 await expect(article.getByRole('button',{name:'Opening heading',exact:true})).toBeVisible();
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
 await openSceneEditor(article);
 const chapterDraft='An unsaved chapter outline that remains separate from scene edits.';
 const sceneTitle='The lantern at the archive door',sceneSummary='A visitor arrives with a letter for Mara.',prose='The last lantern trembled when Mara opened the archive door.';
 await article.locator('.chapter-scene-card-header .chapter-scene-title').evaluate(heading=>{
  const bar=document.querySelector('.article-bar')!;const edge=bar.getBoundingClientRect().height+(parseFloat(getComputedStyle(bar).top)||0);
  window.scrollBy(0,heading.getBoundingClientRect().top-edge+8);
 });
 await expect(page.locator('.current-view-label')).toHaveText(scene.title);
 await article.getByRole('textbox',{name:'Scene title',exact:true}).fill(sceneTitle);
 await expect(article.locator('.chapter-scene-card-header').getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(sceneTitle);
 await expect(page.locator('.current-view-label')).toHaveText(sceneTitle);
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
 await expect(sceneDock(article)).toBeHidden();
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
 await expect(sceneEditor(reloaded)).toBeVisible();await openSceneEditor(reloaded);
 await expect(sceneEditor(reloaded).locator('strong')).toHaveText(prose);
 expect((await (await request.get('/api/scenes/'+scene.id)).json()).version).toBe(scene.version+1);
});

test('an inline scene conflict protects newer prose and retains drafts in every scene',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),first=await createScene(request,chapter),second=await createScene(request,chapter);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const firstArticle=inlineScene(page,first),secondArticle=inlineScene(page,second);
 await openSceneEditor(firstArticle);await openSceneEditor(secondArticle);
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
 await openSceneEditor(article);
 const metadataDraft='This chapter outline must stay unsaved when I save the scene.',prose='Mara folded the letter and reached for the missing map.';
 await page.getByRole('textbox',{name:'Chapter summary',exact:true}).fill(metadataDraft);
 await editor.fill(prose);
 const chapterWrites:string[]=[];
 page.on('request',candidate=>{if(new URL(candidate.url()).pathname==='/api/chapters/'+chapter.id&&candidate.method()==='PUT')chapterWrites.push(candidate.url());});
 const saved=sceneSaveResponse(page,scene);await editor.press('ControlOrMeta+s');
 const response=await saved;expect(response.status(),await response.text()).toBe(200);
 await expect(sceneDock(article)).toBeHidden();
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
 await openSceneEditor(dirtyArticle);await openSceneEditor(cleanArticle);
 const draft='Keep these unsaved words available after the chapter is deleted.';
 await editor.fill(draft);
 await hideSceneTools(dirtyArticle);
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
 await expect(editor).toBeVisible();
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

test('visible scene bodies and independent formatting toggles retain unsaved drafts and undo history',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel);
 const first=await createScene(request,chapter,documentFrom('Original first scene.')),second=await createScene(request,chapter,documentFrom('Original second scene.'));
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const firstArticle=inlineScene(page,first),secondArticle=inlineScene(page,second),firstEditor=sceneEditor(firstArticle),secondEditor=sceneEditor(secondArticle);
 await expect(firstArticle.locator('.chapter-scene-card-header').getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(first.title);
 await expect(secondArticle.locator('.chapter-scene-card-header').getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(second.title);
 await expect(page.locator('.chapter-scene-actions')).toHaveCount(0);
 await expect(page.getByRole('group',{name:'Chapter overview',exact:true}).getByRole('button',{name:'New scene',exact:true})).toBeVisible();
 for(const article of [firstArticle,secondArticle]){
  await expect(article.getByRole('button',{name:'Write scene',exact:true})).toHaveCount(0);
  const card=article.getByRole('group',{name:/^Scene card: /}),heading=card.locator('.chapter-scene-card-header');
  await expect(heading.getByRole('textbox',{name:'Scene title',exact:true})).toHaveCount(1);
  await expect(article.locator('.chapter-scene-heading')).toHaveCount(0);
  await expect(card.getByRole('button',{name:'Formatting tools',exact:true})).toHaveCount(0);
  await expectCardContents(card);
  expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual((await card.boundingBox())!.y);
  await expect(sceneDock(article)).toBeHidden();
  await expect(sceneEditor(article)).toHaveCount(1);await expect(sceneEditor(article)).toBeVisible();
  await expect(article.getByRole('textbox',{name:'Scene title',exact:true})).toBeVisible();
  await expect(article.getByRole('textbox',{name:'Scene summary',exact:true})).toBeVisible();
  await expect(article.getByRole('button',{name:'Save scene',exact:true})).toHaveCount(0);
  await expect(card.getByRole('button',{name:'Save scene',exact:true})).toHaveCount(0);
  await expect(article.getByRole('button',{name:'Opening heading',exact:true})).toBeVisible();
  await expect(sceneEditor(article).locator('p')).toHaveCount(1);
 }
 await openSceneEditor(firstArticle);await expect(secondArticle.getByRole('toolbar',{name:'Text formatting',includeHidden:true})).toBeHidden();
 await expect(sceneDock(firstArticle)).toBeVisible();await expect(sceneDock(secondArticle)).toBeHidden();
 const mounted=await firstEditor.elementHandle();
 const firstDraft='An independent first scene draft.';await firstEditor.fill(firstDraft);await expect(firstEditor).toHaveText(firstDraft);
 await hideSceneTools(firstArticle);
 await expect(firstArticle.getByRole('status')).toHaveText('Unsaved changes');
 await openSceneEditor(secondArticle);await secondEditor.fill('An independent second scene draft.');
 await openSceneEditor(firstArticle);
 await expect(firstEditor).toHaveText(firstDraft);await expect(secondEditor).toBeVisible();
 expect(await firstEditor.evaluate((current,original)=>current===original,mounted)).toBe(true);
 await firstArticle.getByRole('button',{name:'Undo',exact:true}).click();await expect(firstEditor).toHaveText('Original first scene.');
 await expect(secondEditor).toHaveText('An independent second scene draft.');
 await firstArticle.getByRole('button',{name:'Redo',exact:true}).click();await expect(firstEditor).toHaveText(firstDraft);
 await hideSceneTools(secondArticle);
 await expect(firstEditor).toBeVisible();
 expect((await (await request.get('/api/scenes/'+first.id)).json()).content).toEqual(first.content);
 expect((await (await request.get('/api/scenes/'+second.id)).json()).content).toEqual(second.content);
 await page.setViewportSize({width:390,height:844});
 await hideSceneTools(firstArticle);
 await expect(firstEditor).toBeVisible();await expect(secondEditor).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('the manuscript opening heading is directly editable below its scene card without replacing its body',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),initialHeading='Before <script> & dawn';
 const content:RichNode={type:'doc',content:[
  {type:'heading',attrs:{level:2},content:[{type:'text',text:initialHeading}]},
  {type:'paragraph',content:[{type:'text',text:'The manuscript remains independent of its scene metadata.'}]},
  {type:'heading',attrs:{level:1},content:[{type:'text',text:'A later heading'}]},
 ]};
 const scene=await createScene(request,chapter,content);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const article=inlineScene(page,scene),editor=sceneEditor(article),opening=editor.locator('h2').first();
 await expect(editor).toBeVisible();await expect(opening).toHaveText(initialHeading);await expect(opening).toBeVisible();
 await expect(article.getByRole('button',{name:'Opening heading',exact:true})).toHaveCount(0);
 await expect(opening.locator('script')).toHaveCount(0);
 const card=(await article.locator('.chapter-scene-card').boundingBox())!,heading=(await opening.boundingBox())!;
 expect(card.y+card.height).toBeLessThanOrEqual(heading.y);
 expect((await (await request.get('/api/scenes/'+scene.id)).json()).content).toEqual(content);
 const mounted=await editor.elementHandle(),draftHeading='Dawn arrives at the cabin';
 await opening.fill(draftHeading);
 await expect(opening).toHaveText(draftHeading);
 await expect(editor.locator('p').first()).toHaveText('The manuscript remains independent of its scene metadata.');
 await expect(editor.locator('h1')).toHaveText('A later heading');
 await expect(article.getByRole('status')).toHaveText('Unsaved changes');
 expect((await (await request.get('/api/scenes/'+scene.id)).json()).content).toEqual(content);
 await openSceneEditor(article);
 expect(await editor.evaluate((current,original)=>current===original,mounted)).toBe(true);
 await article.getByRole('button',{name:'Undo',exact:true}).click();await expect(opening).toHaveText(initialHeading);
 await article.getByRole('button',{name:'Redo',exact:true}).click();await expect(opening).toHaveText(draftHeading);
 const saved=sceneSaveResponse(page,scene);await article.getByRole('button',{name:'Save scene',exact:true}).click();expect((await saved).status()).toBe(200);
 await expect(sceneDock(article)).toBeHidden();
 await page.reload();
 await expect(sceneEditor(inlineScene(page,scene))).toBeVisible();
 await expect(sceneEditor(inlineScene(page,scene)).locator('h2').first()).toHaveText(draftHeading);
 const persisted=(await (await request.get('/api/scenes/'+scene.id)).json()).content;
 expect(persisted.content?.[0].content?.[0].text).toBe(draftHeading);
 expect(persisted.content?.[1]).toEqual(content.content?.[1]);
 expect(persisted.content?.[2]).toEqual(content.content?.[2]);
});

test('clicking Opening heading starts a scene with an editable heading and body in one manuscript',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel);
 const empty:RichNode={type:'doc',content:[{type:'paragraph'}]};
 const scene=await createScene(request,chapter,empty);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const article=inlineScene(page,scene),editor=sceneEditor(article),placeholder=article.getByRole('button',{name:'Opening heading',exact:true});
 await expect(editor).toBeVisible();await expect(editor).toHaveCount(1);
 await expect(editor.locator('p').first()).toBeVisible();await expect(placeholder).toBeVisible();
 expect(await editor.locator('p').first().evaluate(element=>getComputedStyle(element,'::before').content)).toContain('Start writing the scene');
 const heading='The river remembers',prose='Mara crossed the bridge before the lamps went out.';
 await placeholder.click();
 const headingNode=editor.locator('h1').first();await expect(headingNode).toBeVisible();
 await expect(editor).toBeFocused();
 await page.keyboard.type(heading);
 await expect(headingNode).toHaveText(heading);
 await expect(placeholder).toHaveCount(0);
 const body=editor.locator('p').first();await body.click();await page.keyboard.type(prose);
 await expect(body).toHaveText(prose);
 expect(await body.evaluate(element=>getComputedStyle(element,'::before').content)).not.toContain('Start writing the scene');
 await expect(article.getByRole('status')).toHaveText('Unsaved changes');
 expect((await (await request.get('/api/scenes/'+scene.id)).json()).content).toEqual(empty);
 const saved=sceneSaveResponse(page,scene);await article.getByRole('button',{name:'Save scene',exact:true}).click();
 const response=await saved;expect(response.status(),await response.text()).toBe(200);
 const record=await response.json();
 expect(record.content).toEqual({type:'doc',content:[
  {type:'heading',attrs:{level:1},content:[{type:'text',text:heading}]},
  {type:'paragraph',content:[{type:'text',text:prose}]},
 ]});
 await page.reload();
 const reloaded=inlineScene(page,scene),reloadedEditor=sceneEditor(reloaded);
 await expect(reloadedEditor).toBeVisible();await expect(reloadedEditor).toHaveCount(1);
 await expect(reloadedEditor.locator('h1').first()).toHaveText(heading);
 await expect(reloadedEditor.locator('p').first()).toHaveText(prose);
 await expect(reloaded.getByRole('button',{name:'Opening heading',exact:true})).toHaveCount(0);
});

test('adding an opening heading after writing the body keeps the unsaved paragraph intact',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel);
 const scene=await createScene(request,chapter,{type:'doc',content:[{type:'paragraph'}]});
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const article=inlineScene(page,scene),editor=sceneEditor(article),paragraph='Mara found the letter beneath the floorboards.',heading='Beneath the floorboards';
 await editor.locator('p').first().click();await page.keyboard.type(paragraph);
 await expect(editor.locator('p').first()).toHaveText(paragraph);
 await article.getByRole('button',{name:'Opening heading',exact:true}).click();
 const headingNode=editor.locator('h1').first();await expect(headingNode).toBeVisible();await expect(editor.locator('p').first()).toHaveText(paragraph);
 await page.keyboard.type(heading);
 await expect(headingNode).toHaveText(heading);
 await expect(editor.locator('p').first()).toHaveText(paragraph);
 const saved=sceneSaveResponse(page,scene);await article.getByRole('button',{name:'Save scene',exact:true}).click();
 const response=await saved;expect(response.status(),await response.text()).toBe(200);
 expect((await response.json()).content).toEqual({type:'doc',content:[
  {type:'heading',attrs:{level:1},content:[{type:'text',text:heading}]},
  {type:'paragraph',content:[{type:'text',text:paragraph}]},
 ]});
 await page.reload();
 const reloaded=sceneEditor(inlineScene(page,scene));await expect(reloaded).toBeVisible();
 await expect(reloaded.locator('h1')).toHaveText(heading);
 await expect(reloaded.locator('p').first()).toHaveText(paragraph);
});

test('a scene flows from its opening heading into formatted body prose by keyboard',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel);
 const scene=await createScene(request,chapter,{type:'doc',content:[{type:'paragraph'}]});
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const article=inlineScene(page,scene),editor=sceneEditor(article);
 await article.getByRole('button',{name:'Opening heading',exact:true}).click();
 await page.keyboard.type('Across the river');
 await page.keyboard.press('Enter');
 const heading=editor.locator('h1').first(),body=editor.locator('p').first();
 await expect(heading).toHaveText('Across the river');
 await expect(body).toBeVisible();
 await expect(editor).toBeFocused();
 await page.keyboard.type('Mara crossed ');
 await page.keyboard.press('ControlOrMeta+b');
 await page.keyboard.type('before dawn.');
 await page.keyboard.press('ControlOrMeta+b');
 await expect(body).toHaveText('Mara crossed before dawn.');
 await expect(body.locator('strong')).toHaveText('before dawn.');
 await expect(article.getByLabel('Word count')).toHaveText('7 words');
 await expect(article.getByRole('status')).toHaveText('Unsaved changes');
 const saved=sceneSaveResponse(page,scene);await article.getByRole('button',{name:'Save scene',exact:true}).click();
 const response=await saved;expect(response.status(),await response.text()).toBe(200);
 const record=await response.json();
 expect(record.content.content[0]).toEqual({type:'heading',attrs:{level:1},content:[{type:'text',text:'Across the river'}]});
 expect(record.content.content[1]).toEqual({type:'paragraph',content:[{type:'text',text:'Mara crossed '},{type:'text',text:'before dawn.',marks:[{type:'bold'}]}]});
 await page.reload();
 const reloaded=sceneEditor(inlineScene(page,scene));
 await expect(reloaded.locator('h1').first()).toHaveText('Across the river');
 await expect(reloaded.locator('p').first()).toHaveText('Mara crossed before dawn.');
 await expect(reloaded.locator('p').first().locator('strong')).toHaveText('before dawn.');
});

test('scene editing controls float at the manuscript footer only during an editing session',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),scene=await createScene(request,chapter);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const article=inlineScene(page,scene),manuscript=article.locator('.chapter-scene-manuscript'),editor=sceneEditor(article),dock=sceneDock(article);
 await expect(editor).toBeVisible();
 await expect(manuscript.locator('label')).toHaveCount(0);
 await expect(manuscript.getByRole('heading',{name:'Scene manuscript',exact:true})).toHaveCount(0);
 await expect(dock).toBeHidden();
 await expect(article.getByLabel('Word count')).toHaveCount(0);
 await editor.click();
 await expect(dock).toBeVisible();
 await expect(dock).toHaveAttribute('role','group');
 await expect(dock).toHaveAttribute('aria-label','Scene editing controls');
 expect(await dock.evaluate(element=>getComputedStyle(element).position)).toBe('sticky');
 await expect(dock.getByLabel('Word count')).toHaveText('3 words');
 await expect(dock.getByRole('button',{name:'Formatting tools',exact:true})).toBeVisible();
 await expect(dock.getByRole('button',{name:'Save scene',exact:true})).toBeDisabled();
 const firstDraft='Mara waited beneath the archive windows.';
 await editor.fill(firstDraft);
 await expect(dock.getByRole('status')).toHaveText('Unsaved changes');
 await expect(dock.getByLabel('Word count')).toHaveText('6 words');
 const saved=sceneSaveResponse(page,scene);
 await dock.getByRole('button',{name:'Save scene',exact:true}).click();
 expect((await saved).status()).toBe(200);
 await expect(dock).toBeHidden();
 await expect(article.getByLabel('Word count')).toHaveCount(0);
 await expect(article.getByRole('button',{name:'Formatting tools',exact:true})).toHaveCount(0);
 await expect(editor).toHaveText(firstDraft);
 const secondDraft='Mara returned to the archive after midnight.';
 await editor.fill(secondDraft);
 await expect(dock).toBeVisible();
 await expect(dock.getByRole('status')).toHaveText('Unsaved changes');
 expect((await (await request.get('/api/scenes/'+scene.id)).json()).content).toEqual(documentFrom(firstDraft));
});

test('typing during an in-flight scene save keeps the newer manuscript draft',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel);
 const scene=await createScene(request,chapter,documentFrom('Previously saved prose.'));
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const article=inlineScene(page,scene),editor=sceneEditor(article);
 const firstDraft='The first version of this scene.',newerDraft='The later version written while saving.';
 await editor.fill(firstDraft);
 let received!:()=>void,release!:()=>void;
 const requestReachedServer=new Promise<void>(resolve=>{received=resolve;}),allowResponse=new Promise<void>(resolve=>{release=resolve;});
 const routePattern='**/api/scenes/'+scene.id;
 await page.route(routePattern,async route=>{
  if(route.request().method()!=='PUT'){await route.continue();return;}
  const response=await route.fetch();
  received();
  await allowResponse;
  await route.fulfill({response});
 });
 const firstSave=sceneSaveResponse(page,scene);
 await article.getByRole('button',{name:'Save scene',exact:true}).click();
 await requestReachedServer;
 await expect(editor).toHaveAttribute('contenteditable','true');
 await editor.fill(newerDraft);
 await expect(editor).toHaveText(newerDraft);
 release();
 const firstResponse=await firstSave;expect(firstResponse.status(),await firstResponse.text()).toBe(200);
 await expect(article.getByRole('status')).toHaveText('Unsaved changes');
 await expect(editor).toHaveText(newerDraft);
 expect((await (await request.get('/api/scenes/'+scene.id)).json()).content).toEqual(documentFrom(firstDraft));
 await page.unroute(routePattern);
 const secondSave=sceneSaveResponse(page,scene);
 await article.getByRole('button',{name:'Save scene',exact:true}).click();
 const secondResponse=await secondSave;expect(secondResponse.status(),await secondResponse.text()).toBe(200);
 await expect(sceneDock(article)).toBeHidden();
 expect((await (await request.get('/api/scenes/'+scene.id)).json()).content).toEqual(documentFrom(newerDraft));
 await page.reload();
 await expect(sceneEditor(inlineScene(page,scene))).toHaveText(newerDraft);
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
 await expect(sceneEditor(articles.nth(0))).toBeVisible();await expect(sceneEditor(articles.nth(1))).toBeVisible();
 await openSceneEditor(articles.nth(1));
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
 await openSceneEditor(articles.nth(1));
 await expect(sceneEditor(articles.nth(1))).toContainText(latestProse);
 await expect(page.locator('#chapter-scenes-editor')).not.toContainText(oldProse);
 await expect(sceneEditor(articles.nth(1)).getByText(latestProse,{exact:true})).toHaveCount(1);
 const chapterSaved=await (await request.get('/api/chapters/'+chapter.id)).json();
 expect(chapterSaved).toEqual(chapter);expect(chapterSaved).not.toHaveProperty('content');
 expect((await (await request.get('/api/scenes/'+first.id)).json()).content).toEqual(first.content);
 expect((await (await request.get('/api/scenes/'+second.id)).json()).content).toEqual(latest);
 await hideSceneTools(articles.nth(1));
 await expect(sceneEditor(articles.nth(0))).toBeVisible();await expect(sceneEditor(articles.nth(1))).toBeVisible();
 await page.setViewportSize({width:1440,height:1000});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expectWrappingTitle(page);
 for(const article of await articles.all())await expectLandscape(article.locator('.chapter-scene-image'));
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'/tmp/wtf-chapter-profile-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expectWrappingTitle(page);
 for(const article of await articles.all())await expectLandscape(article.locator('.chapter-scene-image'));
 await page.evaluate(()=>window.scrollTo(0,0));
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
 await expect(sceneEditor(article)).toBeVisible();
 await expectCardContents(card);
 const longSummary=Array.from({length:55},(_,index)=>'Clue '+(index+1)+': Mara follows the letter through the winter archive and records another piece of the missing map.').join('\n');
 await summary.fill(longSummary);
 expect(await summary.evaluate(element=>element.scrollHeight>element.clientHeight)).toBe(true);
 expect(await summary.evaluate(element=>getComputedStyle(element).overflowY)).toMatch(/auto|scroll/);
 await expectCardContents(card);
 const saved=sceneSaveResponse(page,scene);await article.getByRole('button',{name:'Save scene',exact:true}).click();
 const response=await saved;expect(response.status(),await response.text()).toBe(200);expect((await response.json()).summary).toBe(longSummary);
 await page.reload();await expect(summary).toHaveValue(longSummary);await expectCardContents(card);
 for(const width of [1440,900,390]){
  await page.setViewportSize({width,height:844});await expectCardContents(card);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px card has no horizontal overflow').toBe(true);
 }
 await summary.evaluate(element=>{element.scrollTop=element.scrollHeight;});
 expect(await summary.evaluate(element=>element.scrollTop>0)).toBe(true);
 await expect(summary).toHaveValue(longSummary);
 // A failed remote image still leaves the editable outline inside the card.
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


test('the overview New scene action preserves unsaved chapter planning and independent scene drafts',async({page,request})=>{
 const novel=await createNovel(request),chapter=await createChapter(request,novel),existing=await createScene(request,chapter),arc=await createArc(request,'The forgotten map',novel);
 await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);
 const hero=page.getByRole('group',{name:'Chapter overview',exact:true}),article=inlineScene(page,existing);
 const title='An unsaved chapter name',summary='An unsaved chapter plan.',draft='An unsaved scene draft kept through creation.';
 await hero.getByRole('textbox',{name:'Chapter title',exact:true}).fill(title);
 await hero.getByRole('textbox',{name:'Chapter summary',exact:true}).fill(summary);
 await hero.getByRole('combobox',{name:'Chapter status',exact:true}).selectOption('revising');
 await hero.getByRole('spinbutton',{name:'Chapter number',exact:true}).fill('18');
 await hero.getByRole('combobox',{name:'Connect story arc',exact:true}).selectOption(arc.id);
 await openSceneEditor(article);await sceneEditor(article).fill(draft);
 const mounted=await sceneEditor(article).elementHandle(),writes:string[]=[];
 page.on('request',candidate=>{if(candidate.method()==='PUT')writes.push(new URL(candidate.url()).pathname);});
 await hero.getByRole('button',{name:'New scene',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'New scene',exact:true});await expect(dialog).toBeVisible();
 const newTitle='A second scene from the overview';await dialog.getByLabel('Scene title',{exact:true}).fill(newTitle);
 const created=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/scenes'&&response.request().method()==='POST');
 await dialog.getByRole('button',{name:'Create scene',exact:true}).click();const response=await created;
 expect(response.status(),await response.text()).toBe(201);const scene=await response.json();expect(scene.chapterId).toBe(chapter.id);
 await expect(dialog).toHaveCount(0);await expect(page.locator('#chapter-scene-count')).toHaveText('2');
 await expect(inlineScene(page,scene).locator('.chapter-scene-card-header').getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(newTitle);
 await expect(sceneEditor(inlineScene(page,scene))).toBeVisible();
 await expect(hero.getByRole('textbox',{name:'Chapter title',exact:true})).toHaveValue(title);
 await expect(hero.getByRole('textbox',{name:'Chapter summary',exact:true})).toHaveValue(summary);
 await expect(hero.getByRole('combobox',{name:'Chapter status',exact:true})).toHaveValue('revising');
 await expect(hero.getByRole('spinbutton',{name:'Chapter number',exact:true})).toHaveValue('18');
 await expect(hero.getByRole('list',{name:'Connected story arcs',exact:true}).getByRole('link',{name:arc.name,exact:true})).toBeVisible();
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 await expect(sceneEditor(article)).toHaveText(draft);await expect(sceneEditor(article)).toBeVisible();
 expect(await sceneEditor(article).evaluate((current,original)=>current===original,mounted)).toBe(true);
 await expect(article.getByRole('status')).toHaveText('Unsaved changes');expect(writes).toEqual([]);
 expect(await (await request.get('/api/chapters/'+chapter.id)).json()).toEqual(chapter);
 expect(await (await request.get('/api/scenes/'+existing.id)).json()).toEqual(existing);
});
