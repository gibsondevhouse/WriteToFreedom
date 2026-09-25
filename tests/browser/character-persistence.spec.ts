import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {test,expect,type APIRequestContext,type Page} from '@playwright/test';
import {templateSections, humanChoices, storyRoles, alignments, nameFields} from '../../public/characters/template.js';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
async function createCharacter(request:APIRequestContext){
 const response=await request.post('/api/characters',{headers:{origin},data:{id:randomUUID(),name:'Persistence '+randomUUID()}});
 expect(response.status(),await response.text()).toBe(201);return response.json();
}
async function readCharacter(request:APIRequestContext,id:string){return (await request.get('/api/characters/'+id)).json();}
async function save(page:Page,id:string){
 const pending=page.waitForResponse(response=>response.url()===origin+'/api/characters/'+id&&response.request().method()==='PUT');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 const response=await pending;expect(response.status(),await response.text()).toBe(200);
 await expect(page.locator('#save-status')).toHaveText('Saved');return response.json();
}
async function setDate(page:Page,key:string,text:string){
 await page.locator('[name="'+key+'"]').click();
 await page.getByLabel('Selected date',{exact:true}).fill(text);
 await page.getByRole('button',{name:'Use date',exact:true}).click();
}
async function openNoteComposer(page:Page,field='arc'){
 const section=page.locator('section').filter({has:page.locator('[name="'+field+'"]')});
 await section.locator('.field-menu summary').click();
 await section.getByRole('button',{name:'Create a note',exact:true}).click();
 const source=page.locator('[name="'+field+'"]');await source.press('End');await source.press('Enter');
 await expect(page.locator('.note-composer:not(.note-item-composer)')).toBeVisible();
}

test('every character template input survives editing, save, reload and a second save',async({page,request})=>{
 test.setTimeout(90_000);
 const record=await createCharacter(request),expected:Record<string,string>={};
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/characters/'+record.id+'/');
 const fields=templateSections.flatMap(section=>section.fields);
 for(const [key,label,type] of fields){
  const input=page.locator('[name="'+key+'"]');
  let value=nameFields.includes(key)?key+'-Éowyn':label+' <literal>\nA second line.';
  if(type==='choice'){
   value='Custom '+label;
   const control=page.locator('[data-choice-field="'+key+'"]');
   await control.locator('[data-choice-select]').selectOption('__custom__');
   await control.locator('[data-choice-custom-input]').fill(value);
   await control.locator('[data-choice-add]').click();
  }else if(type==='date'){
   value='The third winter of the Silver Era';await setDate(page,key,value);
  }else if(type==='faction'){
   value='sample-ember';await input.selectOption(value);
  }else if(type==='location'||type==='country'){
   value=type==='country'?'sample-kingdom':'sample-capital';await input.selectOption(value);
  }else if(type==='select'){
   value=(humanChoices as Record<string,string[]>)[key]?.[0]||(key==='alignment'?alignments[0]:storyRoles[0]);await input.selectOption(value);
  }else{
   if(type==='url')value='https://example.com/portrait.png';
   else if(type==='number')value=key==='age'?'0':'172.25';
   else if(type==='input')value=value.replace('\n',' ');
   await input.fill(value);
  }
  expected[key]=value;
 }
 await page.getByLabel('Strength rating',{exact:true}).fill('0');
 await page.getByLabel('Empathy rating',{exact:true}).fill('99');
 await page.getByRole('button',{name:'+ Add relationship',exact:true}).click();
 const relationship=page.locator('.relationship-row');
 await relationship.locator('select').selectOption('claude');
 await relationship.locator('input').fill('Sister / rival');
 await relationship.locator('summary').click();
 await relationship.getByLabel('Relationship dynamic',{exact:true}).fill('A promise\nwith a cost.');
 await page.getByLabel('Choose visible fields for Biography',{exact:true}).click();
 await page.locator('[data-visibility="earlyLife"]').uncheck();
 await save(page,record.id);
 let saved=await readCharacter(request,record.id);
 for(const [key,value] of Object.entries(expected))expect(saved[key],key).toBe(value);
 expect(saved).toMatchObject({attributeRatings:{strength:0,empathy:99},hiddenFields:['earlyLife'],relationships:[{targetId:'claude',type:'Sister / rival',description:'A promise\nwith a cost.'}]});
 await page.reload();
 for(const [key,value] of Object.entries(expected))await expect(page.locator('[name="'+key+'"]'),key).toHaveValue(value);
 await expect(page.locator('[data-profile-field="earlyLife"]')).toBeHidden();
 await expect(page.getByLabel('Strength rating',{exact:true})).toHaveValue('0');
 await save(page,record.id);saved=await readCharacter(request,record.id);
 for(const [key,value] of Object.entries(expected))expect(saved[key],key+' second save').toBe(value);
 expect(errors).toEqual([]);
});

test('authored note text, inline reference labels, linked draft notes and moved markers survive reload',async({page,request})=>{
 const record=await createCharacter(request);
 await page.goto('/characters/'+record.id+'/');
 await page.locator('[name="arc"]').fill('A promise.');
 await openNoteComposer(page);
 await page.locator('#note-title').fill('Witness account');await page.locator('#note-type').selectOption('update');
 await page.locator('#note-text').fill('Ask ');
 await page.locator('#note-link-target').selectOption('character::claude');
 await page.locator('.note-composer:not(.note-item-composer)').getByRole('button',{name:'Insert',exact:true}).click();
 await page.locator('#note-text').press('End');await page.locator('#note-text').pressSequentially('about the oath.');
 await page.getByRole('button',{name:'＋ Create new item',exact:true}).click();
 await page.locator('#note-item-type').selectOption('note');
 await page.locator('#note-item-name').fill('Unplaced source');await page.locator('#note-item-text').fill('The original testimony.');
 await page.getByRole('button',{name:'Create and insert',exact:true}).click();
 await page.getByRole('button',{name:'Add note',exact:true}).click();
 const first=await save(page,record.id);
 expect(first.notes).toHaveLength(2);
 expect(first.notes[0]).toMatchObject({field:'arc',position:null,title:'Unplaced source',text:'The original testimony.'});
 expect(first.notes[1]).toMatchObject({field:'arc',position:10,title:'Witness account',type:'update',links:[{kind:'character',id:'claude'},{kind:'note',id:first.notes[0].id,characterId:record.id}]});
 expect(first.notes[1].content.filter((part:{ref?:unknown})=>part.ref).map((part:{text:string})=>part.text)).toEqual(['Claude','Unplaced source']);
 expect(first.arc).toBe('A promise.[2]');
 await page.reload();
 await expect(page.locator('#authored-notes .note-inline-link')).toHaveText(['Claude','Unplaced source']);
 await page.locator('#note-'+first.notes[0].id).getByRole('button',{name:'Place in text',exact:true}).click();
 await page.locator('[name="arc"]').press('Home');await page.locator('[name="arc"]').press('Enter');
 const placed=await save(page,record.id);
 expect(placed.arc).toBe('[1]A promise.[2]');expect(placed.notes.map((note:{position:number})=>note.position)).toEqual([0,13]);
 await page.locator('#note-'+first.notes[0].id).getByRole('button',{name:'Remove',exact:true}).click();
 const removed=await save(page,record.id);
 expect(removed.arc).toBe('A promise.[1]');expect(removed.notes[0].position).toBe(10);
 // Removed targets remain readable authored references; deleting one must not discard the containing note.
 expect(removed.notes[0].content).toEqual(first.notes[1].content);
 await page.reload();await expect(page.locator('[name="arc"]')).toHaveValue('A promise.[1]');
});

test('custom multi-select labels retain their exact boundaries and nationality assignments across reload',async({page,request})=>{
 const record=await createCharacter(request),continentId=randomUUID();
 const continent=await request.post('/api/locations',{headers:{origin},data:{id:continentId,name:'Two Shores',type:'continent',parentId:null}});
 expect(continent.status(),await continent.text()).toBe(201);
 await page.goto('/characters/'+record.id+'/');
 const selections={roles:['Archivist, records; keeper','Moon · Tide interpreter'],nationality:['North · South Islander','__proto__']};
 for(const [key,labels] of Object.entries(selections)){
  const control=page.locator('[data-choice-field="'+key+'"]');
  for(const label of labels){
   await control.locator('[data-choice-select]').selectOption('__custom__');
   await control.locator('[data-choice-custom-input]').fill(label);
   if(key==='nationality')await control.locator('[data-nationality-continent]').selectOption(continentId);
   await control.locator('[data-choice-add]').click();
  }
 }
 let saved=await save(page,record.id);
 expect(saved.choiceSelections).toMatchObject(selections);
 expect(saved.nationalityContinents).toEqual(Object.fromEntries(selections.nationality.map(label=>[label,continentId])));
 await page.reload();
 for(const [key,labels] of Object.entries(selections))await expect(page.locator('[data-choice-field="'+key+'"] .choice-chip > span')).toHaveText(labels);
 const nationalityOption=page.locator('[data-choice-field="nationality"] optgroup[data-continent="'+continentId+'"] option');
 await expect(nationalityOption).toHaveText(selections.nationality);
 saved=await save(page,record.id);expect(saved.choiceSelections).toMatchObject(selections);expect(saved.nationalityContinents).toEqual(Object.fromEntries(selections.nationality.map(label=>[label,continentId])));
 for(const path of ['/api/characters?view=cards','/api/dashboard']){
  const payload=await (await request.get(path)).json();expect(payload.characters.find((character:{id:string})=>character.id===record.id).roles).toEqual(selections.roles);
 }
});

test('character card edits persist independently and preserve full profile text and notes',async({page,request})=>{
 const record=await createCharacter(request),noteId=randomUUID();
 const response=await request.put('/api/characters/'+record.id,{headers:{origin},data:{...record,biography:'A detailed biography.',attributeRatings:{strength:58,speed:44},notes:[{id:noteId,field:'biography',position:null,text:'An unplaced research note.'}]}});
 expect(response.status()).toBe(200);
 await page.goto('/characters/');
 const card=page.locator('[data-character-id="'+record.id+'"]');
 await card.getByRole('button',{name:'More about '+record.name,exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Height',{exact:true}).fill('0');await dialog.getByLabel('Height unit',{exact:true}).selectOption('in');
 await dialog.getByLabel('Weight',{exact:true}).fill('72.5');await dialog.getByLabel('Weight unit',{exact:true}).selectOption('kg');
 await dialog.getByLabel('Moral alignment',{exact:true}).selectOption('Changing');
 await dialog.getByRole('tab',{name:'Ratings',exact:true}).click();
 await dialog.getByLabel('Strength rating',{exact:true}).fill('0');await dialog.getByLabel('Speed rating',{exact:true}).fill('');
 await dialog.locator('summary').click();await dialog.getByLabel('Portrait image URL',{exact:true}).fill('https://example.com/updated.png');
 await dialog.getByRole('button',{name:'Save ratings',exact:true}).click();await expect(dialog.locator('.character-detail-notice')).toHaveText('Saved');
 await dialog.getByRole('button',{name:'Close character details',exact:true}).click();
 await card.getByRole('button',{name:'Change featured item for '+record.name,exact:true}).click();
 await dialog.getByLabel('Find an item',{exact:true}).fill('Claude');
 await dialog.getByRole('radio').last().check();
 await dialog.getByRole('button',{name:'Save featured item',exact:true}).click();await expect(dialog).toHaveCount(0);
 const saved=await readCharacter(request,record.id);
 expect(saved).toMatchObject({height:'0',heightUnit:'in',weight:'72.5',weightUnit:'kg',alignment:'Changing',portraitUrl:'https://example.com/updated.png',attributeRatings:{strength:0},biography:'A detailed biography.',cardConnection:{kind:'character',id:'claude'},notes:[{id:noteId,text:'An unplaced research note.'}]});
 expect(saved.attributeRatings).toEqual({strength:0});
 await page.reload();await card.getByRole('button',{name:'More about '+record.name,exact:true}).click();
 await expect(dialog.getByLabel('Height',{exact:true})).toHaveValue('0');
 await dialog.getByRole('tab',{name:'Ratings',exact:true}).click();
 await expect(dialog.getByLabel('Strength rating',{exact:true})).toHaveValue('0');await expect(dialog.getByLabel('Speed rating',{exact:true})).toHaveValue('');
});

test('legacy duplicate and unspaced multi-select text reopens and saves as valid exact choices',async({page,request})=>{
 const record=await createCharacter(request);
 // Only the Playwright-owned temporary database is used, never author data.
 const directory=process.env.WTF_BROWSER_TEST_DIRECTORY;
 if(!directory)throw new Error('The browser fixture database directory is missing.');
 const sqlite=new DatabaseSync(join(directory,'browser.sqlite'));
 try{sqlite.prepare("UPDATE character_drafts SET document = json_set(document, '$.roles', ?, '$.languages', ?, '$.faith', ?), version = version + 1 WHERE id = ?").run('Archivist·Interpreter·Archivist','English·French','   ',record.id);}
 finally{sqlite.close();}
 await page.goto('/characters/'+record.id+'/');
 await expect(page.locator('[data-choice-field="roles"] .choice-chip > span')).toHaveText(['Archivist','Interpreter']);
 const saved=await save(page,record.id);
 expect(saved.choiceSelections).toMatchObject({roles:['Archivist','Interpreter'],languages:['English','French'],faith:[]});
 expect(saved.roles).toBe('Archivist · Interpreter');expect(saved.faith).toBe('');
 await page.reload();await save(page,record.id);
});

test('numeric text keeps accepted author formatting through profile and unrelated card saves',async({page,request})=>{
 for(const values of [{age:'+12',height:'12.',weight:' 0x10 '},{age:'\n+12\n',height:'\r\n12.\r\n',weight:' \n0x10\r '}]){
 const record=await createCharacter(request),display=(value:string)=>value.replace(/[\r\n]/g,'');
 const response=await request.put('/api/characters/'+record.id,{headers:{origin},data:{...record,...values}});
 expect(response.status(),await response.text()).toBe(200);
 await page.goto('/characters/'+record.id+'/');
 for(const [key,value] of Object.entries(values))await expect(page.locator('[name="'+key+'"]')).toHaveValue(display(value));
 expect(await save(page,record.id)).toMatchObject(values);
 await page.reload();
 for(const [key,value] of Object.entries(values))await expect(page.locator('[name="'+key+'"]')).toHaveValue(display(value));
 await page.goto('/characters/');
 await page.locator('[data-character-id="'+record.id+'"]').getByRole('button',{name:'More about '+record.name,exact:true}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByLabel('Height',{exact:true})).toHaveValue(display(values.height));
 await expect(dialog.getByLabel('Weight',{exact:true})).toHaveValue(display(values.weight));
 await dialog.getByLabel('Moral alignment',{exact:true}).selectOption('Good');
 await dialog.getByRole('button',{name:'Save details',exact:true}).click();await expect(dialog.locator('.character-detail-notice')).toHaveText('Saved');
 expect(await readCharacter(request,record.id)).toMatchObject({...values,alignment:'Good'});
 }
});

test('numeric text validates profile and card drafts before saving and allows clearing measurements',async({page,request})=>{
 const record=await createCharacter(request);
 await page.goto('/characters/'+record.id+'/');
 const age=page.locator('[name="age"]'),height=page.locator('[name="height"]'),weight=page.locator('[name="weight"]');
 const writes:string[]=[];page.on('request',request=>{if(request.method()==='PUT'&&request.url().endsWith('/api/characters/'+record.id))writes.push(request.url());});
 await age.fill('3.5');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(age).toBeFocused();expect(await age.evaluate((input:HTMLInputElement)=>input.validity.customError)).toBe(true);expect(writes).toEqual([]);
 await age.fill('');await height.fill('-1');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(height).toBeFocused();expect(writes).toEqual([]);
 await height.fill('');await weight.fill('not a number');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(weight).toBeFocused();expect(writes).toEqual([]);
 await weight.fill('');expect(await save(page,record.id)).toMatchObject({age:'',height:'',weight:''});
 const saved=await readCharacter(request,record.id);
 for(const invalid of [{age:'3.5'},{height:'-1'},{weight:'Infinity'}]){
  const rejected=await request.put('/api/characters/'+record.id,{headers:{origin},data:{...saved,...invalid}});
  expect(rejected.status()).toBe(400);
 }
 await page.goto('/characters/');
 await page.locator('[data-character-id="'+record.id+'"]').getByRole('button',{name:'More about '+record.name,exact:true}).click();
 const dialog=page.getByRole('dialog'),cardHeight=dialog.getByLabel('Height',{exact:true});
 await cardHeight.fill('-5');await dialog.getByRole('button',{name:'Save details',exact:true}).click();
 await expect(cardHeight).toBeFocused();expect(writes).toHaveLength(1);
 await cardHeight.fill('');await dialog.getByRole('button',{name:'Save details',exact:true}).click();
 await expect(dialog.locator('.character-detail-notice')).toHaveText('Saved');
 expect(await readCharacter(request,record.id)).toMatchObject({age:'',height:'',weight:''});
});
