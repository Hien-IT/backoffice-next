// Ported from directus/api/src/database/helpers/geometry/types.ts (supported() only; the geometry query helpers
// come with the items feature)
import { DatabaseHelper } from '../types.js';

export abstract class GeometryHelper extends DatabaseHelper {
	supported(): boolean | Promise<boolean> {
		return true;
	}
}
