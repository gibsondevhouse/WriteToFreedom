import {writeFile} from 'node:fs/promises';
import {documentSchema,renderFieldInventory} from '../db/document-contracts.js';

await writeFile(new URL('../db/documents.schema.json',import.meta.url),JSON.stringify(documentSchema,null,2)+'\n');
await writeFile(new URL('../docs/ui-field-inventory.md',import.meta.url),renderFieldInventory());
console.log('Generated document JSON Schema and UI field storage inventory.');
