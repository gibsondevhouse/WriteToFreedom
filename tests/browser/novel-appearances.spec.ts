import {randomUUID} from 'node:crypto';
import {test,expect,type APIRequestContext} from '@playwright/test';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
async function create(request:APIRequestContext,path:string,data:Record<string,unknown>){
 const response=await request.post(path,{headers:{origin},data:{id:randomUUID(),...data}});expect(response.status(),await response.text()).toBe(201);return response.json();
}
async function association(request:APIRequestContext,novelId:string,targetKind:string,targetId:string,prose:string){return create(request,'/api/novels/'+novelId+'/associations',{targetKind,targetId,relationKind:targetKind==='lore'?'referenced_by':'appears_in',prose});}

test('association edits and conflict recovery retain the main article draft and other novel prose',async({page,request})=>{
 const character=await create(request,'/api/characters',{name:'Shared '+randomUUID()}),one=await create(request,'/api/novels',{title:'First '+randomUUID()}),two=await create(request,'/api/novels',{title:'Second '+randomUUID()});
 const first=await association(request,one.id,'character',character.id,'First book details'),second=await association(request,two.id,'character',character.id,'Second book details');
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/characters/'+character.id+'/');
 await page.locator('[name="biography"]').fill('Unsaved main article text');
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 await page.locator('[data-edit-appearance="'+first.id+'"]').click();
 await page.locator('#appearance-prose').fill('My saved first book details');
 const saving=page.waitForResponse(response=>response.url()===origin+'/api/novels/'+one.id+'/associations/'+first.id&&response.request().method()==='PUT');
 await page.locator('#appearance-prose').press('Control+s');expect((await saving).status()).toBe(200);
 await expect(page.locator('#appearance-editor-status')).toHaveText('Saved details');
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');await expect(page.locator('[name="biography"]')).toHaveValue('Unsaved main article text');
 expect((await (await request.get('/api/characters/'+character.id)).json()).biography).toBe(character.biography);
 const advanced=await request.put('/api/novels/'+one.id+'/associations/'+first.id,{headers:{origin},data:{version:2,prose:'Another tab saved details'}});expect(advanced.status()).toBe(200);
 await page.locator('#appearance-prose').fill('My retained conflict draft');
 const conflicting=page.waitForResponse(response=>response.url()===origin+'/api/novels/'+one.id+'/associations/'+first.id&&response.request().method()==='PUT');
 await page.getByRole('button',{name:'Save details',exact:true}).click();expect((await conflicting).status()).toBe(409);
 await expect(page.locator('#appearance-prose')).toHaveValue('My retained conflict draft');await expect(page.locator('#appearance-editor-error')).toContainText('changed in another tab');
 const unlinking=page.waitForResponse(response=>response.url()===origin+'/api/novels/'+one.id+'/associations/'+first.id&&response.request().method()==='DELETE');
 await page.getByRole('button',{name:'Unlink novel',exact:true}).click();expect((await unlinking).status()).toBe(409);
 await expect(page.locator('#novel-appearance-dialog')).toBeVisible();await expect(page.locator('#appearance-prose')).toHaveValue('My retained conflict draft');
 const stillLinked=await (await request.get('/api/novels/'+one.id+'/associations')).json();expect(stillLinked.find((item:{id:string})=>item.id===first.id).prose).toBe('Another tab saved details');
 await page.getByRole('button',{name:'Review saved version and keep my draft',exact:true}).click();
 await expect(page.locator('#appearance-saved-text')).toContainText('Another tab saved details');await expect(page.locator('#appearance-prose')).toHaveValue('My retained conflict draft');
 await page.getByRole('button',{name:'Save details',exact:true}).click();await expect(page.locator('#appearance-editor-status')).toHaveText('Saved details');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.locator('#appearance-'+one.id)).toContainText('My retained conflict draft');await expect(page.locator('#appearance-'+two.id)).toContainText('Second book details');
 const links=await (await request.get('/api/novels/'+two.id+'/associations')).json();expect(links.find((item:{id:string})=>item.id===second.id).prose).toBe('Second book details');
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.locator('#save-status')).toHaveText('Saved');
 await page.reload();await expect(page.locator('[name="biography"]')).toHaveValue('Unsaved main article text');await expect(page.locator('#appearance-'+one.id)).toContainText('My retained conflict draft');
 expect(errors).toEqual([]);
});

test('the React Lore note links and unlinks novels independently of its dirty research text',async({page,request})=>{
 const note=await create(request,'/api/lore',{type:'note',name:'Research '+randomUUID(),body:'Original research'}),novel=await create(request,'/api/novels',{title:'Referenced '+randomUUID()});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/lore/'+note.id+'/');await expect(page.locator('#lore-profile-root #profile-form')).toBeVisible();
 await page.locator('[name="body"]').fill('Unsaved research draft');
 await page.getByRole('button',{name:'Link an existing novel',exact:true}).click();
 await page.locator('#appearance-novel').selectOption(novel.id);await expect(page.locator('#appearance-relation')).toHaveValue('referenced_by');
 await page.locator('#appearance-prose').fill('Research for this manuscript');await page.getByRole('button',{name:'Save details',exact:true}).click();await expect(page.locator('#appearance-editor-status')).toHaveText('Saved details');
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');await expect(page.locator('[name="body"]')).toHaveValue('Unsaved research draft');
 await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('#appearance-'+novel.id)).toContainText('Referenced by');
 await expect(page.locator('[data-appearance-infobox]')).toContainText(novel.title);
 expect((await (await request.get('/api/lore/'+note.id)).json()).body).toBe('Original research');
 await page.locator('#appearance-'+novel.id+' [data-edit-appearance]').click();await page.getByRole('button',{name:'Unlink novel',exact:true}).click();
 await expect(page.locator('#novel-appearance-dialog')).not.toBeVisible();await expect(page.locator('#appearance-'+novel.id)).toHaveCount(0);
 expect((await request.get('/api/lore/'+note.id)).status()).toBe(200);expect((await request.get('/api/novels/'+novel.id)).status()).toBe(200);
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');await expect(page.locator('[name="body"]')).toHaveValue('Unsaved research draft');
 expect(errors).toEqual([]);
});
