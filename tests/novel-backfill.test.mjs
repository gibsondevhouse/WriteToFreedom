import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';
import {backfillChapterNovels} from '../scripts/migrate-novel-backfill.mjs';
import {migrateDatabase} from '../scripts/migrate.mjs';

const files = readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort();
const now = '2026-09-24T12:00:00.000Z';
const quiet = {log() {}, error() {}};

function setup(t, through = '0015') {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const name of files.filter(name => name < through)) sqlite.exec(readFileSync('drizzle/' + name, 'utf8'));
  return sqlite;
}

function chapter(sqlite, owner, id, document = {title: id, summary: 'Original prose'}) {
  sqlite.prepare('INSERT INTO chapters (id, owner_id, document, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, owner, JSON.stringify(document), now, now);
}

function defaultFor(sqlite, owner) {
  return sqlite.prepare(`SELECT n.* FROM novels AS n JOIN owner_default_novels AS d
    ON d.novel_id = n.id AND d.owner_id = n.owner_id WHERE d.owner_id = ?`).get(owner);
}

test('legacy chapter backfill is idempotent across owners and preserves manuscript bytes', t => {
  const sqlite = setup(t); // Apply through 0014, before the automatic insert bridge.
  const original = JSON.stringify({title: 'Chapter A', summary: 'Original prose'});
  for (const owner of ['owner-a', 'owner-b']) {
    chapter(sqlite, owner, owner + '-1', JSON.parse(original));
    chapter(sqlite, owner, owner + '-2');
    sqlite.prepare('INSERT INTO scenes (id, owner_id, chapter_id, document, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(owner + '-scene', owner, owner + '-1', JSON.stringify({chapterId: owner + '-1', title: 'Scene', summary: '', status: 'draft', contentSchemaVersion: 1, content: {type: 'doc', content: [{type: 'paragraph'}]}}), now, now);
  }
  const scenesBefore = sqlite.prepare('SELECT id, chapter_id, document FROM scenes ORDER BY id').all();
  sqlite.exec(readFileSync('drizzle/0015_novel_associations.sql', 'utf8'));
  const first = backfillChapterNovels(sqlite, {logger: quiet});
  assert.deepEqual({...first, errors: []}, {ownersProcessed: 2, ownersSucceeded: 2, ownersFailed: 0, novelsCreated: 2, chaptersUpdated: 4, errors: []});
  for (const owner of ['owner-a', 'owner-b']) {
    const novel = defaultFor(sqlite, owner);
    assert.equal(JSON.parse(novel.document).title, 'Imported manuscript');
    assert.equal(novel.version, 1);
    assert.equal(novel.schema_version, 1);
    const rows = sqlite.prepare('SELECT id, novel_id, document, version, created_at, updated_at FROM chapters WHERE owner_id = ? ORDER BY id').all(owner);
    assert.equal(rows.length, 2);
    assert.ok(rows.every(row => row.novel_id === novel.id));
    assert.ok(rows.every(row => row.version === 1 && row.created_at === now && row.updated_at === now));
    assert.equal(rows[0].document, original);
  }
  assert.deepEqual(sqlite.prepare('SELECT id, chapter_id, document FROM scenes ORDER BY id').all(), scenesBefore);
  const assignments = sqlite.prepare('SELECT id, novel_id FROM chapters ORDER BY id').all();
  const second = backfillChapterNovels(sqlite, {logger: quiet});
  assert.equal(second.novelsCreated, 0);
  assert.equal(second.chaptersUpdated, 0);
  assert.deepEqual(sqlite.prepare('SELECT id, novel_id FROM chapters ORDER BY id').all(), assignments);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM novels').get().count, 2);
});

test('new legacy-style chapter inserts use the same default after its title changes', t => {
  const sqlite = setup(t, '0016');
  chapter(sqlite, 'owner-a', 'first');
  const novel = defaultFor(sqlite, 'owner-a');
  assert.ok(novel);
  assert.equal(sqlite.prepare('SELECT novel_id FROM chapters WHERE id = ?').get('first').novel_id, novel.id);
  const document = {...JSON.parse(novel.document), title: 'Renamed manuscript'};
  sqlite.prepare('UPDATE novels SET document = ?, version = version + 1 WHERE id = ?').run(JSON.stringify(document), novel.id);
  chapter(sqlite, 'owner-a', 'second');
  assert.equal(sqlite.prepare('SELECT novel_id FROM chapters WHERE id = ?').get('second').novel_id, novel.id);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM novels WHERE owner_id = ?').get('owner-a').count, 1);
  assert.equal(backfillChapterNovels(sqlite, {logger: quiet}).novelsCreated, 0);
  assert.throws(() => sqlite.prepare('DELETE FROM owner_default_novels WHERE owner_id = ?').run('owner-a'), /immutable identity/);
  assert.throws(() => sqlite.prepare('DELETE FROM novels WHERE id = ?').run(novel.id), /references still depend/);
  assert.throws(() => sqlite.prepare('UPDATE chapters SET novel_id = NULL WHERE id = ?').run('second'), /novel is required/);
  const foreignNovelId = crypto.randomUUID();
  sqlite.prepare('INSERT INTO novels (id, owner_id, document, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(foreignNovelId, 'owner-b', '{"title":"Foreign"}', now, now);
  assert.throws(() => sqlite.prepare('INSERT INTO chapters (id, owner_id, novel_id, document, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('foreign', 'owner-a', foreignNovelId, '{}', now, now), /novel must belong to the same owner/);
  assert.throws(() => sqlite.prepare('UPDATE chapters SET novel_id = ? WHERE id = ?').run(foreignNovelId, 'second'), /novel must belong to the same owner/);
});

test('a failed owner rolls back its novel and chapters while other owners succeed', t => {
  const sqlite = setup(t);
  chapter(sqlite, 'owner-a', 'a-1');
  chapter(sqlite, 'owner-b', 'b-1');
  sqlite.exec(readFileSync('drizzle/0015_novel_associations.sql', 'utf8'));
  sqlite.exec(`CREATE TRIGGER reject_owner_b_backfill BEFORE UPDATE ON chapters
    WHEN NEW.owner_id = 'owner-b' AND OLD.novel_id IS NULL
    BEGIN SELECT RAISE(ABORT, 'simulated owner failure'); END;`);
  const errors = [];
  const result = backfillChapterNovels(sqlite, {logger: {log() {}, error(message) {errors.push(message);}}});
  assert.equal(result.ownersProcessed, 2);
  assert.equal(result.ownersSucceeded, 1);
  assert.equal(result.ownersFailed, 1);
  assert.equal(result.novelsCreated, 1);
  assert.equal(result.chaptersUpdated, 1);
  assert.match(errors[0], /owner-b.*simulated owner failure/);
  assert.equal(defaultFor(sqlite, 'owner-b'), undefined);
  assert.equal(sqlite.prepare('SELECT novel_id FROM chapters WHERE id = ?').get('b-1').novel_id, null);
  sqlite.exec('DROP TRIGGER reject_owner_b_backfill');
  const retry = backfillChapterNovels(sqlite, {logger: quiet});
  assert.equal(retry.ownersFailed, 0);
  assert.equal(retry.novelsCreated, 1);
  assert.equal(retry.chaptersUpdated, 1);
});

test('local migration runner backfills existing chapters before serving writes', async t => {
  const sqlite = setup(t);
  chapter(sqlite, 'legacy-owner', 'legacy-chapter');
  sqlite.exec('CREATE TABLE local_migrations (name TEXT PRIMARY KEY)');
  const mark = sqlite.prepare('INSERT INTO local_migrations (name) VALUES (?)');
  for (const file of files.filter(name => name < '0015')) mark.run(file);
  await migrateDatabase(sqlite);
  assert.equal(sqlite.prepare('SELECT novel_id FROM chapters WHERE id = ?').get('legacy-chapter').novel_id, defaultFor(sqlite, 'legacy-owner').id);
});
