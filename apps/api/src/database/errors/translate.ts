// Ported from directus/api/src/database/errors/translate.ts
import type { Item } from '@backoffice/types';
import { getDatabaseClient } from '../index.js';
import { extractError as mssql } from './dialects/mssql.js';
import { extractError as mysql } from './dialects/mysql.js';
import { extractError as oracle } from './dialects/oracle.js';
import { extractError as postgres } from './dialects/postgres.js';
import { extractError as sqlite } from './dialects/sqlite.js';
import type { SQLError } from './dialects/types.js';

/**
 * Translates an error thrown by any of the databases into a pre-defined Exception. Currently
 * supports:
 * - Invalid Foreign Key
 * - Not Null Violation
 * - Record Not Unique
 * - Value Out of Range
 * - Value Too Long
 */
export async function translateDatabaseError(error: SQLError, data: Partial<Item>): Promise<any> {
	const client = getDatabaseClient();
	let defaultError: any;

	switch (client) {
		case 'mysql':
			defaultError = mysql(error, data);
			break;
		case 'cockroachdb':
		case 'postgres':
			defaultError = postgres(error, data);
			break;
		case 'sqlite':
			defaultError = sqlite(error, data);
			break;
		case 'oracle':
			defaultError = oracle(error);
			break;
		case 'mssql':
			defaultError = await mssql(error, data);
			break;
	}

	// Backoffice: the `database.error` filter event is not emitted (D-26 of spec 003); its default is the result.
	return defaultError;
}
