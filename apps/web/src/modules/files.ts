// Ported from directus/app/src/modules/files/index.ts
// Backoffice: route components are lazy (bundle budget, plan §Performance); the add-file dialog is the named view
// `addNew` of the library route (Directus `isFloatingView` meta kept); routes that match nothing show the module
// not-found page (ContentNotFound with `module: 'files'`, FR-001, FR-054); preRegisterCheck as in feature 012.
import { canRead, defineModule } from './types.ts';

const Collection = () => import('./files/routes/FilesCollectionRoute.vue');
const AddNew = () => import('./files/routes/AddNewFile.vue');

export default defineModule({
	id: 'files',
	name: '$t:file_library',
	icon: 'folder',
	routes: [
		{
			name: 'files-collection',
			path: '',
			component: Collection,
			children: [
				{
					path: '+',
					name: 'add-file',
					meta: {
						isFloatingView: true,
					},
					components: {
						addNew: AddNew,
					},
				},
			],
		},
		{
			path: 'folders',
			redirect: '/files',
		},
		{
			name: 'folders-collection',
			path: 'folders/:folder',
			component: Collection,
			props: true,
			children: [
				{
					path: '+',
					name: 'add-file-folder',
					components: {
						addNew: AddNew,
					},
				},
			],
		},
		{
			path: 'all',
			component: Collection,
			props: {
				special: 'all',
			},
		},
		{
			path: 'mine',
			component: Collection,
			props: {
				special: 'mine',
			},
		},
		{
			path: 'recent',
			component: Collection,
			props: {
				special: 'recent',
			},
		},
		{
			name: 'files-item',
			path: ':primaryKey',
			component: () => import('./files/routes/FileItemRoute.vue'),
			props: true,
		},
		{
			name: 'files-not-found',
			path: ':_(.+)+',
			component: () => import('./content/routes/ContentNotFound.vue'),
			props: { module: 'files' },
		},
	],
	preRegisterCheck: canRead('directus_files'),
});
