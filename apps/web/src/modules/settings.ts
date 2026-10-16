// Ported from directus/app/src/modules/settings/index.ts
// Backoffice (spec 016 FR-001, data-model §1): route components are lazy (bundle budget). Out of scope routes are not
// declared and fall to `settings-not-found` (D-93: ai, marketplace, extensions, system-logs). Flows keeps the 012 frame
// until feature 017 (D-92). The screens of later waves (project, appearance, presets, translations)
// show the frame with the Settings sub-menu until their wave replaces it. preRegisterCheck as in feature 012.
import type { RouteLocationNormalized } from 'vue-router';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { defineModule } from './types.ts';

const Frame = () => import('./ModulePlaceholder.vue');
const FRAME_META = { module: 'settings' };

/** Not-found of the module with the path that was asked for, as the Directus guards do. */
const notFound = (to: RouteLocationNormalized) => ({
	name: 'settings-not-found',
	params: { _: to.path.split('/').slice(1) },
});

export default defineModule({
	id: 'settings',
	name: '$t:settings',
	icon: 'settings',
	routes: [
		{
			name: 'settings-data-model-redirect',
			path: '',
			redirect: '/settings/data-model',
		},
		{
			name: 'settings-project',
			path: 'project',
			component: Frame,
			meta: FRAME_META,
		},
		{
			name: 'settings-appearance',
			path: 'appearance',
			component: Frame,
			meta: FRAME_META,
		},
		{
			path: 'data-model',
			children: [
				{
					name: 'settings-collections',
					path: '',
					component: () => import('./settings/routes/data-model/CollectionsRoute.vue'),
					beforeEnter() {
						// Not awaited, as Directus: the list renders from the store and updates when the request answers.
						void useCollectionsStore().hydrate();
					},
					children: [
						{
							path: '+',
							name: 'settings-add-new',
							meta: { isFloatingView: true },
							components: { add: () => import('./settings/routes/data-model/NewCollection.vue') },
						},
					],
				},
				{
					name: 'settings-fields',
					path: ':collection',
					component: () => import('./settings/routes/data-model/FieldsRoute.vue'),
					async beforeEnter(to) {
						const collectionsStore = useCollectionsStore();
						const info = collectionsStore.getCollection(to.params['collection'] as string);

						if (!info) return notFound(to);

						// A database table without directus_collections row: configure it on the way in (Directus).
						if (!info.meta) {
							await sdk.request(
								requestEndpoint(`/collections/${to.params['collection']}`, { method: 'PATCH', body: { meta: {} } }),
							);
						}

						void useFieldsStore().hydrate();
						return true;
					},
					props: (route) => ({
						collection: route.params['collection'],
						field: route.params['field'],
						type: route.query['type'],
					}),
					children: [
						{
							path: ':field',
							name: 'settings-fields-field',
							meta: { isFloatingView: true },
							components: { field: () => import('./settings/routes/data-model/field-detail/FieldDetail.vue') },
						},
					],
				},
			],
		},
		{
			path: 'policies',
			children: [
				{
					name: 'settings-policies-collection',
					path: '',
					component: () => import('./settings/routes/policies/PoliciesCollectionRoute.vue'),
					children: [
						{
							path: '+',
							name: 'settings-add-new-policy',
							meta: { isFloatingView: true },
							components: { add: () => import('./settings/routes/policies/NewPolicy.vue') },
						},
					],
				},
				{
					name: 'settings-policies-item',
					path: ':primaryKey',
					component: () => import('./settings/routes/policies/PolicyItemRoute.vue'),
					props: true,
				},
			],
		},
		{
			path: 'roles',
			children: [
				{
					name: 'settings-roles-collection',
					path: '',
					component: () => import('./settings/routes/roles/RolesCollectionRoute.vue'),
					children: [
						{
							path: '+',
							name: 'settings-add-new-role',
							meta: { isFloatingView: true },
							components: { add: () => import('./settings/routes/roles/NewRole.vue') },
						},
					],
				},
				{
					name: 'settings-roles-public-item',
					path: 'public',
					component: () => import('./settings/routes/roles/RolePublicRoute.vue'),
				},
				{
					name: 'settings-roles-item',
					path: ':primaryKey',
					component: () => import('./settings/routes/roles/RoleItemRoute.vue'),
					props: true,
				},
			],
		},
		{
			path: 'presets',
			children: [
				{ name: 'settings-presets-collection', path: '', component: Frame, meta: FRAME_META },
				{ name: 'settings-presets-item', path: ':id', component: Frame, meta: FRAME_META },
			],
		},
		{
			// D-92: the flows editor is feature 017.
			path: 'flows',
			children: [
				{ name: 'settings-flows-collection', path: '', component: Frame, meta: FRAME_META },
				{ name: 'settings-flows-item', path: ':primaryKey(.*)', component: Frame, meta: FRAME_META },
			],
		},
		{
			path: 'translations',
			children: [
				{ name: 'settings-translations-collection', path: '', component: Frame, meta: FRAME_META },
				{ name: 'settings-translations-item', path: ':primaryKey', component: Frame, meta: FRAME_META },
			],
		},
		{
			name: 'settings-not-found',
			path: ':_(.+)+',
			component: () => import('./content/routes/ContentNotFound.vue'),
			props: { module: 'settings' },
		},
	],
	preRegisterCheck: (user) => {
		return user.admin_access === true;
	},
});
