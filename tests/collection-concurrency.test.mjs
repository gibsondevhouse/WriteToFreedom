import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';
import {d1Adapter} from '../scripts/sqlite-adapter.mjs';
import {collectionRepository} from '../server/collection-repository.js';
import {validateCollectionRules} from '../public/collections/rules.js';
import {assertDocumentSchema} from './helpers/document-schema.mjs';

const metadata = name => ({name, summary: '', coverUrl: '', order: []});

test('smart collection rule normalization preserves the document reference contract', () => {
  for (const field of ['linkedNovel', 'series']) {
    assert.throws(() => validateCollectionRules({version: 1, mode: 'all', predicates: [{field, value: 'not-a-document-id'}]}), /existing novel or series/);
    const rules = validateCollectionRules({version: 1, mode: 'all', predicates: [{field, value: crypto.randomUUID()}]});
    assertDocumentSchema('collection_smart', {name: 'Smart rules', summary: '', coverUrl: '', rules});
  }
});
function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const file of readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync('drizzle/' + file, 'utf8'));
  const binding = d1Adapter(sqlite);
  return {sqlite, binding, db: collectionRepository(binding)};
}
function character(sqlite, id, owner = 'author') {
  const now = new Date().toISOString();
  sqlite.prepare('INSERT INTO character_drafts (id, owner_id, document, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, owner, '{"name":"Keep source"}', now, now);
}

test('simultaneous member changes with one parent revision commit only the winning member', async t => {
  const {sqlite, db} = setup(t), id = crypto.randomUUID();
  character(sqlite, 'first'); character(sqlite, 'second');
  await db.create('author', id, 'manual', metadata('Collection'));
  const results = await Promise.all([
    db.changeMember('author', id, 1, {kind: 'character', id: 'first'}),
    db.changeMember('author', id, 1, {kind: 'character', id: 'second'}),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(results.filter(result => result === null).length, 1);
  assert.equal((await db.get('author', id)).version, 2);
  assert.equal((await db.members('author', id)).length, 1);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM character_drafts').get().count, 2);
});

test('a target rejected inside the membership batch rolls back parent revision, token and edit time', async t => {
  const {sqlite, db} = setup(t), id = crypto.randomUUID();
  character(sqlite, 'mine'); character(sqlite, 'foreign', 'another-author');
  await db.create('author', id, 'manual', metadata('Collection'));
  const before = sqlite.prepare('SELECT * FROM collections WHERE id = ?').get(id);
  await assert.rejects(() => db.changeMember('author', id, 1, {kind: 'character', id: 'foreign'}), /invalid owner-scoped target/);
  assert.deepEqual(sqlite.prepare('SELECT * FROM collections WHERE id = ?').get(id), before);
  assert.deepEqual(await db.members('author', id), []);
  const retry = await db.changeMember('author', id, 1, {kind: 'character', id: 'mine'});
  assert.equal(retry.version, 2);
  assert.equal((await db.members('author', id))[0].id, 'mine');
});

test('collection creation and membership acknowledgements describe their own committed revisions', async t => {
  const {sqlite, binding} = setup(t), id = crypto.randomUUID();
  let createdInterleaving = false;
  const createBinding = {...binding, prepare(sql) {
    const prepared = binding.prepare(sql);
    return {bind(...args) {
      const statement = prepared.bind(...args);
      return {...statement, async first() {
        const result = await statement.first();
        if (!createdInterleaving && sql.startsWith('INSERT INTO collections')) {
          createdInterleaving = true;
          sqlite.prepare('UPDATE collections SET document = ?, version = version + 1 WHERE id = ?').run(JSON.stringify(metadata('Later create writer')), id);
        }
        return result;
      }};
    }};
  }};
  const created = await collectionRepository(createBinding).create('author', id, 'manual', metadata('My create'));
  assert.equal(created.name, 'My create'); assert.equal(created.version, 1);
  const current = await collectionRepository(binding).get('author', id);
  assert.equal(current.name, 'Later create writer'); assert.equal(current.version, 2);
  character(sqlite, 'member');
  let memberInterleaving = false;
  const memberBinding = {...binding, async batch(statements) {
    const result = await binding.batch(statements);
    if (!memberInterleaving) {
      memberInterleaving = true;
      sqlite.prepare('UPDATE collections SET document = ?, version = version + 1 WHERE id = ?').run(JSON.stringify(metadata('Later member writer')), id);
    }
    return result;
  }};
  const acknowledgement = await collectionRepository(memberBinding).changeMember('author', id, 2, {kind: 'character', id: 'member'});
  assert.equal(acknowledgement.name, 'Later create writer'); assert.equal(acknowledgement.version, 3);
  assert.equal((await collectionRepository(binding).get('author', id)).version, 4);
  assert.equal((await collectionRepository(binding).members('author', id)).length, 1);
});

test('removal racing a membership update cannot leave members behind or delete source entries', async t => {
  const {sqlite, db} = setup(t), id = crypto.randomUUID();
  character(sqlite, 'source');
  await db.create('author', id, 'manual', metadata('Collection'));
  const [member, removed] = await Promise.all([
    db.changeMember('author', id, 1, {kind: 'character', id: 'source'}),
    db.remove('author', id, 1),
  ]);
  assert.equal(member, null); assert.equal(removed, true);
  assert.equal(await db.get('author', id), null);
  assert.deepEqual(await db.members('author', id), []);
  assert.ok(sqlite.prepare('SELECT id FROM character_drafts WHERE id = ?').get('source'));
});

test('repository removal fails closed for future collection formats and exhausted revisions', async t => {
  const {sqlite, db} = setup(t), now = new Date().toISOString();
  for (const [id, schemaVersion, version] of [['future', 2, 1], ['exhausted', 1, Number.MAX_SAFE_INTEGER]]) {
    sqlite.prepare('INSERT INTO collections (id, owner_id, kind, document, schema_version, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, 'author', 'manual', JSON.stringify(metadata('Preserved')), schemaVersion, version, now, now);
    assert.equal(await db.remove('author', id, version), false);
    assert.ok(sqlite.prepare('SELECT id FROM collections WHERE id = ?').get(id));
  }
});
