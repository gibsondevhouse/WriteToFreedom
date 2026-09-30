import {randomUUID} from 'node:crypto';
import {test,expect} from '@playwright/test';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');

test('story arc pacing spans the article above the overview and information rail',async({page,request})=>{
 const response=await request.post('/api/story-arcs',{
  headers:{origin},data:{id:randomUUID(),name:'The river crossing'},
 });
 expect(response.status(),await response.text()).toBe(201);
 const arc=await response.json();

 for(const width of [1440,900,390]){
  await page.setViewportSize({width,height:900});
  await page.goto('/story-arcs/'+arc.id+'/');
  await expect(page.locator('#profile-form')).toBeVisible();
  await expect(page.locator('#pacing')).toBeVisible();
  await expect(page.locator('#overview')).toBeVisible();
  await expect(page.locator('#identity')).toBeVisible();
  await expect(page.locator('#editor-fields>article>.profile-leading>#pacing')).toHaveCount(1);
  await expect(page.locator('#editor-fields>article>.profile-content>#overview')).toHaveCount(1);
  await page.evaluate(()=>document.fonts.ready);

  const article=(await page.locator('#editor-fields>article').boundingBox())!;
  const pacing=(await page.locator('#pacing').boundingBox())!;
  const overview=(await page.locator('#overview').boundingBox())!;
  const identity=(await page.locator('#identity').boundingBox())!;
  expect(Math.abs(pacing.x-article.x),`${width}px pacing starts at the article edge`).toBeLessThan(2);
  expect(Math.abs(pacing.width-article.width),`${width}px pacing uses the full article width`).toBeLessThan(2);
  expect(Math.abs(overview.x-article.x),`${width}px overview starts at the article edge`).toBeLessThan(2);
  expect(identity.y,`${width}px information rail starts below pacing`).toBeGreaterThanOrEqual(pacing.y+pacing.height);
  if(width>650){
   expect(overview.y,`${width}px overview starts below pacing`).toBeGreaterThanOrEqual(pacing.y+pacing.height);
   expect(identity.x,`${width}px rail sits beside the overview`).toBeGreaterThanOrEqual(overview.x+overview.width);
   expect(Math.abs(identity.y-overview.y),`${width}px rail and overview start together`).toBeLessThan(35);
   expect(overview.width,`${width}px overview stays in the main column`).toBeLessThan(article.width-identity.width);
  }else{
   expect(overview.y,`${width}px overview follows the rail in document order`).toBeGreaterThanOrEqual(identity.y+identity.height);
   expect(Math.abs(overview.width-article.width),`${width}px overview fills the mobile article`).toBeLessThan(2);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px profile has no horizontal overflow`).toBe(true);
 }
});
