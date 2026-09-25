import {randomUUID} from 'node:crypto';
import {test,expect,type APIRequestContext,type Page} from '@playwright/test';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
interface SavedLore{
 id:string;
 type:string;
 name:string;
 body:string;
 version:number;
 hiddenFields:string[];
 collections:string[];
 profileRatings:Record<string,number>;
 pinned:boolean;
 featured:boolean;
 [key:string]:unknown;
}
async function createLore(request:APIRequestContext,fields:Record<string,unknown>={}):Promise<SavedLore>{
 const response=await request.post('/api/lore',{
  headers:{origin},
  data:{id:randomUUID(),type:'note',name:'Browser note '+randomUUID(),body:'Original note text.',...fields},
 });
 expect(response.status(),await response.text()).toBe(201);
 return response.json();
}
async function readLore(request:APIRequestContext,id:string):Promise<SavedLore>{
 const response=await request.get('/api/lore/'+id);
 expect(response.status()).toBe(200);
 return response.json();
}
async function openNote(page:Page,record:SavedLore){
 const response=await page.goto('/lore/'+record.id+'/');
 expect(response?.status()).toBe(200);
 await expect(page.locator('#lore-profile-root #profile-form')).toBeVisible();
 await expect(page.locator('[name="body"]')).toHaveValue(record.body);
}
async function save(page:Page,id:string){
 const response=page.waitForResponse(response=>response.url()===origin+'/api/lore/'+id&&response.request().method()==='PUT');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 expect((await response).status()).toBe(200);
 await expect(page.locator('#save-status')).toHaveText('Saved');
}

test('built assets boot the React pilot and legacy routes without competing profile controllers',async({page,request})=>{
 const record=await createLore(request);
 const errors:string[]=[];
 const failedAssets:string[]=[];
 const loadedScripts:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{
  const url=new URL(response.url());
  if(url.origin===origin&&['script','stylesheet'].includes(response.request().resourceType())&&response.status()>=400)failedAssets.push(response.url());
 });
 page.on('request',request=>{if(request.resourceType()==='script')loadedScripts.push(new URL(request.url()).pathname);});
 await openNote(page,record);
 expect(loadedScripts).not.toContain('/lore/profile.js');
 expect(loadedScripts).not.toContain('/profiles/editor.js');
 await expect(page.locator('#profile-form')).toHaveCount(1);
 const assets=await page.locator('script[src],link[rel="stylesheet"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('src')||node.getAttribute('href')||''));
 expect(assets.some(path=>/\/[\w.-]+-[\w-]+\.js(?:\?|$)/.test(path))).toBe(true);
 for(const path of assets){
  const response=await request.get(path);
  expect(response.status(),path).toBe(200);
  expect(response.headers()['content-type'],path).toMatch(path.includes('.css')?/text\/css/:/(?:java|ecma)script/);
 }
 const artifact=await createLore(request,{type:'artifact',name:'Legacy artifact'});
 for(const path of ['/','/lore/','/characters/claude/','/lore/'+artifact.id+'/']){
  expect((await page.goto(path))?.status(),path).toBe(200);
  await expect(page.locator('[data-app-shell]')).toHaveCount(1);
  await page.waitForLoadState('networkidle');
 }
 await expect(page.locator('script[src^="/lore/profile.js"]')).toHaveCount(1);
 expect((await request.get('/assets/does-not-exist.js')).status()).toBe(404);
 expect((await request.get('/lore/'+randomUUID()+'/')).status()).toBe(404);
 expect(failedAssets).toEqual([]);
 expect(errors).toEqual([]);
});

test('edits save and reopen with the original plain-text representation and hidden-field values',async({page,request},testInfo)=>{
 const text='The winter archive\nA second paragraph, with <strong>literal markup</strong>.\n[1] A positional note marker.';
 const record=await createLore(request,{profileRatings:{clarity:61},originDate:'1200 BCE'});
 await openNote(page,record);
 await page.locator('[name="name"]').fill('Updated research note');
 await page.locator('[name="body"]').fill(text);
 await page.locator('[name="sources"]').fill('The archivist’s journal.');
 await page.getByLabel('Pin to Continue building',{exact:true}).check();
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 await page.getByLabel('Choose visible fields for Notes & sources',{exact:true}).click();
 await page.locator('[data-visibility="body"]').uncheck();
 await expect(page.locator('[data-profile-field="body"]')).toBeHidden();
 await save(page,record.id);
 const saved=await readLore(request,record.id);
 expect(saved).toMatchObject({name:'Updated research note',body:text,sources:'The archivist’s journal.',hiddenFields:['body'],profileRatings:{clarity:61},originDate:'1200 BCE',pinned:true,version:2});
 await page.reload();
 await expect(page.locator('[data-profile-field="body"]')).toBeHidden();
 await page.getByLabel('Choose visible fields for Notes & sources',{exact:true}).click();
 await page.locator('[data-visibility="body"]').check();
 await expect(page.locator('[name="body"]')).toBeVisible();
 await expect(page.locator('[name="body"]')).toHaveValue(text);
 await save(page,record.id);
 await page.reload();
 await expect(page.locator('[name="body"]')).toHaveValue(text);
 expect((await readLore(request,record.id)).hiddenFields).toEqual([]);
 await page.screenshot({path:testInfo.outputPath('lore-note-desktop.png'),fullPage:true});
});

test('a real server validation rejection keeps the draft and allows correction',async({page,request})=>{
 const record=await createLore(request);
 await openNote(page,record);
 await page.locator('[name="body"]').fill('Draft survives server validation.');
 // Simulate an older/malformed client payload; the real Worker validator, not
 // a mocked error response, rejects the forbidden visibility setting.
 await page.route('**/api/lore/'+record.id,async route=>{
  if(route.request().method()==='PUT')await route.continue({postData:JSON.stringify({...route.request().postDataJSON(),hiddenFields:['name']})});
  else await route.continue();
 },{times:1});
 const rejected=page.waitForResponse(response=>response.url().endsWith('/api/lore/'+record.id)&&response.request().method()==='PUT');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 expect((await rejected).status()).toBe(400);
 await expect(page.getByRole('alert')).toContainText('Choose visible fields');
 await expect(page.locator('[name="body"]')).toHaveValue('Draft survives server validation.');
 await expect(page.locator('[name="body"]')).toBeEditable();
 expect((await readLore(request,record.id)).body).toBe(record.body);
 await save(page,record.id);
 expect((await readLore(request,record.id)).body).toBe('Draft survives server validation.');
});

test('saving reveals and focuses an invalid input inside a collapsed section',async({page,request})=>{
 const record=await createLore(request);
 await openNote(page,record);
 const clarity=page.getByLabel('Clarity rating',{exact:true});
 await clarity.fill('100');
 await page.getByRole('button',{name:'Notes & sources',exact:true}).click();
 await expect(clarity).toBeHidden();
 const writes:string[]=[];
 page.on('request',request=>{if(request.method()==='PUT'&&request.url().endsWith('/api/lore/'+record.id))writes.push(request.url());});
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(clarity).toBeVisible();
 await expect(clarity).toBeFocused();
 expect(writes).toEqual([]);
 expect((await readLore(request,record.id)).version).toBe(1);
 await clarity.fill('99');
 await save(page,record.id);
 expect((await readLore(request,record.id)).profileRatings).toEqual({clarity:99});
});

test('story-date cancel, apply and save shortcut preserve the date contract',async({page,request})=>{
 const record=await createLore(request,{originDate:'1200 BCE'});
 await openNote(page,record);
 const date=page.locator('[name="originDate"]');
 await date.click();
 await expect(page.getByLabel('Calendar era',{exact:true})).toHaveValue('BCE');
 await expect(page.getByLabel('Calendar year',{exact:true})).toHaveValue('1200');
 await page.getByLabel('Selected date',{exact:true}).fill('An abandoned date');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(date).toBeFocused();
 await expect(date).toHaveValue('1200 BCE');
 await expect(page.locator('#save-status')).toHaveText('Saved');
 await date.press('Enter');
 await page.getByLabel('Selected date',{exact:true}).fill('Q2 1400');
 await page.getByRole('button',{name:'Use date',exact:true}).click();
 await expect(date).toHaveValue('Q2 1400');
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 expect((await readLore(request,record.id)).originDate).toBe('1200 BCE');
 await date.click();
 await expect(page.getByRole('tab',{name:'Quarter',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'Q3',exact:true}).click();
 await expect(date).toHaveValue('1400-Q3');
 await date.click();
 await page.getByLabel('Selected date',{exact:true}).fill('The first winter after the eclipse');
 const response=page.waitForResponse(response=>response.url().endsWith('/api/lore/'+record.id)&&response.request().method()==='PUT');
 await page.keyboard.press('ControlOrMeta+s');
 expect((await response).status()).toBe(200);
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('#save-status')).toHaveText('Saved');
 expect(await readLore(request,record.id)).toMatchObject({originDate:'The first winter after the eclipse',version:2});
 await page.reload();
 await expect(date).toHaveValue('The first winter after the eclipse');
});

test('zero and unset ratings stay distinct while connection search stays outside the saved draft',async({page,request})=>{
 const target=await createLore(request,{name:'Linked source '+randomUUID()});
 const record=await createLore(request,{profileRatings:{clarity:61,reliability:44},connections:[{target:{kind:'character',id:'claude'},relationship:'interprets'}]});
 await openNote(page,record);
 await page.getByLabel('Find a connected entry',{exact:true}).fill('A filter that does not match');
 await expect(page.locator('#save-status')).toHaveText('Saved');
 await expect(page.getByLabel('Connected entry',{exact:true})).toHaveValue('character::claude');
 await page.getByLabel('Clarity rating',{exact:true}).fill('0');
 await page.getByLabel('Reliability rating',{exact:true}).fill('');
 await page.getByLabel('Connection description',{exact:true}).fill('records the testimony of');
 await page.getByRole('button',{name:'Add a connection',exact:true}).click();
 await page.getByLabel('Find a connected entry',{exact:true}).last().fill(target.name);
 await page.getByLabel('Connected entry',{exact:true}).last().selectOption('lore::'+target.id);
 await page.getByLabel('Connection description',{exact:true}).last().fill('cites');
 await save(page,record.id);
 expect(await readLore(request,record.id)).toMatchObject({profileRatings:{clarity:0},connections:[{target:{kind:'character',id:'claude'},relationship:'records the testimony of'},{target:{kind:'lore',id:target.id},relationship:'cites'}]});
 expect((await readLore(request,record.id)).profileRatings).toEqual({clarity:0});
 await page.reload();
 await expect(page.getByLabel('Clarity rating',{exact:true})).toHaveValue('0');
 await expect(page.getByLabel('Reliability rating',{exact:true})).toHaveValue('');
 await expect(page.getByLabel('Connection description',{exact:true}).first()).toHaveValue('records the testimony of');
 await page.goto('/lore/'+target.id+'/');
 const backlink=page.locator('#linked-from').getByRole('link',{name:record.name,exact:true});
 await expect(backlink).toHaveAttribute('href','/lore/'+record.id+'/');
 await backlink.click();
 await expect(page).toHaveURL(origin+'/lore/'+record.id+'/');
 await expect(page.getByLabel('Connected entry',{exact:true}).last()).toHaveValue('lore::'+target.id);
});

for(const failure of ['network','session'] as const)test(`${failure} save failure retains editable text and can be retried`,async({page,request})=>{
 const record=await createLore(request);
 await openNote(page,record);
 await page.locator('[name="body"]').fill('Keep this unsaved '+failure+' draft.');
 await page.route('**/api/lore/'+record.id,async route=>{
  if(failure==='network')await route.abort('failed');
  else await route.fulfill({status:401,contentType:'text/html',body:'<!doctype html><title>Sign in</title>'});
 },{times:1});
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.locator('#save-status')).toContainText('Not saved');
 await expect(page.getByRole('alert')).toBeVisible();
 if(failure==='session')await expect(page.getByRole('alert')).toContainText(/session|sign in/i);
 await expect(page.locator('[name="body"]')).toHaveValue('Keep this unsaved '+failure+' draft.');
 await expect(page.locator('[name="body"]')).toBeEditable();
 expect((await readLore(request,record.id)).body).toBe(record.body);
 await save(page,record.id);
 expect((await readLore(request,record.id)).body).toBe('Keep this unsaved '+failure+' draft.');
});

test('a competing versioned write cannot overwrite another tab or discard the local draft',async({page,request})=>{
 const record=await createLore(request);
 await openNote(page,record);
 await page.locator('[name="body"]').fill('Unsaved text in the first tab.');
 const competing=await request.put('/api/lore/'+record.id,{headers:{origin},data:{version:record.version,body:'Saved by another tab.'}});
 expect(competing.status()).toBe(200);
 const rejected=page.waitForResponse(response=>response.url().endsWith('/api/lore/'+record.id)&&response.request().method()==='PUT');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 expect((await rejected).status()).toBe(409);
 await expect(page.getByRole('alert')).toContainText('changed in another tab');
 await expect(page.locator('[name="body"]')).toHaveValue('Unsaved text in the first tab.');
 await expect(page.locator('[name="body"]')).toBeEditable();
 expect(await readLore(request,record.id)).toMatchObject({version:2,body:'Saved by another tab.'});
});

test('keyboard saving has one owner and restores the writing focus and selection',async({page,request})=>{
 const record=await createLore(request);
 await openNote(page,record);
 const notes=page.locator('[name="body"]');
 await notes.fill('Preserve the writing cursor.');
 await notes.press('Home');
 await notes.press('Shift+ArrowRight');
 const selection=await notes.evaluate((element:HTMLTextAreaElement)=>({start:element.selectionStart,end:element.selectionEnd}));
 const writes:string[]=[];
 page.on('request',request=>{if(request.method()==='PUT'&&request.url().endsWith('/api/lore/'+record.id))writes.push(request.postData()||'');});
 let releaseSave!:()=>void;
 const savePending=new Promise<void>(resolve=>{releaseSave=resolve;});
 await page.route('**/api/lore/'+record.id,async route=>{await savePending;await route.continue();},{times:1});
 try{
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.locator('#save-status')).toHaveText('Saving…');
  await expect(notes).toBeDisabled();
  await expect(page.getByRole('button',{name:'Save changes',exact:true})).toBeDisabled();
  await page.keyboard.press('ControlOrMeta+s');
 }finally{releaseSave();}
 await expect(page.locator('#save-status')).toHaveText('Saved');
 await expect(notes).toBeFocused();
 expect(await notes.evaluate((element:HTMLTextAreaElement)=>({start:element.selectionStart,end:element.selectionEnd}))).toEqual(selection);
 expect(writes).toHaveLength(1);
 expect((await readLore(request,record.id)).version).toBe(2);
 await page.reload();
 await notes.fill('A second save after ordinary navigation.');
 await page.keyboard.press('ControlOrMeta+s');
 await expect(page.locator('#save-status')).toHaveText('Saved');
 expect(writes).toHaveLength(2);
 expect((await readLore(request,record.id)).version).toBe(3);
});

test('note controls remain operable at a narrow viewport',async({page,request},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 const record=await createLore(request);
 await openNote(page,record);
 await page.locator('[name="body"]').fill('Written on a narrow screen.');
 await save(page,record.id);
 await page.getByLabel('Choose visible fields for Notes & sources',{exact:true}).click();
 await page.locator('[data-visibility="sources"]').uncheck();
 await expect(page.locator('[data-profile-field="sources"]')).toBeHidden();
 await page.locator('[data-visibility="sources"]').check();
 await expect(page.locator('[name="sources"]')).toBeVisible();
 await page.getByLabel('Choose visible fields for Notes & sources',{exact:true}).click();
 await save(page,record.id);
 await page.locator('[name="originDate"]').click();
 const picker=page.getByRole('dialog');
 await expect(picker).toBeVisible();
 const box=await picker.boundingBox();
 expect(box).not.toBeNull();
 expect(box!.x).toBeGreaterThanOrEqual(0);
 expect(box!.y).toBeGreaterThanOrEqual(0);
 expect(box!.x+box!.width).toBeLessThanOrEqual(390);
 expect(box!.y+box!.height).toBeLessThanOrEqual(844);
 await page.screenshot({path:testInfo.outputPath('lore-note-mobile-date.png')});
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
 expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width+1);
 await page.screenshot({path:testInfo.outputPath('lore-note-mobile.png'),fullPage:true});
});

test('the compiled Worker still requires matching Origin and JSON for note mutations',async({request})=>{
 const record=await createLore(request);
 const path='/api/lore/'+record.id;
 const data={version:record.version,body:'Rejected mutation'};
 const rejectedHeaders:Record<string,string>[]=[{'content-type':'application/json'},{origin:'https://another-site.example','content-type':'application/json'},{origin,'content-type':'text/plain'}];
 for(const headers of rejectedHeaders){
  const response=await request.put(path,{headers,data:JSON.stringify(data)});
  expect(response.status()).toBe(403);
 }
 expect(await readLore(request,record.id)).toMatchObject({body:record.body,version:1});
});
