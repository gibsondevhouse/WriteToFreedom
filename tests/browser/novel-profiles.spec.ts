import {randomUUID} from 'node:crypto';
import {test,expect,type APIRequestContext} from '@playwright/test';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
interface Novel{id:string;title:string;version:number;seriesId:string;seriesOrder:number}
interface Series{id:string;title:string;version:number}
async function createNovel(request:APIRequestContext,title:string,extra:Record<string,unknown>={}):Promise<Novel>{
 const response=await request.post('/api/novels',{headers:{origin},data:{id:randomUUID(),title,...extra}});
 expect(response.status(),await response.text()).toBe(201);return response.json();
}
async function createSeries(request:APIRequestContext,title:string):Promise<Series>{
 const response=await request.post('/api/series',{headers:{origin},data:{id:randomUUID(),title}});
 expect(response.status(),await response.text()).toBe(201);return response.json();
}

test('novel inline editing retains hidden prose and association actions retain the manuscript draft',async({page,request})=>{
 const novel=await createNovel(request,'Profile novel '+randomUUID());
 const characterResponse=await request.post('/api/characters',{headers:{origin},data:{id:randomUUID(),name:'Shared person '+randomUUID()}});
 expect(characterResponse.status()).toBe(201);const character=await characterResponse.json();
 const loreResponse=await request.post('/api/lore',{headers:{origin},data:{id:randomUUID(),type:'book',name:'Research source '+randomUUID()}});
 expect(loreResponse.status()).toBe(201);const source=await loreResponse.json();
 await page.goto('/novels/'+novel.id+'/');
 await expect(page.locator('#profile-form')).toBeVisible();
 await page.locator('#novel-link-target').selectOption('character:'+character.id);
 await expect(page.locator('#save-status')).toHaveText('Saved');
 await page.getByRole('textbox',{name:'Synopsis',exact:true}).fill('This synopsis must survive visibility and link changes.');
 await page.getByRole('button',{name:'Link entry',exact:true}).click();
 await expect(page.locator('#novel-association-status')).toHaveText('Entry linked.');
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 await expect(page.getByRole('textbox',{name:'Synopsis',exact:true})).toHaveValue('This synopsis must survive visibility and link changes.');
 const association=page.locator('[data-association-group=character] li').filter({hasText:character.name});
 await association.getByRole('button',{name:'Remove '+character.name+' from this novel'}).click();
 await expect(association).toHaveCount(0);
 await page.locator('#novel-link-target').selectOption('character:'+character.id);
 await page.getByRole('button',{name:'Link entry',exact:true}).click();
 await expect(association).toHaveCount(1);
 await page.locator('#novel-link-target').selectOption('lore:'+source.id);
 await page.getByRole('button',{name:'Link entry',exact:true}).click();
 await expect(page.locator('[data-association-group=lore]')).toContainText(source.name);
 const linked=await (await request.get('/api/novels/'+novel.id+'/associations')).json();
 expect(linked).toContainEqual(expect.objectContaining({targetKind:'lore',targetId:source.id,relationKind:'referenced_by'}));
 await page.locator('#overview .field-menu summary').click();
 await page.locator('#overview .field-menu').getByRole('checkbox',{name:'Synopsis',exact:true}).uncheck();
 await page.keyboard.press('Escape');
 await page.keyboard.press('ControlOrMeta+s');
 await expect(page.locator('#save-status')).toHaveText('Saved');
 await page.reload();
 await expect(page.locator('[data-profile-field=synopsis]')).toBeHidden();
 await expect(page.locator('#field-synopsis')).toHaveValue('This synopsis must survive visibility and link changes.');
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('#identity')).toBeVisible();
 await page.locator('#overview .collapse-toggle').click();
 await expect(page.locator('#overview-body')).toBeHidden();
 await page.locator('#overview .collapse-toggle').click();
 await expect(page.locator('#overview-body')).toHaveJSProperty('hidden',false);
 await expect(page.locator('#overview .collapse-toggle')).toHaveAttribute('aria-expanded','true');
 const href='/characters/'+character.id+'/?novel='+novel.id+'#appearance-'+novel.id;
 await expect(association.getByRole('link')).toHaveAttribute('href',href);
 await association.getByRole('link').click();
 await expect(page.locator('#profile-form')).toHaveAttribute('data-id',character.id);
 await expect(page.locator('#appearance-'+novel.id)).toBeVisible();
 await page.reload();
 await expect(page).toHaveURL(origin+href);
 await expect(page.locator('.workspace-context')).toContainText(novel.title);
 await expect(page.locator('#workspace-navigation .nav-link[aria-label="Characters"]')).toHaveAttribute('href','/characters/?novel='+novel.id);
});

test('series book order saves independently and keeps the title editor on the resulting revision',async({page,request})=>{
 const series=await createSeries(request,'Series '+randomUUID());
 const one=await createNovel(request,'Opening volume '+randomUUID(),{seriesId:series.id,seriesOrder:1});
 const two=await createNovel(request,'Later volume '+randomUUID(),{seriesId:series.id,seriesOrder:2});
 await page.goto('/series/'+series.id+'/');
 await page.getByLabel('Title',{exact:true}).fill('Revised series '+randomUUID());
 await page.getByRole('button',{name:'Move '+two.title+' earlier',exact:true}).click();
 await expect(page.locator('#series-books > li').first()).toHaveAttribute('data-series-novel',two.id);
 await page.getByRole('button',{name:'Save book order',exact:true}).click();
 await expect(page.locator('#series-order-status')).toHaveText('Book order is saved.');
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.locator('#save-status')).toHaveText('Saved');
 await page.reload();
 await expect(page.locator('#series-books > li').first()).toHaveAttribute('data-series-novel',two.id);
 const savedOne=await (await request.get('/api/novels/'+one.id)).json();
 const savedTwo=await (await request.get('/api/novels/'+two.id)).json();
 expect(savedTwo.seriesOrder).toBeLessThan(savedOne.seriesOrder);
});

test('a stale novel-profile unlink preserves newer appearance prose and the local synopsis draft',async({page,request})=>{
 const novel=await createNovel(request,'Unlink conflict '+randomUUID());
 const response=await request.post('/api/characters',{headers:{origin},data:{id:randomUUID(),name:'Unlink person '+randomUUID()}});
 expect(response.status()).toBe(201);const character=await response.json();
 const created=await request.post('/api/novels/'+novel.id+'/associations',{headers:{origin},data:{id:randomUUID(),targetKind:'character',targetId:character.id,relationKind:'appears_in',prose:'Original appearance.'}});
 expect(created.status()).toBe(201);const association=await created.json();
 await page.goto('/novels/'+novel.id+'/');
 await page.getByRole('textbox',{name:'Synopsis',exact:true}).fill('Local synopsis stays here.');
 const updated=await request.put('/api/novels/'+novel.id+'/associations/'+association.id,{headers:{origin},data:{version:association.version,prose:'Newer appearance from another tab.'}});
 expect(updated.status(),await updated.text()).toBe(200);
 await page.getByRole('button',{name:'Remove '+character.name+' from this novel',exact:true}).click();
 await expect(page.locator('#novel-association-status')).toContainText('changed in another tab');
 await expect(page.locator('[data-association-id="'+association.id+'"]')).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Synopsis',exact:true})).toHaveValue('Local synopsis stays here.');
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 const saved=await (await request.get('/api/novels/'+novel.id+'/associations')).json();
 expect(saved).toContainEqual(expect.objectContaining({id:association.id,prose:'Newer appearance from another tab.',version:association.version+1}));
});

test('a novel chapter action opens its own manuscript and scene',async({page,request})=>{
 const other=await createNovel(request,'Other manuscript '+randomUUID());
 const selected=await createNovel(request,'Selected manuscript '+randomUUID());
 const chapter=async(novel:Novel,title:string)=>{
  const response=await request.post('/api/chapters',{headers:{origin},data:{id:randomUUID(),novelId:novel.id,title,summary:''}});
  expect(response.status(),await response.text()).toBe(201);return response.json();
 };
 const scene=async(chapterId:string,title:string)=>{
  const response=await request.post('/api/scenes',{headers:{origin},data:{id:randomUUID(),chapterId,title,summary:'',status:'draft',contentSchemaVersion:1,content:{type:'doc',content:[{type:'paragraph'}]}}});
  expect(response.status(),await response.text()).toBe(201);return response.json();
 };
 const unrelated=await chapter(other,'Unrelated chapter '+randomUUID());await scene(unrelated.id,'Unrelated scene '+randomUUID());
 const correct=await chapter(selected,'Correct chapter '+randomUUID()),expected=await scene(correct.id,'Correct scene '+randomUUID());
 await page.goto('/novels/'+selected.id+'/');
 await expect(page.locator('.novel-chapters')).not.toContainText(unrelated.title);
 await page.locator('.novel-chapters').getByRole('link',{name:'Write scenes →',exact:true}).click();
 await expect(page).toHaveURL(new RegExp('/scenes/\\?novel='+selected.id+'&chapter='+correct.id));
 await expect(page.getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue(expected.title);
 await expect(page.locator('.workspace-context')).toContainText(selected.title);
});

test('directory creation assembles a saved series and profiles fit narrow screens',async({page})=>{
 const sequence='The Archive Sequence '+randomUUID().slice(0,8);
 await page.goto('/series/');
 await page.getByRole('button',{name:'New series',exact:true}).click();
 const seriesDialog=page.getByRole('dialog',{name:'New series',exact:true});
 await seriesDialog.getByLabel('Title',{exact:true}).fill(sequence);
 await seriesDialog.getByRole('button',{name:'Create series',exact:true}).click();
 await expect(page).toHaveURL(/\/series\/[0-9a-f-]{36}\//);
 const seriesId=new URL(page.url()).pathname.split('/').at(-2)!;
 const books=['The Winter Archives '+randomUUID().slice(0,8)+' '+('W'.repeat(60)),'The Lantern Treaty '+randomUUID().slice(0,8)];
 const ids:string[]=[];
 for(const [index,title] of books.entries()){
  await page.goto('/novels/');
  await page.getByRole('button',{name:'New novel',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'New novel',exact:true});
  await dialog.getByLabel('Title',{exact:true}).fill(title);
  await dialog.getByRole('button',{name:'Create novel',exact:true}).click();
  await expect(page).toHaveURL(/\/novels\/[0-9a-f-]{36}\//);
  ids.push(new URL(page.url()).pathname.split('/').at(-2)!);
  await page.getByRole('combobox',{name:'Primary series',exact:true}).selectOption(seriesId);
  await page.getByRole('textbox',{name:'Synopsis',exact:true}).fill('An archivist follows the missing treaty through a winter city. The manuscript shares its cast and places with the later volume.');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.locator('#save-status')).toHaveText('Saved');
  if(index===0){
   await page.screenshot({path:'/tmp/wtf-review-novel-desktop.png',fullPage:true});
   await page.setViewportSize({width:390,height:844});
   await expect(page.locator('#identity')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:'/tmp/wtf-review-novel-mobile.png',fullPage:true});
   await page.setViewportSize({width:1280,height:720});
  }
 }
 await page.goto('/series/'+seriesId+'/');
 await expect(page.locator('#series-books > li')).toHaveCount(2);
 for(const id of ids)await expect(page.locator('[data-series-novel="'+id+'"]')).toBeVisible();
 await page.getByRole('textbox',{name:'Summary',exact:true}).fill('A connected sequence of novels about the archive and the choices behind its treaties.');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.locator('#save-status')).toHaveText('Saved');
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));
 await expect(page.locator('.current-view-label')).toHaveText('Series profile');
 await expect(page.locator('.current-view-previous')).toHaveCount(0);
 await page.screenshot({path:'/tmp/wtf-review-series-mobile.png',fullPage:true});
 await page.reload();
 await expect(page.getByRole('textbox',{name:'Summary',exact:true})).toHaveValue('A connected sequence of novels about the archive and the choices behind its treaties.');
});
