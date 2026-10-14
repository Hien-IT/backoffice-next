// Ported from directus/app/src/modules/files/index.ts
// Backoffice: id, name, icon and preRegisterCheck only; routes are the module frame (D-40, feature 015).
import { canRead, defineModule, placeholderRoutes } from './types.ts';

export default defineModule({
	id: 'files',
	name: '$t:file_library',
	icon: 'folder',
	routes: placeholderRoutes('files'),
	preRegisterCheck: canRead('directus_files'),
});
