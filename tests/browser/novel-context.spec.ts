import {randomUUID} from 'node:crypto';
import {test,expect,type APIRequestContext} from '@playwright/test';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
async function create(request:APIRequestContext,path:string,body:Record<string,unknown>){
 const response=await request.post(path,{headers:{origin},data:{id:randomUUID(),...body}});
 expect(response.status(),await response.text()).toBe(201);return response.json();
}

test('novel browsing is scoped while global search and reference expansion reach the library',async({page,request},testInfo)=>{
 const novel=await create(request,'/api/novels',{title:'Scoped novel '+randomUUID()}),other=await create(request,'/api/novels',{title:'Other novel '+randomUUID()});
 const linked=await create(request,'/api/characters',{name:'Linked cast '+randomUUID()}),unlinked=await create(request,'/api/characters',{name:'Library idea '+randomUUID()});
 await create(request,'/api/novels/'+novel.id+'/associations',{targetKind:'character',targetId:linked.id});
 const chapter=await create(request,'/api/chapters',{novelId:novel.id,title:'Scoped chapter',summary:''});
 const scene=await create(request,'/api/scenes',{chapterId:chapter.id,title:'Scoped scene',summary:'',status:'draft',contentSchemaVersion:1,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A quiet draft.'}]}]}});
 await page.goto('/characters/?novel='+novel.id);
 await expect(page.locator('[data-novel-scope]')).toContainText(novel.title);
 await expect(page.locator('[data-directory-list]')).toContainText(linked.name);
 await expect(page.locator('[data-directory-list]')).not.toContainText(unlinked.name);
 await page.getByRole('searchbox',{name:/Search all novels/}).fill(other.title);
 await expect(page.locator('#search-results')).toContainText(other.title);
 await page.getByRole('searchbox',{name:/Search all novels/}).fill(unlinked.name);
 await expect(page.locator('#search-results')).toContainText(unlinked.name);
 await expect(page.locator('#novel-search')).toHaveAttribute('placeholder','Search all material…');
 await page.getByRole('searchbox',{name:/Search all novels/}).press('Escape');
 await expect(page.locator('#search-results')).toBeHidden();
 await page.getByRole('link',{name:'Browse the whole library',exact:true}).click();
 await expect(page).toHaveURL(origin+'/characters/');
 await expect(page.locator('[data-novel-scope]')).toHaveCount(0);
 await page.goto('/scenes/?novel='+novel.id+'&scene='+scene.id);
 await page.getByRole('button',{name:'Show references',exact:true}).click();
 await expect(page.locator('#writing-references')).toContainText(linked.name);
 await expect(page.locator('#writing-references')).not.toContainText(unlinked.name);
 await page.getByRole('button',{name:'Browse the whole library',exact:true}).click();
 await expect(page.locator('#writing-references')).toContainText(unlinked.name);
 await page.screenshot({path:testInfo.outputPath('novel-writing-context.png'),fullPage:true});
});

test('empty chapter deep links create in that chapter and dirty writing cancels a novel switch',async({page,request})=>{
 const one=await create(request,'/api/novels',{title:'First '+randomUUID()}),two=await create(request,'/api/novels',{title:'Next '+randomUUID()});
 await create(request,'/api/chapters',{novelId:one.id,title:'Earlier chapter',summary:''});
 const requested=await create(request,'/api/chapters',{novelId:one.id,title:'Empty destination',summary:''});
 await page.goto('/scenes/?novel='+one.id+'&chapter='+requested.id);
 await expect(page.getByRole('textbox',{name:'Scene title',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Create your first scene',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'New scene',exact:true});
 await expect(dialog.getByLabel('Chapter',{exact:true})).toHaveValue(requested.id);
 await dialog.getByLabel('Scene title',{exact:true}).fill('Correct destination');
 await dialog.getByRole('button',{name:'Create scene',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Scene title',exact:true})).toHaveValue('Correct destination');
 await page.getByRole('textbox',{name:'Scene text',exact:true}).fill('Unsaved words stay here.');
 const unload=page.waitForEvent('dialog').then(async prompt=>{expect(prompt.type()).toBe('beforeunload');await prompt.dismiss();});
 await page.getByLabel('Current novel',{exact:true}).selectOption(two.id);
 await unload;
 await expect(page).toHaveURL(new RegExp('novel='+one.id));
 await expect(page.getByRole('textbox',{name:'Scene text',exact:true})).toHaveText('Unsaved words stay here.');
 await expect(page.getByLabel('Current novel',{exact:true})).toHaveValue(one.id);
});

test('scoped location creation offers unlinked parents and the timeline labels canonical date scope',async({page,request})=>{
 const novel=await create(request,'/api/novels',{title:'Place novel '+randomUUID()});
 const country=await create(request,'/api/locations',{name:'Unlinked country '+randomUUID(),type:'country',parentId:null});
 await page.goto('/locations/?novel='+novel.id);
 await page.getByRole('button',{name:'New location',exact:true}).click();
 await page.locator('#location-type').selectOption('city');
 await page.locator('#location-name').fill('Linked city '+randomUUID());
 await page.locator('#location-parent').selectOption(country.id);
 await page.getByRole('button',{name:'Add location',exact:true}).click();
 await expect(page).toHaveURL(/\/locations\/cities\/[0-9a-f-]+\//);
 const id=new URL(page.url()).pathname.split('/').at(-2)!;
 const associations=await (await request.get('/api/novels/'+novel.id+'/associations')).json();
 expect(associations).toContainEqual(expect.objectContaining({targetKind:'location',targetId:id}));
 await page.goto('/locations/?novel='+novel.id);
 await expect(page.locator('[data-directory-list]')).toContainText(country.name);
 await page.goto('/timeline/?novel='+novel.id);
 await expect(page.locator('.timeline-header [data-novel-scope]')).toContainText(novel.title);
 await expect(page.locator('.timeline-header [data-novel-scope]')).toContainText('does not assert when an event occurs');
});
