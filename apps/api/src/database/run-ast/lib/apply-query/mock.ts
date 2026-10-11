// Ported from directus/api/src/database/run-ast/lib/apply-query/mock.ts
import { MockClient } from 'knex-mock-client';

// in order for the helpers to know the client type
export class Client_SQLite3 extends MockClient {}
