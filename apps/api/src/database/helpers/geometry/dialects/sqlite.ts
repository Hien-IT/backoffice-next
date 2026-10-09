// Ported from directus/api/src/database/helpers/geometry/dialects/sqlite.ts (supported() only)
import { GeometryHelper } from '../types.js';

export class GeometryHelperSQLite extends GeometryHelper {
	override async supported() {
		const res = await this.knex.select('name').from('pragma_function_list').where({ name: 'spatialite_version' });
		return res.length > 0;
	}
}
