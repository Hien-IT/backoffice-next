// Backoffice (spec 033, D-215, research R1): the documentation area, a hidden internal module. No DR counterpart. Like
// Activity it has no tile in the module grid (the entry is the user menu) but registers `/docs` and heads the sidebar;
// no preRegisterCheck: every user with app access reads it (FR-012). The route component and all content are lazy.
import { defineModule } from './types.ts';

const DocsRoute = () => import('./docs/routes/DocsRoute.vue');

export default defineModule({
	id: 'docs',
	hidden: true,
	name: '$t:documentation',
	icon: 'menu_book',
	routes: [
		{ name: 'docs-home', path: '', component: DocsRoute },
		{ name: 'docs-page', path: ':path(.*)*', component: DocsRoute },
	],
});
