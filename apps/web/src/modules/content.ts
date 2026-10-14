// Ported from directus/app/src/modules/content/index.ts
// Backoffice: id, name, icon only; routes are the module frame (D-40, feature 014).
import { defineModule, placeholderRoutes } from './types.ts';

export default defineModule({
	id: 'content',
	name: '$t:content',
	icon: 'box',
	routes: placeholderRoutes('content'),
});
