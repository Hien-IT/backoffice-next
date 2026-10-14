// Ported from directus/app/src/modules/insights/index.ts
// Backoffice: id, name, icon and preRegisterCheck only; routes are the module frame (D-40, feature 018).
import { canRead, defineModule, placeholderRoutes } from './types.ts';

export default defineModule({
	id: 'insights',
	name: '$t:insights',
	icon: 'insights',
	routes: placeholderRoutes('insights'),
	preRegisterCheck: canRead('directus_dashboards'),
});
