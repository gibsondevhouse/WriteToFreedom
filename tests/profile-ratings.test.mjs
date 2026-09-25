import test from 'node:test';
import assert from 'node:assert/strict';
import {locationTypes} from '../public/locations/data.js';
import {loreTypes} from '../public/lore/template.js';
import {loreTemplates} from '../public/lore/template.js';
import {locationTemplates} from '../public/locations/template.js';
import {countrySections} from '../public/locations/countries/template.js';
import {citySections} from '../public/locations/cities/template.js';
import {factionSections} from '../public/factions/template.js';
import {factionRatingGroups,locationRatingGroups,loreRatingGroups,ratingGroupsFor,ratingKeys,validateProfileRatings} from '../public/profiles/ratings.js';

test('every place and Lore type has a tailored, collision-free ratings template',()=>{
 for(const type of locationTypes){
  const groups=ratingGroupsFor('location',type),keys=ratingKeys(groups);
  assert.ok(groups.length>=3,type);assert.equal(new Set(keys).size,keys.length,type);assert.ok(keys.length>=12,type);
  const sections=new Set((type==='country'?countrySections:type==='city'?citySections:locationTemplates[type].sections).map(section=>section.id));for(const group of groups)assert.ok(sections.has(group.sectionId),`${type}: ${group.id} -> ${group.sectionId}`);
 }
 for(const type of Object.keys(loreTypes)){
  const groups=ratingGroupsFor('lore',type),keys=ratingKeys(groups);
  assert.ok(groups.length>=1,type);assert.equal(new Set(keys).size,keys.length,type);assert.ok(keys.length>=4,type);
  const sections=new Set(loreTemplates[type].sections.map(section=>section.id));for(const group of groups)assert.ok(sections.has(group.sectionId),`${type}: ${group.id} -> ${group.sectionId}`);
 }
 assert.deepEqual(ratingGroupsFor('faction'),factionRatingGroups);
 const factionSectionIds=new Set(factionSections.map(section=>section.id));for(const group of factionRatingGroups)assert.ok(factionSectionIds.has(group.sectionId));
 assert.equal(locationRatingGroups.city[0].fields[0][0],'costOfLiving');
 assert.ok(ratingKeys(loreRatingGroups.artifact).includes('physicalImpact'));
 assert.ok(ratingKeys(loreRatingGroups.jewel).includes('materialValue'));
});

test('shared ratings validation preserves zero and rejects unknown, fractional, and out-of-range values',()=>{
 const groups=ratingGroupsFor('location','city');
 assert.deepEqual(validateProfileRatings({costOfLiving:0,qualityOfLife:99},groups),{costOfLiving:0,qualityOfLife:99});
 for(const value of [{costOfLiving:-1},{costOfLiving:100},{costOfLiving:1.5},{costOfLiving:'20'},{unknown:40},[],null])assert.throws(()=>validateProfileRatings(value,groups));
});
