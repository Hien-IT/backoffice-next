// Ported from directus/api/src/database/helpers/schema/dialects/mssql.ts (subset: formatUUID, feature 006 ports the rest)
import { SchemaHelper } from '../types.js';

export class SchemaHelperMSSQL extends SchemaHelper {
	override formatUUID(uuid: string): string {
		return uuid.toUpperCase();
	}
}
