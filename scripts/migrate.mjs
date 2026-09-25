import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';

/** Apply each local migration and its journal entry in the same transaction. */
export async function migrateDatabase(sqlite, directory = 'drizzle') {
  const files = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  const applied = [];
  for (const file of files) {
    const source = await readFile(join(directory, file), 'utf8');
    // No asynchronous work occurs while the SQLite transaction is open. Checking
    // the journal after acquiring the lock also makes concurrent starts safe.
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      if (!sqlite.prepare('SELECT name FROM local_migrations WHERE name = ?').get(file)) {
        sqlite.exec(source);
        sqlite.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(file);
        applied.push(file);
      }
      sqlite.exec('COMMIT');
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw new Error(`Failed to apply migration ${file}: ${error.message}`, {cause: error});
    }
  }
  return applied;
}
