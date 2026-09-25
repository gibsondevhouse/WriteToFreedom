import {test,expect,type Page} from '@playwright/test';
import {worldProfileCases,createWorldProfile,populatedWorldProfile,profileEndpoint,profilePage} from '../world-profile-fixtures.mjs';

const origin='http://127.0.0.1:'+(process.env.WTF_BROWSER_TEST_PORT||'4175');
async function chooseCustom(page:Page,key:string,value:string){
 const control=page.locator(`[data-choice-field="${key}"]`);
 await control.locator('[data-choice-select]').selectOption('__custom__');
 await control.locator('[data-choice-custom-input]').fill(value);
 await control.locator('[data-choice-add]').click();
}

for(const profile of worldProfileCases)test(`${profile.type}: every authoring control saves and reopens through the real browser`,async({page,request})=>{
 const json=async(path:string,method='GET',body?:unknown)=>{
  const response=await request.fetch(path,{method,headers:{origin},...(body===undefined?{}:{data:body})});
  expect(response.ok(),`${method} ${path}: ${await response.text()}`).toBe(true);
  return response.json();
 };
 const {record,references}=await createWorldProfile(profile.type,json),endpoint=profileEndpoint(profile.type,record.id);
 const written=populatedWorldProfile(profile,record,references) as Record<string,unknown>;
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://example.invalid/**',route=>route.abort());
 expect((await page.goto(profilePage(profile.type,record.id)))?.status()).toBe(200);
 await expect(page.locator('[name^="profile-rating-"]').first()).toBeVisible();
 for(const [key,,control] of profile.fields){
  const field=page.locator(`#profile-form [name="${key}"]`);
  expect(await field.count(),`${key}: one control`).toBe(1);
  if(control==='date'){
   await field.click();
   await page.getByLabel('Selected date',{exact:true}).fill(String(written[key]));
   await page.getByRole('button',{name:'Use date',exact:true}).click();
  }else if(control==='choice'){
   if(key==='officialLanguages'){
    await page.locator(`[data-choice-field="${key}"] [data-choice-select]`).selectOption('French');
    await chooseCustom(page,key,'River · speech');
    written[key]='French · River · speech';
    written.choiceSelections={officialLanguages:['French','River · speech']};
   }else await chooseCustom(page,key,String(written[key]));
  }else if(['character','select','area-type','world','city','country','location'].includes(control))await field.selectOption(String(written[key]));
  else await field.fill(String(written[key]));
  await expect(field,`${key}: entered value`).toHaveValue(String(written[key]));
 }
 for(const [key,value] of Object.entries(written.profileRatings as Record<string,number>))await page.locator(`[name="profile-rating-${key}"]`).fill(String(value));
 for(const menu of await page.locator('.field-menu').all()){
  await menu.locator('summary').click();
  await menu.locator('[data-visibility-all="hide"]').click();
  await menu.locator('summary').click();
 }
 await expect(page.locator('#save-status')).toHaveText('Unsaved changes');
 const responsePromise=page.waitForResponse(response=>response.url()===origin+endpoint&&response.request().method()==='PUT');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 const response=await responsePromise;expect(response.status(),await response.text()).toBe(200);
 await expect(page.locator('#save-status')).toHaveText('Saved');
 const saved=await json(endpoint);
 for(const [key,value] of Object.entries(written))expect(saved[key],`${key}: stored value`).toEqual(value);
 await page.reload();
 await expect(page.locator('[name^="profile-rating-"]').first()).toBeAttached();
 for(const [key] of profile.fields)await expect(page.locator(`#profile-form [name="${key}"]`),`${key}: reopened control`).toHaveValue(String(written[key]));
 for(const key of profile.hideableFields)await expect(page.locator(`[data-profile-field="${key}"]`)).toBeHidden();
 for(const [key,value] of Object.entries(written.profileRatings as Record<string,number>))await expect(page.locator(`[name="profile-rating-${key}"]`)).toHaveValue(String(value));
 if(written.choiceSelections){
  const chips=page.locator('[data-choice-field="officialLanguages"] .choice-chip');
  await expect(chips).toHaveCount(2);
  await expect(chips.nth(1)).toContainText('River · speech');
  // Saving after reload must preserve the two selected identities as well.
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.locator('#save-status')).toHaveText('Saved');
  expect((await json(endpoint)).choiceSelections).toEqual(written.choiceSelections);
 }
 expect(errors).toEqual([]);
});
