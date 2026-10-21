// Ported from directus/app/src/modules/settings/index.ts
// Backoffice (spec 016 FR-001, data-model §1): route components are lazy (bundle budget). Out of scope routes are not
// declared and fall to `settings-not-found` (D-93: ai, marketplace, system-logs; extensions since spec 020). Flows keeps the 012 frame
// until feature 017 (D-92); every other screen of the module is its port. preRegisterCheck as in feature 012.
import type { RouteLocationNormalized } from 'vue-router';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useFlowsStore } from '../stores/flows.ts';
import { defineModule } from './types.ts';

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
			component: () => import('./settings/routes/project/ProjectRoute.vue'),
		},
		{
			name: 'settings-appearance',
			path: 'appearance',
			component: () => import('./settings/routes/appearance/AppearanceRoute.vue'),
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
				{
					name: 'settings-presets-collection',
					path: '',
					component: () => import('./settings/routes/presets/PresetsCollectionRoute.vue'),
				},
				{
					name: 'settings-presets-item',
					path: ':id',
					component: () => import('./settings/routes/presets/PresetItemRoute.vue'),
					props: true,
				},
			],
		},
		{
			// Feature 017 (FR-001, D-92 lifted): the flows overview, the flow page and its operation drawer (a child route drawn by
			// the page's unnamed RouterView, as Directus flow.vue).
			path: 'flows',
			children: [
				{
					name: 'settings-flows-collection',
					path: '',
					component: () => import('./settings/routes/flows/FlowsOverviewRoute.vue'),
				},
				{
					name: 'settings-flows-item',
					path: ':primaryKey',
					component: () => import('./settings/routes/flows/FlowRoute.vue'),
					props: true,
					// Directus: the flow comes from the store hydrated at sign-in; an unknown id is the not-found page.
					beforeEnter: (to) => {
						if (!useFlowsStore().flows.some((flow) => flow.id === to.params['primaryKey'])) return notFound(to);
						return;
					},
					children: [
						{
							name: 'settings-flows-operation',
							path: ':operationId',
							component: () => import('./settings/routes/flows/OperationDetail.vue'),
							props: true,
							meta: { isFloatingView: true },
						},
					],
				},
			],
		},
		{
			path: 'translations',
			children: [
				{
					name: 'settings-translations-collection',
					path: '',
					component: () => import('./settings/routes/translations/TranslationsCollectionRoute.vue'),
				},
				{
					name: 'settings-translations-item',
					path: ':primaryKey',
					component: () => import('./settings/routes/translations/TranslationItemRoute.vue'),
					props: true,
				},
			],
		},
		{
			name: 'settings-extensions',
			path: 'extensions',
			component: () => import('./settings/routes/extensions/ExtensionsRoute.vue'),
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
