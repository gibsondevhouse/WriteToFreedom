/** Storage format version, independent of the optimistic edit revision. */
export const supportedSchemaVersion = 1;

/** Fail closed on unknown formats; never silently rewrite a newer document. */
export function decodeStoredDocument(row) {
 const schemaVersion=row.schema_version??1;
 if(schemaVersion!==supportedSchemaVersion)throw new Error(`Unsupported stored document schema version: ${schemaVersion}`);
 const document=JSON.parse(row.document);
 if(!document||typeof document!=='object'||Array.isArray(document))throw new Error('Stored document must be a JSON object.');
 return document;
}

/** Optional on legacy requests, authoritative when supplied by newer clients. */
export function validateSchemaVersion(input) {
 if(Object.hasOwn(input,'schemaVersion')&&input.schemaVersion!==supportedSchemaVersion)throw new Error('Unsupported document format. Reload before saving.');
}
