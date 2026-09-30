import {test,expect} from '@playwright/test';

test('a save during a timeline read refreshes events and each milestone opens its source',async({page})=>{
 const events=[
  {id:'character:claude:birthDate',entityId:'character:claude',name:'Claude',type:'character',kind:'birth',field:'birthDate',label:'Born',rawDate:'1980',href:'/characters/claude/#field-birthDate',date:{position:1980}},
  {id:'character:claude:deathDate',entityId:'character:claude',name:'Claude',type:'character',kind:'death',field:'deathDate',label:'Died',rawDate:'2020',href:'/characters/claude/#field-deathDate',date:{position:2020}}
 ];
 const empty={events:[],unplaced:[],undated:1,counts:{character:1}};
 const updated={...empty,events,undated:0};
 let requests=0,releaseFirst:()=>void=()=>{};
 const firstRead=new Promise<void>(resolve=>{releaseFirst=resolve;});
 await page.route('**/api/timeline*',async route=>{
  requests++;
  if(requests===1)await firstRead;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(requests===1?empty:updated)});
 });

 await page.goto('/timeline/');
 await expect.poll(()=>requests).toBe(1);
 await page.evaluate(()=>window.dispatchEvent(new Event('workspace:changed')));
 releaseFirst();

 await expect.poll(()=>requests).toBe(2);
 await expect(page.locator('#timeline-count')).toHaveText('2 events');
 const markers=page.locator('#lanes .timeline-event');
 await expect(markers).toHaveCount(2);
 await expect(markers.first()).toContainText('Born');
 await expect(markers.first()).toContainText('1980');
 await expect(markers.last()).toContainText('Died');
 await expect(markers.last()).toContainText('2020');
 await page.getByRole('link',{name:'Claude: Born, 1980'}).click();
 await expect(page).toHaveURL(/\/characters\/claude\/#field-birthDate$/);
});
