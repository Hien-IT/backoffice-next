// Ported from directus/api/src/database/run-ast/lib/apply-query/mock.ts
import { MockClient } from 'knex-mock-client';

// in order for the helpers to know the client type
export class Client_SQLite3 extends MockClient {}

// Backoffice (spec 023): Postgres SQL shape of the json path filter.
export class Client_PG extends MockClient {}
