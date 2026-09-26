import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';

const importedDocument = JSON.stringify({
  title: 'Imported manuscript',
  status: 'drafting',
  synopsis: '',
  coverUrl: '',
  seriesId: '',
  seriesOrder: 0,
  hiddenFields: [],
});

/**
 * Attach legacy chapters to one durable default novel per owner. Each owner is
 * committed independently so a malformed owner's records cannot block others.
 * `owner_default_novels` survives a title edit and prevents a second default.
 */
export function backfillChapterNovels(sqlite, {logger = console} = {}) {
  const owners = sqlite.prepare('SELECT DISTINCT owner_id FROM chapters ORDER BY owner_id').all();
  const mappedDefault = sqlite.prepare(`
    SELECT novels.id FROM owner_default_novels AS defaults
    JOIN novels ON novels.id = defaults.novel_id AND novels.owner_id = defaults.owner_id
    WHERE defaults.owner_id = ?
  `);
  const titledDefault = sqlite.prepare(`
    SELECT id FROM novels
    WHERE owner_id = ? AND json_extract(document, '$.title') = 'Imported manuscript'
    ORDER BY created_at, id LIMIT 1
  `);
  const insertNovel = sqlite.prepare(`
    INSERT INTO novels (id, owner_id, document, schema_version, version, created_at, updated_at)
    VALUES (?, ?, ?, 1, 1, ?, ?)
  `);
  const mapDefault = sqlite.prepare(`
    INSERT INTO owner_default_novels (owner_id, novel_id) VALUES (?, ?)
    ON CONFLICT(owner_id) DO NOTHING
  `);
  const updateChapters = sqlite.prepare(`
    UPDATE chapters SET novel_id = ? WHERE owner_id = ? AND novel_id IS NULL
  `);
  const pendingChapters = sqlite.prepare('SELECT 1 FROM chapters WHERE owner_id = ? AND novel_id IS NULL LIMIT 1');
  const summary = {ownersProcessed: 0, ownersSucceeded: 0, ownersFailed: 0, novelsCreated: 0, chaptersUpdated: 0, errors: []};

  for (const {owner_id: ownerId} of owners) {
    summary.ownersProcessed++;
    let inTransaction = false;
    try {
      sqlite.exec('BEGIN IMMEDIATE');
      inTransaction = true;
      if (!pendingChapters.get(ownerId)) {
        sqlite.exec('COMMIT');
        inTransaction = false;
        summary.ownersSucceeded++;
        continue;
      }
      let novelId = mappedDefault.get(ownerId)?.id;
      let created = 0;
      if (!novelId) {
        novelId = titledDefault.get(ownerId)?.id;
        if (!novelId) {
          novelId = randomUUID();
          const now = new Date().toISOString();
          insertNovel.run(novelId, ownerId, importedDocument, now, now);
          created = 1;
        }
        mapDefault.run(ownerId, novelId);
      }
      const updated = updateChapters.run(novelId, ownerId).changes;
      sqlite.exec('COMMIT');
      inTransaction = false;
      summary.ownersSucceeded++;
      summary.novelsCreated += created;
      summary.chaptersUpdated += updated;
    } catch (error) {
      if (inTransaction) {
        try {sqlite.exec('ROLLBACK');} catch (rollbackError) {
          logger.error(`Novel backfill rollback failed for owner ${ownerId}: ${rollbackError.message}`);
        }
      }
      summary.ownersFailed++;
      summary.errors.push({ownerId, error: error.message});
      logger.error(`Novel backfill failed for owner ${ownerId}: ${error.message}`);
    }
  }

  logger.log(`Novel backfill: ${summary.ownersProcessed} owners processed, ${summary.novelsCreated} novels created, ${summary.chaptersUpdated} chapters updated, ${summary.ownersFailed} owners failed.`);
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sqlite = new DatabaseSync(process.argv[2] || process.env.WTF_DATABASE_PATH || '.sites-runtime/development.sqlite');
  try {
    const summary = backfillChapterNovels(sqlite);
    if (summary.ownersFailed) process.exitCode = 1;
  } finally {
    sqlite.close();
  }
}
