import test from 'node:test';
import assert from 'node:assert/strict';
import {searchCatalog} from '../public/dashboard/search.js';

const catalog = {
  characters: [{name: 'Amina', label: 'Character', summary: 'Keeper of the western gate', roles: ['Archivist'], href: '/characters/amina/'}],
  factions: [{name: 'Lantern House', label: 'Faction', title: 'Guardians of the gate', href: '/factions/lantern/'}],
  locations: [{name: 'Westhaven', label: 'City', parent: 'Northern Kingdom', href: '/locations/cities/westhaven/'}],
};

test('catalog search spans domains and metadata with case-insensitive terms', () => {
  assert.deepEqual(searchCatalog(catalog, ' GATE ').map(r => r.name), ['Amina', 'Lantern House']);
  assert.deepEqual(searchCatalog(catalog, 'amina ARCHIVIST').map(r => r.name), ['Amina']);
  assert.deepEqual(searchCatalog(catalog, 'kingdom city').map(r => r.name), ['Westhaven']);
  assert.equal(searchCatalog(catalog, 'amina kingdom').length, 0);
});

test('empty and unmatched searches return no results and preserve the catalog', () => {
  const original = structuredClone(catalog);
  assert.deepEqual(searchCatalog(catalog, '  '), []);
  assert.deepEqual(searchCatalog(catalog, '<script>'), []);
  assert.deepEqual(catalog, original);
  assert.equal(searchCatalog(catalog, 'westhaven')[0].href, '/locations/cities/westhaven/');
});

test('global search includes novel, series and collection profiles alongside the encyclopedia',()=>{
 const expanded={...catalog,novels:[{name:'Winter passage',summary:'The northern archive',label:'Novel',href:'/novels/one/'}],series:[{name:'Winter sequence',label:'Series',href:'/series/one/'}],collections:[{name:'Winter research',label:'Manual collection',href:'/collections/one/'}]};
 assert.deepEqual(searchCatalog(expanded,'winter').map(record=>record.label),['Novel','Series','Manual collection']);
 assert.deepEqual(searchCatalog(expanded,'archive novel').map(record=>record.href),['/novels/one/']);
});
