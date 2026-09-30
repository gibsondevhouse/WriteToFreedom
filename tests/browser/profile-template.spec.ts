import {randomUUID} from 'node:crypto';
import {test,expect,type APIRequestContext,type Page} from '@playwright/test';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
async function create(request:APIRequestContext,path:string,data:Record<string,unknown>){
 const response=await request.post(path,{headers:{origin},data:{id:randomUUID(),...data}});
 expect(response.status(),await response.text()).toBe(201);return response.json();
}
async function articleStyles(page:Page){
 await page.evaluate(()=>document.fonts.ready);
 return page.evaluate(()=>{
  const selected:Record<string,string[]>={
   '#editor-fields>article':['display','gridTemplateColumns','columnGap','rowGap','alignItems'],
   '#identity':['width','padding','backgroundImage','backgroundColor','borderTopWidth','borderTopStyle','borderTopColor','borderRadius','boxShadow','fontFamily','fontSize','lineHeight'],
   '.infobox .profile-name':['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textAlign','padding','backgroundColor'],
   '.infobox .card-group h3':['fontFamily','fontSize','fontWeight','lineHeight','padding','backgroundColor','color'],
   '.infobox .identity-panel':['borderRadius','backgroundImage','borderTopWidth','borderTopColor','boxShadow'],
   '#overview .section-header h2':['fontFamily','fontSize','fontWeight','lineHeight','padding','borderBottomWidth','color'],
  };
  return Object.fromEntries(Object.entries(selected).map(([selector,properties])=>{
   const element=document.querySelector(selector);if(!element)throw new Error('Missing article slot: '+selector);
   const style=getComputedStyle(element);return [selector,Object.fromEntries(properties.map(property=>[property,style.getPropertyValue(property.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()))]))];
  }));
 });
}

test('chapter overview spans the shared article above its character-style identity rail on desktop, tablet and mobile',async({page,request})=>{
 const character=await create(request,'/api/characters',{name:'Mara Vale'}),novel=await create(request,'/api/novels',{title:'The winter archive'}),chapter=await create(request,'/api/chapters',{novelId:novel.id,title:'The sealed letter',summary:'The keeper discovers a letter hidden in the winter archive.'});
 const characterPage=await page.context().newPage();
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));characterPage.on('pageerror',error=>errors.push(error.message));
 for(const width of [1440,900,390]){
  await page.setViewportSize({width,height:900});await characterPage.setViewportSize({width,height:900});
  await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);await characterPage.goto('/characters/'+character.id+'/');
  for(const profile of [page,characterPage]){
   await expect(profile.locator('[data-profile-template="article"]')).toHaveCount(1);
   await expect(profile.locator('#profile-form')).toBeVisible();
   await expect(profile.locator('link[href^="/profiles/article.css?"]')).toHaveCount(1);
   await expect(profile.locator('#overview')).toBeVisible();
   expect(await profile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px profile has no horizontal overflow').toBe(true);
  }
  expect(await articleStyles(page),'shared article appearance at '+width+'px').toEqual(await articleStyles(characterPage));
  const chapterProse=await page.getByRole('textbox',{name:'Chapter summary',exact:true}).evaluate(element=>getComputedStyle(element).fontFamily);
  const characterProse=await characterPage.getByRole('textbox',{name:'Short description',exact:true}).evaluate(element=>getComputedStyle(element).fontFamily);
  expect(chapterProse,'leading chapter summary retains the shared prose typography at '+width+'px').toEqual(characterProse);
  const articleBox=(await page.locator('#editor-fields>article').boundingBox())!,heroBox=(await page.getByRole('group',{name:'Chapter overview',exact:true}).boundingBox())!,identityBox=(await page.locator('#identity').boundingBox())!;
  expect(Math.abs(heroBox.x-articleBox.x),width+'px overview starts at the article edge').toBeLessThan(2);
  expect(Math.abs(heroBox.width-articleBox.width),width+'px overview uses the whole article').toBeLessThan(2);
  expect(identityBox.y,width+'px identity rail starts below the overview').toBeGreaterThanOrEqual(heroBox.y+heroBox.height);
  await expect(page.getByRole('group',{name:'Chapter overview',exact:true}).getByRole('button',{name:'New scene',exact:true})).toBeVisible();
 }
 await expect(page.getByRole('group',{name:'Chapter overview',exact:true})).toBeVisible();
 const sharedSurface=(profile:Page,selector:string)=>profile.locator(selector).evaluate(element=>{
  const style=getComputedStyle(element);return {background:style.backgroundImage,border:style.borderTop,borderRadius:style.borderRadius,boxShadow:style.boxShadow};
 });
 expect(await sharedSurface(page,'.profile-overview-card')).toEqual(await sharedSurface(characterPage,'#identity'));
 expect(errors).toEqual([]);await characterPage.close();
});

test('the extracted character article retains its field editing, disclosure and saved visibility behavior',async({page,request})=>{
 const record=await create(request,'/api/characters',{name:'A keeper of forgotten names'});
 await page.goto('/characters/'+record.id+'/');
 const overview=page.locator('#overview-body');await expect(overview).toBeVisible();
 const introduction='Mara guards the archive beneath the sleeping city.',summary='A keeper searching for the missing map.';
 await page.getByRole('textbox',{name:'Introduction',exact:true}).fill(introduction);
 await page.getByRole('textbox',{name:'Short description',exact:true}).fill(summary);
 await page.locator('[data-collapse-target="overview-body"]').click();await expect(overview).toBeHidden();
 await page.locator('[data-collapse-target="overview-body"]').click();await expect(overview).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Introduction',exact:true})).toHaveValue(introduction);
 const group=page.locator('#identity .card-group').first(),disclosure=group.locator('h3 button');
 await disclosure.click();await expect(group.locator('.collapsible-region')).toBeHidden();await disclosure.click();
 await page.getByRole('textbox',{name:'First name',exact:true}).fill('Mara');
 await page.getByLabel('Choose visible fields for Overview',{exact:true}).click();
 await page.locator('[data-visibility="introduction"]').uncheck();
 await page.getByLabel('Choose visible fields for Overview',{exact:true}).click();
 const saved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/characters/'+record.id&&response.request().method()==='PUT');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();expect((await saved).status()).toBe(200);
 await expect(page.locator('#save-status')).toHaveText('Saved');await page.reload();
 await expect(page.getByRole('textbox',{name:'Short description',exact:true})).toHaveValue(summary);
 await expect(page.getByRole('textbox',{name:'First name',exact:true})).toHaveValue('Mara');
 await expect(page.locator('[data-profile-field="introduction"]')).toBeHidden();
 const persisted=await (await request.get('/api/characters/'+record.id)).json();
 expect(persisted).toMatchObject({firstName:'Mara',introduction,summary,hiddenFields:['introduction']});
});

test('chapter scene writing uses the character Biography section treatment across viewport sizes',async({page,request})=>{
 const character=await create(request,'/api/characters',{name:'Mara Vale'});
 const novel=await create(request,'/api/novels',{title:'The winter archive'});
 const chapter=await create(request,'/api/chapters',{novelId:novel.id,title:'The sealed letter'});
 const scene=await create(request,'/api/scenes',{chapterId:chapter.id,title:'A letter at midnight',summary:'The keeper opens a letter.',status:'draft',contentSchemaVersion:1,content:{type:'doc',content:[{type:'paragraph'}]}});
 const characterPage=await page.context().newPage();
 for(const width of [1440,900,390]){
  await page.setViewportSize({width,height:900});await characterPage.setViewportSize({width,height:900});
  await page.goto('/chapters/'+chapter.id+'/?novel='+novel.id);await characterPage.goto('/characters/'+character.id+'/');
  await page.evaluate(()=>document.fonts.ready);await characterPage.evaluate(()=>document.fonts.ready);
  const manuscript=page.locator('.chapter-inline-scene[data-scene-id="'+scene.id+'"] .chapter-scene-manuscript');
  const biography=characterPage.locator('#biography');
  await expect(manuscript).toHaveClass(/profile-section/);
  const opening=manuscript.locator('.chapter-scene-opening-heading');
  await expect(opening).toContainText('Opening heading');
  await expect(manuscript.locator('label')).toHaveCount(0);
  await expect(manuscript.getByRole('heading',{name:'Scene manuscript',exact:true})).toHaveCount(0);
  const appearance=async(profile:Page,sectionSelector:string)=>profile.locator(sectionSelector).evaluate(section=>{
   const style=getComputedStyle(section);
   return {background:style.backgroundImage,border:style.borderTopWidth,radius:style.borderRadius,shadow:style.boxShadow,width:section.getBoundingClientRect().width};
  });
  const chapterStyle=await appearance(page,'.chapter-inline-scene[data-scene-id="'+scene.id+'"] .chapter-scene-manuscript');
  const biographyStyle=await appearance(characterPage,'#biography');
  expect({...chapterStyle,width:0},width+'px manuscript follows Biography flat section styling').toEqual({...biographyStyle,width:0});
  expect(Math.abs(chapterStyle.width-biographyStyle.width),width+'px manuscript spans the same article column as Biography').toBeLessThan(2);
  const chapterHeadingStyle=await opening.evaluate(element=>{const style=getComputedStyle(element);return {family:style.fontFamily,border:style.borderBottomStyle};});
  const biographyHeadingStyle=await biography.locator('.section-header h2').evaluate(element=>getComputedStyle(element).fontFamily);
  expect(chapterHeadingStyle.family).toBe(biographyHeadingStyle);
  expect(chapterHeadingStyle.border).toBe('solid');
  const panel=page.locator('.chapter-inline-scene[data-scene-id="'+scene.id+'"] .chapter-scene-editor-panel');
  expect(await panel.evaluate(element=>{const style=getComputedStyle(element);return {background:style.backgroundImage,border:style.borderTopWidth,radius:style.borderRadius,shadow:style.boxShadow};})).toEqual({background:'none',border:'0px',radius:'0px',shadow:'none'});
  await expect(manuscript.getByRole('textbox',{name:'Scene text',exact:true})).toBeVisible();
  await expect(manuscript.locator('.chapter-scene-editing-dock')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px manuscript stays inside the viewport').toBe(true);
 }
 await characterPage.close();
});
