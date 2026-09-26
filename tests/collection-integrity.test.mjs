import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';

const files = readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort();
const now = '2026-09-24T12:00:00.000Z';
function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const name of files) sqlite.exec(readFileSync('drizzle/' + name, 'utf8'));
  sqlite.exec('PRAGMA foreign_keys = OFF'); // Triggers also protect non-FK callers.
  return sqlite;
}
function insert(sqlite, table, values) {
  return sqlite.prepare(`INSERT INTO ${table} (${Object.keys(values).join(',')}) VALUES (${Object.keys(values).map(() => '?').join(',')})`).run(...Object.values(values));
}
const row = (id, owner = 'author', document = '{}') => ({id, owner_id: owner, document, created_at: now, updated_at: now});
const collection = (id, owner = 'author', kind = 'manual') => ({...row(id, owner), kind});
const membership = (collectionId, kind, id, owner = 'author', parent = '') => ({owner_id: owner, collection_id: collectionId, target_kind: kind, target_id: id, target_parent_id: parent, created_at: now});

test('collection envelopes and internal mutation tokens share safe revision protection', t => {
  const sqlite = setup(t), valid = collection('collection');
  for (const field of ['id', 'owner_id']) assert.throws(() => insert(sqlite, 'collections', {...valid, [field]: ' '}), /identity is required/);
  for (const document of ['invalid JSON', '[]', 'null', '42']) assert.throws(() => insert(sqlite, 'collections', {...valid, document}), /invalid JSON|must be an object/);
  for (const version of [0, -1, 1.5, 9007199254740992]) assert.throws(() => insert(sqlite, 'collections', {...valid, version}), /invalid revision/);
  for (const schema_version of [0, -1, 1.5, 9007199254740992]) assert.throws(() => insert(sqlite, 'collections', {...valid, schema_version}), /invalid schema version/);
  assert.throws(() => insert(sqlite, 'collections', {...valid, kind: 'automatic'}), /CHECK constraint failed/);
  insert(sqlite, 'collections', valid);
  for (const field of ['id', 'owner_id', 'kind']) assert.throws(() => sqlite.prepare(`UPDATE collections SET ${field} = ?`).run('changed'), /immutable identity and kind/);
  for (const changes of ["document = '{\"name\":\"Changed\"}'", 'version = version + 2', "mutation_token = 'unguarded-token'", 'schema_version = 2']) {
    assert.throws(() => sqlite.exec('UPDATE collections SET ' + changes), /revision must advance exactly once/);
  }
  sqlite.exec(`UPDATE collections SET document = '{"name":"Saved"}', mutation_token = 'checked-token', version = version + 1`);
  assert.equal(sqlite.prepare('SELECT version FROM collections').get().version, 2);
});

test('manual collection members resolve typed owner-scoped sources and preserve note parent identity', t => {
  const sqlite = setup(t);
  insert(sqlite, 'collections', collection('manual'));
  insert(sqlite, 'collections', collection('smart', 'author', 'smart'));
  insert(sqlite, 'collections', collection('foreign-collection', 'another-author'));
  const targets = {};
  for (const owner of ['author', 'another-author']) {
    const prefix = owner === 'author' ? 'mine-' : 'foreign-';
    const add = (kind, table, values) => {insert(sqlite, table, values); (targets[owner] ||= {})[kind] = values.id;};
    add('character', 'character_drafts', row(prefix + 'character', owner, JSON.stringify({notes: [{id: 'shared-note-id', text: 'Keep my note'}]})));
    add('faction', 'factions', {id: prefix + 'faction', owner_id: owner, name: 'Faction', name_key: prefix + 'faction', created_at: now});
    add('location', 'locations', {id: prefix + 'location', owner_id: owner, name: 'Planet', type: 'planet', parent_id: null, created_at: now});
    for (const [kind, table] of [['lore', 'lore_entries'], ['story_arc', 'story_arcs'], ['novel', 'novels'], ['series', 'series']]) add(kind, table, row(prefix + kind, owner));
    add('chapter', 'chapters', {...row(prefix + 'chapter', owner), novel_id: targets[owner].novel});
    add('scene', 'scenes', {...row(prefix + 'scene', owner, JSON.stringify({chapterId: targets[owner].chapter})), chapter_id: targets[owner].chapter});
  }
  for (const [kind, id] of Object.entries(targets.author)) {
    const valid = membership('manual', kind, id);
    insert(sqlite, 'collection_members', valid);
    assert.throws(() => insert(sqlite, 'collection_members', {...valid, target_id: targets['another-author'][kind]}), /invalid owner-scoped target/);
    assert.throws(() => insert(sqlite, 'collection_members', {...valid, target_id: 'missing'}), /invalid owner-scoped target/);
    assert.throws(() => insert(sqlite, 'collection_members', {...valid, target_parent_id: 'unexpected-parent'}), /invalid target identity/);
  }
  insert(sqlite, 'collection_members', membership('manual', 'note', 'shared-note-id', 'author', targets.author.character));
  assert.throws(() => insert(sqlite, 'collection_members', membership('manual', 'note', 'shared-note-id', 'author', targets['another-author'].character)), /invalid owner-scoped target/);
  assert.throws(() => insert(sqlite, 'collection_members', membership('manual', 'note', 'shared-note-id')), /invalid target identity/);
  for (const [kind, id] of [['character', 'claude'], ['faction', 'sample-ember'], ['location', 'sample-capital']]) insert(sqlite, 'collection_members', membership('manual', kind, id));
  insert(sqlite, 'character_drafts', row('private-claude', 'author', JSON.stringify({sampleId: 'claude', notes: [{id: 'private-note', text: 'Private sample note'}]})));
  assert.throws(() => insert(sqlite, 'collection_members', membership('manual', 'character', 'private-claude')), /canonical character identity|invalid owner-scoped target/);
  assert.throws(() => insert(sqlite, 'collection_members', membership('manual', 'note', 'private-note', 'author', 'private-claude')), /invalid owner-scoped target/);
  insert(sqlite, 'collection_members', membership('manual', 'note', 'private-note', 'author', 'claude'));
  const valid = membership('manual', 'character', targets.author.character);
  assert.throws(() => insert(sqlite, 'collection_members', {...valid, collection_id: 'foreign-collection'}), /invalid manual collection/);
  assert.throws(() => insert(sqlite, 'collection_members', {...valid, collection_id: 'smart'}), /invalid manual collection/);
  assert.throws(() => insert(sqlite, 'collection_members', {...valid, target_kind: 'unsupported'}), /CHECK constraint failed/);
  assert.throws(() => insert(sqlite, 'collection_members', valid), /UNIQUE constraint failed/);
  assert.throws(() => sqlite.exec("UPDATE collection_members SET target_id = 'replacement'"), /replace membership explicitly/);
});

test('removing membership and its collection preserves source documents and novel links', t => {
  const sqlite = setup(t);
  const document = ' { "name": "Original source", "notes": [] } ';
  insert(sqlite, 'character_drafts', row('source', 'author', document));
  insert(sqlite, 'novels', row('novel'));
  insert(sqlite, 'novel_associations', {id: 'appearance', owner_id: 'author', novel_id: 'novel', target_kind: 'character', target_id: 'source', prose: 'Original appearance', created_at: now, updated_at: now});
  insert(sqlite, 'collections', collection('collection'));
  insert(sqlite, 'collection_members', membership('collection', 'character', 'source'));
  assert.throws(() => sqlite.prepare('DELETE FROM collections WHERE id = ?').run('collection'), /remove memberships first/);
  const source = sqlite.prepare('SELECT * FROM character_drafts WHERE id = ?').get('source');
  const association = sqlite.prepare('SELECT * FROM novel_associations WHERE id = ?').get('appearance');
  sqlite.prepare('DELETE FROM collection_members WHERE owner_id = ? AND collection_id = ?').run('author', 'collection');
  sqlite.prepare('DELETE FROM collections WHERE owner_id = ? AND id = ?').run('author', 'collection');
  assert.deepEqual(sqlite.prepare('SELECT * FROM character_drafts WHERE id = ?').get('source'), source);
  assert.deepEqual(sqlite.prepare('SELECT * FROM novel_associations WHERE id = ?').get('appearance'), association);
});

test('manual collection sources and embedded notes require explicit unlinking before removal', t => {
  const sqlite = setup(t), noteId = 'kept-note';
  insert(sqlite, 'collections', collection('collection'));
  insert(sqlite, 'character_drafts', row('character', 'author', JSON.stringify({name: 'Initial', notes: [{id: noteId, text: 'Kept note'}]})));
  insert(sqlite, 'factions', {id: 'faction', owner_id: 'author', name: 'Faction', name_key: 'faction', created_at: now});
  insert(sqlite, 'locations', {id: 'location', owner_id: 'author', name: 'Planet', type: 'planet', parent_id: null, created_at: now});
  for (const [kind, table] of [['lore', 'lore_entries'], ['story_arc', 'story_arcs'], ['novel', 'novels'], ['series', 'series']]) insert(sqlite, table, row(kind));
  insert(sqlite, 'chapters', {...row('chapter'), novel_id: 'novel'});
  insert(sqlite, 'scenes', {...row('scene', 'author', '{"chapterId":"chapter"}'), chapter_id: 'chapter'});
  const sources = [['scene', 'scenes'], ['chapter', 'chapters'], ['character', 'character_drafts'], ['faction', 'factions'], ['location', 'locations'], ['lore', 'lore_entries'], ['story_arc', 'story_arcs'], ['novel', 'novels'], ['series', 'series']];
  for (const [kind] of sources) insert(sqlite, 'collection_members', membership('collection', kind, kind));
  insert(sqlite, 'collection_members', membership('collection', 'note', noteId, 'author', 'character'));
  assert.throws(() => sqlite.prepare('UPDATE character_drafts SET document = ?, version = version + 1 WHERE id = ?').run(JSON.stringify({sampleId: 'claude', notes: [{id: noteId, text: 'Kept note'}]}), 'character'), /linked canonical identity is immutable/);
  sqlite.prepare('UPDATE character_drafts SET document = ?, version = version + 1 WHERE id = ?').run(JSON.stringify({name: 'Renamed', notes: [{id: noteId, text: 'Edited note'}]}), 'character');
  assert.throws(() => sqlite.prepare('UPDATE character_drafts SET document = ?, version = version + 1 WHERE id = ?').run('{"name":"Renamed","notes":[]}', 'character'), /collection memberships still reference these notes/);
  sqlite.prepare('DELETE FROM collection_members WHERE owner_id = ? AND collection_id = ? AND target_kind = ? AND target_id = ?').run('author', 'collection', 'note', noteId);
  sqlite.prepare('UPDATE character_drafts SET document = ?, version = version + 1 WHERE id = ?').run('{"name":"Renamed","notes":[]}', 'character');
  for (const [kind, table] of sources) {
    assert.throws(() => sqlite.prepare(`DELETE FROM ${table} WHERE owner_id = ? AND id = ?`).run('author', kind), /collection memberships still reference/);
    sqlite.prepare('DELETE FROM collection_members WHERE owner_id = ? AND collection_id = ? AND target_kind = ? AND target_id = ?').run('author', 'collection', kind, kind);
    sqlite.prepare(`DELETE FROM ${table} WHERE owner_id = ? AND id = ?`).run('author', kind);
  }
  insert(sqlite, 'character_drafts', row('private-sample', 'author', '{"sampleId":"claude","notes":[{"id":"sample-note","text":"Private sample note"}]}'));
  insert(sqlite, 'collection_members', membership('collection', 'note', 'sample-note', 'author', 'claude'));
  assert.throws(() => sqlite.prepare('DELETE FROM character_drafts WHERE id = ?').run('private-sample'), /collection memberships still reference/);
  assert.throws(() => sqlite.prepare('UPDATE character_drafts SET document = ?, version = version + 1 WHERE id = ?').run('{"sampleId":"claude","notes":[]}', 'private-sample'), /collection memberships still reference these notes/);
  sqlite.prepare('DELETE FROM collection_members WHERE target_kind = ?').run('note');
  insert(sqlite, 'collection_members', membership('collection', 'character', 'claude'));
  sqlite.prepare('DELETE FROM character_drafts WHERE id = ?').run('private-sample');
  assert.equal(sqlite.prepare('SELECT target_id FROM collection_members WHERE target_kind = ?').get('character').target_id, 'claude');
});
