// Ported from directus/api/src/database/helpers/geometry/dialects/postgres.ts (supported() only)
import { GeometryHelper } from '../types.js';

export class GeometryHelperPostgres extends GeometryHelper {
	override async supported() {
		const res = await this.knex.select('oid').from('pg_proc').where({ proname: 'postgis_version' });
		return res.length > 0;
	}
}
