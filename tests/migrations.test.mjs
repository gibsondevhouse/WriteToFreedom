import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp, readdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrateDatabase} from '../scripts/migrate.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'wtf-migrations-'));
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  t.after(() => rm(directory, {recursive: true, force: true}));
  return {sqlite, directory, write: (name, sql) => writeFile(join(directory, name), sql)};
}

test('the checked-in migrations initialize once and preserve existing records on restart', async t => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const files = (await readdir('drizzle')).filter(name => name.endsWith('.sql')).sort();
  assert.deepEqual(await migrateDatabase(sqlite), files);
  sqlite.prepare('INSERT INTO character_drafts (id, owner_id, document, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), 'author', '{"name":"Existing character"}', '2026-09-24T00:00:00.000Z', '2026-09-24T00:00:00.000Z');
  assert.deepEqual(await migrateDatabase(sqlite), []);
  assert.equal(sqlite.prepare('SELECT document FROM character_drafts').get().document, '{"name":"Existing character"}');
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM local_migrations').get().count, files.length);
});

test('an upgrade failure rolls back all its statements and can be retried without losing existing data', async t => {
  const {sqlite, directory, write} = await fixture(t);
  await write('0000_initial.sql', 'CREATE TABLE drafts (id TEXT PRIMARY KEY, title TEXT NOT NULL);');
  assert.deepEqual(await migrateDatabase(sqlite, directory), ['0000_initial.sql']);
  sqlite.prepare('INSERT INTO drafts VALUES (?, ?)').run('draft-1', 'Original title');
  await write('0001_upgrade.sql', `
    ALTER TABLE drafts ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
    UPDATE drafts SET title = 'Changed title';
    CREATE TABLE draft_history (id TEXT PRIMARY KEY);
    INSERT INTO missing_table VALUES ('fail');
  `);
  await assert.rejects(migrateDatabase(sqlite, directory), /Failed to apply migration 0001_upgrade.sql/);
  assert.deepEqual(sqlite.prepare('PRAGMA table_info(drafts)').all().map(column => column.name), ['id', 'title']);
  assert.equal(sqlite.prepare('SELECT title FROM drafts').get().title, 'Original title');
  assert.equal(sqlite.prepare("SELECT name FROM sqlite_schema WHERE name = 'draft_history'").get(), undefined);
  assert.deepEqual(sqlite.prepare('SELECT name FROM local_migrations ORDER BY name').all().map(row => row.name), ['0000_initial.sql']);
  await write('0001_upgrade.sql', 'ALTER TABLE drafts ADD COLUMN revision INTEGER NOT NULL DEFAULT 1; UPDATE drafts SET revision = 2;');
  assert.deepEqual(await migrateDatabase(sqlite, directory), ['0001_upgrade.sql']);
  assert.deepEqual({...sqlite.prepare('SELECT * FROM drafts').get()}, {id: 'draft-1', title: 'Original title', revision: 2});
  assert.deepEqual(await migrateDatabase(sqlite, directory), []);
});

test('a failure recording the migration also rolls back its schema changes', async t => {
  const {sqlite, directory, write} = await fixture(t);
  await migrateDatabase(sqlite, directory);
  sqlite.exec(`CREATE TRIGGER reject_journal BEFORE INSERT ON local_migrations BEGIN SELECT RAISE(ABORT, 'journal unavailable'); END;`);
  await write('0000_initial.sql', 'CREATE TABLE drafts (id TEXT PRIMARY KEY);');
  await assert.rejects(migrateDatabase(sqlite, directory), /journal unavailable/);
  assert.equal(sqlite.prepare("SELECT name FROM sqlite_schema WHERE name = 'drafts'").get(), undefined);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM local_migrations').get().count, 0);
  sqlite.exec('DROP TRIGGER reject_journal');
  assert.deepEqual(await migrateDatabase(sqlite, directory), ['0000_initial.sql']);
  assert.ok(sqlite.prepare("SELECT name FROM sqlite_schema WHERE name = 'drafts'").get());
});
