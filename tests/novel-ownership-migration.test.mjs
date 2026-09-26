import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';
import {characters} from '../public/characters/data.js';
import {seedFactions} from '../public/characters/factions.js';
import {seedLocations} from '../public/locations/data.js';
import {blankCharacter} from '../public/characters/template.js';
import {blankLore, loreHref} from '../public/lore/template.js';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {repository} from '../server/db.js';
import {characterCast} from '../server/sample-characters.js';
import {factionCatalog} from '../server/factions.js';
import {locationCatalog} from '../server/countries.js';
import {noteTargets, connectedNotes} from '../server/note-connections.js';

const files = readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort();
const migration = readFileSync('drizzle/0017_novel_ownership_backfill.sql', 'utf8');
const now = '2026-09-24T12:00:00.000Z';
const row = (id, owner = 'author', document = '{}') => ({id, owner_id: owner, document, created_at: now, updated_at: now});
function insert(sqlite, table, values) {
  return sqlite.prepare(`INSERT INTO ${table} (${Object.keys(values).join(',')}) VALUES (${Object.keys(values).map(() => '?').join(',')})`).run(...Object.values(values));
}
function apply(sqlite, source) {
  sqlite.exec('BEGIN IMMEDIATE');
  try {sqlite.exec(source); sqlite.exec('COMMIT');}
  catch (error) {sqlite.exec('ROLLBACK'); throw error;}
}
function setup(t, through = '9999') {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const file of files.filter(name => name < through)) apply(sqlite, readFileSync('drizzle/' + file, 'utf8'));
  return sqlite;
}
function applyIntermediate(sqlite) {
  for (const file of files.filter(name => name >= '0015' && name < '0017')) apply(sqlite, readFileSync('drizzle/' + file, 'utf8'));
}

test('raw SQL migrations initialize fresh ownership and leave no orphan after a legacy-style insert', t => {
  const sqlite = setup(t);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM novels').get().count, 0);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM owner_default_novels').get().count, 0);
  insert(sqlite, 'chapters', row('fresh-chapter'));
  const chapter = sqlite.prepare('SELECT * FROM chapters').get();
  assert.ok(chapter.novel_id);
  const novel = sqlite.prepare('SELECT * FROM novels WHERE id = ? AND owner_id = ?').get(chapter.novel_id, 'author');
  assert.equal(JSON.parse(novel.document).title, 'Imported manuscript');
  assert.equal(chapter.version, 1);
  assert.equal(chapter.created_at, now);
  assert.equal(sqlite.prepare('SELECT novel_id FROM owner_default_novels WHERE owner_id = ?').get('author').novel_id, chapter.novel_id);
});

test('SQL-only upgrade preserves populated manuscripts and reuses titled or renamed durable defaults', t => {
  const sqlite = setup(t, '0015');
  insert(sqlite, 'novels', {...row('imported-a', 'owner-a', '{"title":"Imported manuscript","status":"drafting"}'), version: 5});
  insert(sqlite, 'novels', row('renamed-c', 'owner-c', '{"title":"Renamed imported novel"}'));
  insert(sqlite, 'novels', row('explicit-d', 'owner-d', '{"title":"Explicit project"}'));
  for (const owner of ['owner-a', 'owner-b', 'owner-c']) {
    for (const number of [2, 1]) insert(sqlite, 'chapters', {...row(owner + '-' + number, owner, ' { "title": "Chapter ' + number + '", "summary": "Keep exact bytes" } '), version: 7, created_at: '2026-09-2' + number + 'T12:00:00.000Z'});
    const chapterId = owner + '-1';
    const document = ' { "chapterId": "' + chapterId + '", "title": "Scene", "summary": "", "status": "draft", "contentSchemaVersion": 1, "content": { "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Original prose — preserved." }] }] } } ';
    insert(sqlite, 'scenes', {...row(owner + '-scene', owner, document), chapter_id: chapterId, version: 3});
  }
  insert(sqlite, 'chapters', {...row('assigned-d', 'owner-d'), novel_id: 'explicit-d'});
  insert(sqlite, 'lore_entries', row('lore-book', 'owner-a', ' { "type": "book", "name": "In-world book", "contents": "Original lore" } '));
  applyIntermediate(sqlite);
  insert(sqlite, 'owner_default_novels', {owner_id: 'owner-c', novel_id: 'renamed-c'});
  insert(sqlite, 'novel_associations', {id: 'lore-link', owner_id: 'owner-a', novel_id: 'imported-a', target_kind: 'lore', target_id: 'lore-book', prose: 'Original planning link', version: 4, created_at: now, updated_at: now});
  const chaptersBefore = sqlite.prepare('SELECT * FROM chapters ORDER BY created_at, id').all();
  const scenesBefore = sqlite.prepare('SELECT * FROM scenes ORDER BY id').all();
  const loreBefore = sqlite.prepare('SELECT * FROM lore_entries').all();
  const associationBefore = sqlite.prepare('SELECT * FROM novel_associations').all();
  const importedBefore = sqlite.prepare('SELECT * FROM novels WHERE id = ?').get('imported-a');
  apply(sqlite, migration);
  const chaptersAfter = sqlite.prepare('SELECT * FROM chapters ORDER BY created_at, id').all();
  assert.deepEqual(chaptersAfter.map(({novel_id, ...chapter}) => chapter), chaptersBefore.map(({novel_id, ...chapter}) => chapter));
  assert.deepEqual(sqlite.prepare('SELECT * FROM scenes ORDER BY id').all(), scenesBefore);
  assert.deepEqual(sqlite.prepare('SELECT * FROM lore_entries').all(), loreBefore);
  assert.deepEqual(sqlite.prepare('SELECT * FROM novel_associations').all(), associationBefore);
  assert.deepEqual(sqlite.prepare('SELECT * FROM novels WHERE id = ?').get('imported-a'), importedBefore);
  assert.ok(chaptersAfter.filter(chapter => chapter.owner_id === 'owner-a').every(chapter => chapter.novel_id === 'imported-a'));
  assert.ok(chaptersAfter.filter(chapter => chapter.owner_id === 'owner-c').every(chapter => chapter.novel_id === 'renamed-c'));
  assert.equal(chaptersAfter.find(chapter => chapter.id === 'assigned-d').novel_id, 'explicit-d');
  const importedB = sqlite.prepare('SELECT * FROM novels WHERE owner_id = ?').get('owner-b');
  assert.match(importedB.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.ok(chaptersAfter.filter(chapter => chapter.owner_id === 'owner-b').every(chapter => chapter.novel_id === importedB.id));
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM owner_default_novels').get().count, 3);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM novels').get().count, 4);
  apply(sqlite, migration); // Data and guard installation remain repeatable.
  assert.deepEqual(sqlite.prepare('SELECT * FROM chapters ORDER BY created_at, id').all(), chaptersAfter);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM novels').get().count, 4);
});

test('the complete milestone upgrade preserves mixed authored samples, nested links and legacy manuscripts', async t => {
  const sqlite = setup(t, '0013'), db = repository(d1Adapter(sqlite));
  const owner = 'mixed-author', customId = crypto.randomUUID(), loreId = crypto.randomUUID(), factionId = crypto.randomUUID(), countryId = crypto.randomUUID(), cityId = crypto.randomUUID(), noteId = crypto.randomUUID();
  const sampleNote = {id: noteId, field: 'biography', position: 0, title: 'Authored source note', type: 'lore', tags: ['treaty'], text: 'Read the chronicle and the witness.',
    links: [{kind: 'lore', id: loreId}, {kind: 'note', id: noteId, characterId: customId}],
    content: [{text: 'Read the chronicle', ref: {kind: 'lore', id: loreId}}, {text: ' and '}, {text: 'the witness.', ref: {kind: 'note', id: noteId, characterId: customId}}]};
  await db.save(owner, 'claude', 0, {...blankCharacter(), firstName: 'Authored Claude', name: 'Authored Claude', biography: '[1]Private biography — preserved.', birthDate: '14 Harvest, 112', factionId, residenceId: cityId,
    hiddenFields: ['biography'], relationships: [{targetId: customId, type: 'Witness', description: 'Original relationship'}], notes: [sampleNote]});
  await db.save('other-author', 'claude', 0, {...blankCharacter(), firstName: 'Other private Claude', name: 'Other private Claude', biography: 'Other owner prose', notes: []});
  const custom = {...blankCharacter(), firstName: 'Authored witness', name: 'Authored witness', biography: '[1]Witness account', notes: [{id: noteId, field: 'biography', position: 0, title: 'Witness note', type: 'detail', text: 'Preserved independent note', links: [{kind: 'character', id: 'claude'}, {kind: 'faction', id: factionId}, {kind: 'location', id: cityId}]}]};
  insert(sqlite, 'character_drafts', {...row(customId, owner, ' ' + JSON.stringify(custom) + '\n'), version: 6});
  insert(sqlite, 'factions', {id: factionId, owner_id: owner, name: 'Custom guild', name_key: 'custom guild', created_at: now});
  insert(sqlite, 'faction_profiles', {owner_id: owner, faction_id: 'sample-ember', document: '{"name":"Private Ember","leaderId":"claude","founded":"1200 BCE"}', version: 4, updated_at: now});
  insert(sqlite, 'locations', {id: countryId, owner_id: owner, name: 'Custom country', type: 'country', parent_id: null, created_at: now});
  insert(sqlite, 'locations', {id: cityId, owner_id: owner, name: 'Custom city', type: 'city', parent_id: countryId, created_at: now});
  insert(sqlite, 'city_profiles', {owner_id: owner, location_id: cityId, document: JSON.stringify({name: 'Custom city', parentId: countryId, founded: '1984-02'}), version: 3, updated_at: now});
  const lore = {...blankLore('book'), name: 'In-world chronicle', contents: 'Original text\nwith two  spaces.', originDate: '1200 BCE', connections: [{target: {kind: 'character', id: 'claude'}, relationship: 'Compiled by'}, {target: {kind: 'note', id: noteId, characterId: customId}, relationship: 'Source testimony'}]};
  insert(sqlite, 'lore_entries', {...row(loreId, owner, '\n ' + JSON.stringify(lore) + ' '), version: 8});
  const first = crypto.randomUUID(), second = crypto.randomUUID(), sceneId = crypto.randomUUID();
  insert(sqlite, 'chapters', {...row(second, owner, '{"title":"Later chapter","summary":"Original later summary"}'), version: 4, created_at: '2026-09-23T00:00:00.000Z'});
  insert(sqlite, 'chapters', {...row(first, owner, ' { "title": "Earlier chapter", "summary": "Original earlier summary" } '), version: 7, created_at: '2026-09-22T00:00:00.000Z'});
  const content = {type: 'doc', content: [{type: 'paragraph', content: [{type: 'text', text: 'Original manuscript — two  spaces.', marks: [{type: 'bold'}]}]}]};
  insert(sqlite, 'scenes', {...row(sceneId, owner, ' ' + JSON.stringify({chapterId: first, title: 'Legacy scene', summary: 'Original scene summary', status: 'revising', contentSchemaVersion: 1, content}) + '\n'), chapter_id: first, version: 9});
  const sourceTables = ['character_drafts', 'factions', 'faction_profiles', 'locations', 'city_profiles', 'lore_entries', 'scenes'];
  const snapshot = () => Object.fromEntries(sourceTables.map(table => [table, sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  const sourcesBefore = snapshot(), chaptersBefore = sqlite.prepare('SELECT * FROM chapters ORDER BY created_at, id').all();
  const storedSampleId = sqlite.prepare("SELECT id FROM character_drafts WHERE owner_id = ? AND json_extract(document, '$.sampleId') = 'claude'").get(owner).id;
  assert.notEqual(storedSampleId, 'claude');
  for (const file of files.filter(name => name >= '0013' && name < '0019')) apply(sqlite, readFileSync('drizzle/' + file, 'utf8'));
  assert.deepEqual(snapshot(), sourcesBefore);
  const chaptersAfter = sqlite.prepare('SELECT * FROM chapters ORDER BY created_at, id').all();
  assert.deepEqual(chaptersAfter.map(({novel_id, ...chapter}) => chapter), chaptersBefore.map(chapter => ({...chapter})));
  const defaultNovel = sqlite.prepare('SELECT novel_id FROM owner_default_novels WHERE owner_id = ?').get(owner).novel_id;
  assert.ok(chaptersAfter.every(chapter => chapter.novel_id === defaultNovel));
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM novels').get().count, 1);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM novel_associations').get().count, 0);
  const effective = await db.get(owner, 'claude');
  assert.equal(effective.id, 'claude'); assert.equal(effective.name, 'Authored Claude'); assert.equal(effective.birthDate, '14 Harvest, 112');
  assert.deepEqual(effective.notes, [sampleNote]);
  assert.equal((await db.get('other-author', 'claude')).name, 'Other private Claude');
  const cast = characterCast(await db.list(owner)), factions = await factionCatalog(db, owner), locations = await locationCatalog(db, owner), savedLore = await db.listLore(owner);
  assert.equal(cast.filter(character => character.id === 'claude').length, 1); assert.ok(!cast.some(character => character.id === storedSampleId));
  assert.ok(!cast.some(character => character.name === 'Other private Claude'));
  assert.equal(factions.find(faction => faction.id === 'sample-ember').name, 'Private Ember');
  assert.equal(locations.find(location => location.id === cityId).parentId, countryId);
  assert.equal(savedLore[0].type, 'book'); assert.equal(loreHref(savedLore[0]), '/lore/' + loreId + '/'); assert.deepEqual(savedLore[0].connections, lore.connections);
  const notes = noteTargets(cast, factions, locations, savedLore).filter(target => target.kind === 'note' && target.id === noteId);
  assert.deepEqual(notes.map(note => note.characterId).sort(), ['claude', customId].sort());
  assert.ok(notes.some(note => note.href === '/characters/claude/#note-' + noteId));
  assert.deepEqual(connectedNotes(cast, {kind: 'note', id: noteId, characterId: customId}, savedLore).map(note => note.source).sort(), ['Authored Claude', 'In-world chronicle'].sort());
});

test('an invalid legacy association rolls back the SQL backfill and can be repaired before retry', t => {
  const sqlite = setup(t, '0015');
  insert(sqlite, 'chapters', row('legacy-chapter'));
  insert(sqlite, 'novels', row('existing-novel'));
  applyIntermediate(sqlite);
  insert(sqlite, 'novel_associations', {id: 'invalid-link', owner_id: 'author', novel_id: 'existing-novel', target_kind: 'character', target_id: 'missing-character', created_at: now, updated_at: now});
  assert.throws(() => apply(sqlite, migration), /invalid owner-scoped target/);
  assert.equal(sqlite.prepare('SELECT novel_id FROM chapters').get().novel_id, null);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM owner_default_novels').get().count, 0);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM novels').get().count, 1);
  insert(sqlite, 'character_drafts', row('missing-character'));
  apply(sqlite, migration);
  assert.ok(sqlite.prepare('SELECT novel_id FROM chapters').get().novel_id);
  assert.equal(sqlite.prepare('SELECT version FROM novel_associations').get().version, 1);
});

test('direct novel associations enforce exact typed owner targets and prevent source deletion until unlinking', t => {
  const sqlite = setup(t);
  sqlite.exec('PRAGMA foreign_keys = OFF');
  insert(sqlite, 'novels', row('novel'));
  insert(sqlite, 'novels', row('foreign-novel', 'another-author'));
  insert(sqlite, 'series', row('wrong-type'));
  const tables = {character: 'character_drafts', faction: 'factions', location: 'locations', lore: 'lore_entries', story_arc: 'story_arcs'};
  for (const [kind, table] of Object.entries(tables)) {
    for (const owner of ['author', 'another-author']) {
      const id = owner + '-' + kind;
      if (kind === 'faction') insert(sqlite, table, {id, owner_id: owner, name: id, name_key: id, created_at: now});
      else if (kind === 'location') insert(sqlite, table, {id, owner_id: owner, name: id, type: 'planet', parent_id: null, created_at: now});
      else insert(sqlite, table, row(id, owner));
    }
    const association = {id: 'link-' + kind, owner_id: 'author', novel_id: 'novel', target_kind: kind, target_id: 'author-' + kind, created_at: now, updated_at: now};
    for (const target_id of ['missing', 'sample-unknown', 'another-author-' + kind]) assert.throws(() => insert(sqlite, 'novel_associations', {...association, target_id}), /invalid owner-scoped target/);
    assert.throws(() => insert(sqlite, 'novel_associations', {...association, target_id: 'wrong-type'}), /invalid owner-scoped target/);
    insert(sqlite, 'novel_associations', association);
    assert.throws(() => sqlite.prepare(`DELETE FROM ${table} WHERE owner_id = ? AND id = ?`).run('author', association.target_id), /novel associations still reference/);
    sqlite.prepare('DELETE FROM novel_associations WHERE owner_id = ? AND id = ?').run('author', association.id);
    sqlite.prepare(`DELETE FROM ${table} WHERE owner_id = ? AND id = ?`).run('author', association.target_id);
  }
  assert.throws(() => insert(sqlite, 'novel_associations', {id: 'unsupported', owner_id: 'author', novel_id: 'novel', target_kind: 'novel', target_id: 'novel', created_at: now, updated_at: now}), /invalid target kind/);
  const privateSampleId = crypto.randomUUID();
  insert(sqlite, 'character_drafts', row(privateSampleId, 'author', '{"sampleId":"claude","name":"Private Claude override"}'));
  assert.throws(() => insert(sqlite, 'novel_associations', {id: 'duplicate-sample', owner_id: 'author', novel_id: 'novel', target_kind: 'character', target_id: privateSampleId, created_at: now, updated_at: now}), /invalid owner-scoped target/);
  for (const [kind, samples] of [['character', characters], ['faction', seedFactions], ['location', seedLocations]]) {
    for (const sample of samples) {
      for (const [owner_id, novel_id] of [['author', 'novel'], ['another-author', 'foreign-novel']]) insert(sqlite, 'novel_associations', {id: crypto.randomUUID(), owner_id, novel_id, target_kind: kind, target_id: sample.id, created_at: now, updated_at: now});
    }
  }
});
