import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';
import {characters} from '../public/characters/data.js';
import {seedFactions} from '../public/characters/factions.js';
import {seedLocations} from '../public/locations/data.js';

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
