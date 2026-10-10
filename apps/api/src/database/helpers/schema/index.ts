// Ported from directus/api/src/database/helpers/schema/index.ts. Of the dialect classes only MSSQL overrides
// formatUUID, so the other clients use the default class until feature 006 ports their DDL helpers.
export { SchemaHelperDefault as cockroachdb } from './dialects/default.js';
export { SchemaHelperDefault as redshift } from './dialects/default.js';
export { SchemaHelperMSSQL as mssql } from './dialects/mssql.js';
export { SchemaHelperDefault as mysql } from './dialects/default.js';
export { SchemaHelperDefault as oracle } from './dialects/default.js';
export { SchemaHelperDefault as postgres } from './dialects/default.js';
export { SchemaHelperDefault as sqlite } from './dialects/default.js';
