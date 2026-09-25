import {randomUUID} from 'node:crypto';
import {test,expect,type APIRequestContext,type Page} from '@playwright/test';
import {loreTemplates,loreTypes,allowedCollections} from '../../public/lore/template.js';
import {ratingGroupsFor} from '../../public/profiles/ratings.js';
import {storyArcFields,arcBeats,pacingMetrics} from '../../public/story-arcs/template.js';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
async function create(request:APIRequestContext,collection:string,fields:Record<string,unknown>){
 const response=await request.post('/api/'+collection,{headers:{origin},data:{id:randomUUID(),...fields}});
 expect(response.status(),await response.text()).toBe(201);return response.json();
}
async function save(page:Page,collection:string,id:string){
 const pending=page.waitForResponse(response=>response.url()===origin+'/api/'+collection+'/'+id&&response.request().method()==='PUT');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 const response=await pending;expect(response.status(),await response.text()).toBe(200);
 await expect(page.locator('#save-status')).toHaveText('Saved');
 return response.json();
}
async function date(page:Page,key:string,value:string){
 await page.locator(`[name="${key}"]`).click();
 await page.getByLabel('Selected date',{exact:true}).fill(value);
 await page.getByRole('button',{name:'Use date',exact:true}).click();
}

for(const type of Object.keys(loreTypes))test(`${type}: all profile inputs survive UI save and reload`,async({page,request})=>{
 test.setTimeout(90_000);
 await page.route('https://example.com/**',route=>route.abort());
 const record=await create(request,'lore',{type,name:'Full profile '+randomUUID()}),template=loreTemplates[type],expected:Record<string,unknown>={};
 const ratings:string[][]=ratingGroupsFor('lore',type).flatMap((group:{fields:string[][]})=>group.fields);
 await page.goto('/lore/'+record.id+'/');
 await expect(page.locator('#profile-form')).toBeVisible();
 // Drive every real text control, including type-specific fields and the date
 // picker. Distinct values catch a field accidentally mapped to its neighbor.
 for(const [key,,control] of template.sections.flatMap(section=>section.fields)){
  const value=key==='name'?`Saved ${type} ${record.id}`:key==='imageUrl'?`https://example.com/${type}.png`:control==='date'?'The winter before 1200 BCE':control==='textarea'?`  ${type}.${key}: α <literal>\nSecond paragraph.\n  `:`${type}.${key} — α`;
  expected[key]=value;
  if(control==='date')await date(page,key,value);else await page.locator(`[name="${key}"]`).fill(value);
 }
 const expectedRatings:Record<string,number>={};
 for(const [index,[key,label]] of ratings.entries()){
  const value=index%2?99:0;expectedRatings[key]=value;
  await page.getByLabel(label+' rating',{exact:true}).fill(String(value));
  await expect(page.getByLabel(label+' rating',{exact:true})).toHaveValue(String(value));
 }
 for(const collection of allowedCollections(type)){
  const control=page.locator(`[data-collection="${collection}"]`);
  if(!await control.isDisabled())await control.check();
 }
 await page.getByLabel('Pin to Continue building',{exact:true}).check();
 await page.getByLabel('Feature on Lore',{exact:true}).check();
 await page.getByRole('button',{name:'Add a connection',exact:true}).click();
 await page.getByLabel('Connected entry',{exact:true}).selectOption('character::claude');
 await page.getByLabel('Connection description',{exact:true}).fill('interprets the record');
 await page.getByLabel('Choose visible fields for Truth & belief',{exact:true}).click();
 await page.locator('[data-visibility="truth"]').uncheck();
 await page.getByLabel('Choose visible fields for Truth & belief',{exact:true}).click();
 const saved=await save(page,'lore',record.id);
 const persistent={...expected,profileRatings:expectedRatings,hiddenFields:['truth'],collections:expect.arrayContaining(allowedCollections(type)),pinned:true,featured:true,connections:[{target:{kind:'character',id:'claude'},relationship:'interprets the record'}]};
 expect(saved).toMatchObject(persistent);
 const reloaded=await (await request.get('/api/lore/'+record.id)).json();expect(reloaded).toEqual(saved);
 await page.reload();
 for(const [key,value] of Object.entries(expected))await expect(page.locator(`[name="${key}"]`)).toHaveValue(String(value));
 for(const [key,label] of ratings)await expect(page.getByLabel(label+' rating',{exact:true})).toHaveValue(String(expectedRatings[key]));
 await expect(page.locator('[data-profile-field="truth"]')).toBeHidden();
 await expect(page.getByLabel('Connection description',{exact:true})).toHaveValue('interprets the record');
 // Empty values, removals, and unchecked controls must clear stored values.
 await page.locator('[name="summary"]').fill('');
 await page.getByLabel(ratings[0][1]+' rating',{exact:true}).fill('');
 await page.getByLabel('Pin to Continue building',{exact:true}).uncheck();
 await page.getByRole('button',{name:'Remove',exact:true}).click();
 const cleared=await save(page,'lore',record.id);
 expect(cleared.summary).toBe('');expect(cleared.pinned).toBe(false);expect(cleared.connections).toEqual([]);
 expect(cleared.profileRatings).not.toHaveProperty(ratings[0][0]);expect(cleared.truth).toBe(expected.truth);
});

test('story arcs persist every answer, pacing slider, relationship and key scene from the UI',async({page,request})=>{
 test.setTimeout(90_000);
 const arc=await create(request,'story-arcs',{}),other=await create(request,'story-arcs',{name:'Connected outline '+randomUUID()}),expected:Record<string,unknown>={};
 await page.goto('/story-arcs/'+arc.id+'/');
 await expect(page.locator('#profile-form')).toBeVisible();
 for(const key of storyArcFields){
  const value=key==='name'?'Full narrative audit':key==='arcType'?'Political Subplot':key==='status'?'Revising':key==='startDate'?'circa 1200 BCE':key==='endDate'?'The next winter':`  ${key}: α <literal>\nA second paragraph.\n  `;
  expected[key]=value;
  if(key.endsWith('Date'))await date(page,key,value);
  else if(['arcType','status'].includes(key))await page.locator(`[name="${key}"]`).selectOption(value);
  else await page.locator(`[name="${key}"]`).fill(value);
 }
 const pacing:Record<string,Record<string,number>>={};
 for(const [index,beat] of arcBeats.entries()){
  pacing[beat.id]={};
  for(const [offset,[metric]] of pacingMetrics.entries()){
   const control=page.locator(`[data-pacing-beat="${beat.id}"][data-pacing-metric="${metric}"]`),value=(index+offset)%2?99:0;
   await control.focus();await control.press(value===99?'End':'Home');pacing[beat.id][metric]=value;
  }
 }
 const keyEntities=[{kind:'character',id:'claude'},{kind:'faction',id:'sample-ember'},{kind:'location',id:'sample-capital'}];
 for(const reference of keyEntities)await page.getByLabel('Add a key entity',{exact:true}).selectOption(reference.kind+':'+reference.id);
 await page.getByRole('button',{name:'Add connected arc',exact:true}).click();
 await page.getByLabel('Connected story arc',{exact:true}).selectOption(other.id);
 const scenes=[];
 for(const [index,beat] of arcBeats.entries()){
  await page.getByRole('button',{name:'Add key scene',exact:true}).click();
  const row=page.locator('.key-scene-row').last(),scene={title:`Pivot ${index+1}`,chapter:`Chapter ${index+1}`,beat:beat.id,summary:`  Change at ${beat.id}.\nSecond paragraph.\n  `};
  await row.getByLabel('Scene',{exact:true}).fill(scene.title);await row.getByLabel('Chapter',{exact:true}).fill(scene.chapter);
  await row.getByRole('combobox',{name:'Beat',exact:true}).selectOption(scene.beat);await row.getByLabel('Purpose & change',{exact:true}).fill(scene.summary);scenes.push(scene);
 }
 await page.getByLabel('Choose visible fields for Stakes & consequences',{exact:true}).click();
 await page.locator('[data-visibility="internalStakes"]').uncheck();
 await page.getByLabel('Choose visible fields for Stakes & consequences',{exact:true}).click();
 const saved=await save(page,'story-arcs',arc.id);
 expect(saved).toMatchObject({...expected,pacing,keyEntities,connectedArcIds:[other.id],hiddenFields:['internalStakes']});
 expect(saved.keyScenes).toEqual(scenes.map(scene=>expect.objectContaining(scene)));
 const sceneIds=saved.keyScenes.map((scene:{id:string})=>scene.id);expect(new Set(sceneIds).size).toBe(6);
 expect(await (await request.get('/api/story-arcs/'+arc.id)).json()).toEqual(saved);
 await page.reload();
 for(const [key,value] of Object.entries(expected))await expect(page.locator(`[name="${key}"]`)).toHaveValue(String(value));
 for(const [beat,metrics] of Object.entries(pacing))for(const [metric,value] of Object.entries(metrics))await expect(page.locator(`[data-pacing-beat="${beat}"][data-pacing-metric="${metric}"]`)).toHaveValue(String(value));
 for(const [index,scene] of scenes.entries())await expect(page.locator('.key-scene-row').nth(index).getByLabel('Purpose & change',{exact:true})).toHaveValue(scene.summary);
 await page.locator('.key-scene-row').first().getByRole('button',{name:'Remove scene',exact:true}).click();
 await page.locator('#connected-arc-list').getByRole('button',{name:'Remove',exact:true}).click();
 await page.locator('#key-entity-values').getByRole('button',{name:'Remove Claude',exact:true}).click();
 const reduced=await save(page,'story-arcs',arc.id);
 expect(reduced.keyScenes.map((scene:{id:string})=>scene.id)).toEqual(sceneIds.slice(1));
 expect(reduced.keyEntities).toEqual(keyEntities.slice(1));expect(reduced.connectedArcIds).toEqual([]);
});

test('unavailable selected story entities stay visible and preserve their reference through saving',async({page,request})=>{
 const arc=await create(request,'story-arcs',{name:'Unavailable entity audit',keyEntities:[{kind:'character',id:'claude'}]});
 // Simulate a historical record whose reference is no longer in the selector's
 // current catalog. Its stored reference must not depend on display metadata.
 await page.route('**/story-arcs/'+arc.id+'/',async route=>{
  const response=await route.fetch(),html=await response.text();
  const body=html.replace(/(<script id="profile-data" type="application\/json">)(.*?)(<\/script>)/s,(_match,open:string,serialized:string,close:string)=>{
   const data=JSON.parse(serialized);data.targets=data.targets.filter((target:{kind:string;id:string})=>target.kind!=='character'||target.id!=='claude');
   return open+JSON.stringify(data).replaceAll('<','\\u003c')+close;
  });await route.fulfill({response,body});
 });
 await page.goto('/story-arcs/'+arc.id+'/');
 await expect(page.locator('#key-entity-values')).toContainText('Unavailable character (claude)');
 await page.locator('[name="summary"]').fill('An unrelated edit must retain the reference.');
 const saved=await save(page,'story-arcs',arc.id);expect(saved.keyEntities).toEqual([{kind:'character',id:'claude'}]);
 await page.getByRole('button',{name:'Remove Unavailable character (claude)',exact:true}).click();
 expect((await save(page,'story-arcs',arc.id)).keyEntities).toEqual([]);
});

for(const action of ['apply','cancel'] as const)test(`a queued calendar ${action} event cannot redirect typing away from the next field`,async({page,request})=>{
 const record=await create(request,'lore',{type:'jewel',name:'Calendar focus audit',originDate:'1200 BCE'});
 await page.goto('/lore/'+record.id+'/');
 await page.locator('[name="originDate"]').click();
 await page.getByLabel('Selected date',{exact:true}).fill('1300 BCE');
 // The browser closes <dialog> and returns focus immediately, then queues its
 // native close event. Focus another real input in that gap to deterministically
 // exercise the race seen when editing a profile quickly after choosing a date.
 const focused=await page.evaluate(action=>new Promise<string>(resolve=>{
  const dialog=document.querySelector<HTMLDialogElement>('#profile-date-picker')!,rating=document.querySelector<HTMLInputElement>('#profile-rating-physicalImpact')!;
  dialog.addEventListener('close',()=>queueMicrotask(()=>resolve(document.activeElement?.id||'')),{once:true});
  dialog.querySelector<HTMLButtonElement>(action==='apply'?'.date-apply':'.date-picker-footer button')!.click();
  rating.focus();
 }),action);
 expect(focused).toBe('profile-rating-physicalImpact');
 await page.keyboard.insertText('0');
 await expect(page.getByLabel('Physical impact rating',{exact:true})).toHaveValue('0');
 const saved=await save(page,'lore',record.id);
 expect(saved.profileRatings).toEqual({physicalImpact:0});expect(saved.originDate).toBe(action==='apply'?'1300 BCE':'1200 BCE');
});

test('legacy calendar keyboard cancel and apply retain the normal date-field focus',async({page,request})=>{
 const record=await create(request,'lore',{type:'artifact',name:'Calendar keyboard audit',originDate:'1200 BCE'});
 await page.goto('/lore/'+record.id+'/');
 const source=page.locator('[name="originDate"]');await source.focus();await source.press('Enter');
 await page.getByLabel('Selected date',{exact:true}).fill('1300 BCE');await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toBeHidden();await expect(source).toBeFocused();await expect(source).toHaveValue('1200 BCE');
 await source.press('Enter');await page.getByLabel('Selected date',{exact:true}).fill('1400 BCE');await page.getByLabel('Selected date',{exact:true}).press('Enter');
 await expect(page.getByRole('dialog')).toBeHidden();await expect(source).toBeFocused();await expect(source).toHaveValue('1400 BCE');
 expect((await save(page,'lore',record.id)).originDate).toBe('1400 BCE');
});

test('chapter edits, scene metadata and every supported prose format survive the writing UI',async({page,request})=>{
 const first=await create(request,'chapters',{title:'Original chapter '+randomUUID(),summary:'Original summary'}),second=await create(request,'chapters',{title:'Destination chapter '+randomUUID()});
 const scene=await create(request,'scenes',{chapterId:first.id,title:'Original scene',status:'draft',contentSchemaVersion:1,content:{type:'doc',content:[{type:'paragraph'}]}});
 await page.goto('/chapters/');
 await page.getByRole('button',{name:'Edit chapter: '+first.title,exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Edit chapter',exact:true}),chapterTitle='Revised chapter '+randomUUID(),chapterSummary='  A revised chapter plan.\nWith deliberate whitespace.\n  ';
 await dialog.getByLabel('Chapter title',{exact:true}).fill(chapterTitle);await dialog.getByLabel('Chapter summary',{exact:true}).fill(chapterSummary);
 const chapterResponse=page.waitForResponse(response=>response.url()===origin+'/api/chapters/'+first.id&&response.request().method()==='PUT');
 await dialog.getByRole('button',{name:'Save chapter',exact:true}).click();expect((await chapterResponse).status()).toBe(200);
 expect(await (await request.get('/api/chapters/'+first.id)).json()).toMatchObject({title:chapterTitle,summary:chapterSummary,version:2});
 await page.reload();await page.getByRole('button',{name:'Edit chapter: '+chapterTitle,exact:true}).click();
 await expect(dialog.getByLabel('Chapter summary',{exact:true})).toHaveValue(chapterSummary);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.goto('/scenes/?scene='+scene.id);
 const editor=page.getByRole('textbox',{name:'Scene text',exact:true});await expect(editor).toBeVisible();
 await page.getByLabel('Scene title',{exact:true}).fill('Revised scene');
 await page.getByLabel('Scene chapter',{exact:true}).selectOption(second.id);
 await page.getByLabel('Scene status',{exact:true}).selectOption('complete');
 await page.locator('.writing-summary > summary').click();
 const summary='  The scene changes chapters.\nKeep its context.\n  ';await page.getByLabel('Scene summary',{exact:true}).fill(summary);
 await editor.click();
 await editor.evaluate(element=>{
  const clipboard=new DataTransfer();
  clipboard.setData('text/html','<h1>Heading one</h1><h2>Heading two</h2><h3>Heading three</h3><p>Plain <strong>bold</strong> <em>italic</em> <u>underline</u> <s>strike</s> <code>code</code><br>After a break.</p><blockquote><p>A quotation.</p></blockquote><ul><li><p>A bullet.</p></li></ul><ol start="7" type="I"><li><p>Numbered seven.</p></li></ol><hr><p>Closing paragraph.</p>');
  element.dispatchEvent(new ClipboardEvent('paste',{clipboardData:clipboard,bubbles:true,cancelable:true}));
 });
 await expect(editor.locator('h1')).toHaveText('Heading one');await expect(editor.locator('ol')).toHaveAttribute('start','7');
 const html=await editor.innerHTML(),pending=page.waitForResponse(response=>response.url()===origin+'/api/scenes/'+scene.id&&response.request().method()==='PUT');
 await page.getByRole('button',{name:'Save scene',exact:true}).click();const response=await pending;expect(response.status(),await response.text()).toBe(200);
 const saved=await response.json();expect(saved).toMatchObject({schemaVersion:1,version:2,chapterId:second.id,title:'Revised scene',summary,status:'complete',contentSchemaVersion:1});
 expect(await (await request.get('/api/scenes/'+scene.id)).json()).toEqual(saved);
 const encoded=JSON.stringify(saved.content);for(const type of ['paragraph','heading','text','bold','italic','underline','strike','code','hardBreak','blockquote','bulletList','orderedList','listItem','horizontalRule'])expect(encoded).toContain(`"type":"${type}"`);
 await page.reload();await expect(editor).toBeVisible();expect(await editor.innerHTML()).toBe(html);
 await expect(page.getByLabel('Scene chapter',{exact:true})).toHaveValue(second.id);await expect(page.getByLabel('Scene status',{exact:true})).toHaveValue('complete');
 await expect(page.getByLabel('Scene summary',{exact:true})).toHaveValue(summary);
});
