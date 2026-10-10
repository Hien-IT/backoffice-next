// Ported from directus/api/src/database/helpers/schema/types.ts (subset: formatUUID, used by ItemsService.createOne).
// ponytail: only formatUUID; the DDL helpers (changeToType, preColumnChange, ...) come with feature 006.
import { DatabaseHelper } from '../types.js';

export class SchemaHelper extends DatabaseHelper {
	formatUUID(uuid: string): string {
		return uuid; // no-op by default
	}
}
