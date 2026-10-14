// Ported from directus/app/src/modules/activity/index.ts
// Backoffice: id, name, icon, hidden only; routes are the module frame (D-40, feature 018).
import { defineModule, placeholderRoutes } from './types.ts';

export default defineModule({
	id: 'activity',
	hidden: true,
	name: '$t:activity',
	icon: 'notifications',
	routes: placeholderRoutes('activity'),
});
