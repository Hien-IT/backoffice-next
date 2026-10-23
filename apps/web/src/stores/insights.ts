// Ported from directus/app/src/stores/insights.ts
// Backoffice: GraphQL goes through apiFetch (the SDK would throw on a 200 answer that carries partial `errors`), REST
// through the SDK; panel types come from the static registry (no extensions, XI); isSystemCollection is the
// get-item-route check; escapeRegExp of lodash-es replaces escape-string-regexp (research T001 (a)); errors open the
// dialog of useNotices (FR-081); stagePanelUpdate ignores an id that is not in the store (spec Edge Cases, release-gate
// CHK005) where DR could throw; the panel registry is imported in `hydrate` (a lazy chunk, FR-109), since the store
// itself loads with the app entry.
import type { Item, Panel } from '@directus/types';
import { applyOptionsData, getSimpleHash, toArray } from '@directus/utils';
import { assign, clone, escapeRegExp, get, isUndefined, mapKeys, omit, omitBy, pull, uniq } from 'lodash-es';
import { nanoid } from 'nanoid';
import { defineStore } from 'pinia';
import { computed, reactive, ref, unref } from 'vue';
import { apiFetch, requestEndpoint, sdk } from '../api/sdk.ts';
import { showUnexpectedError } from '../composables/use-notices.ts';
import { fetchAll } from '../utils/fetch-all.ts';
import { isSystemCollection } from '../utils/get-item-route.ts';
import { useFieldsStore } from './fields.ts';
import { usePermissionsStore } from './permissions.ts';

type PanelRegistry = typeof import('../panels/index.ts');

let registry: PanelRegistry | null = null;

/** The panel config of a type; null before `hydrate` loaded the registry (no panel exists then). */
const getPanel = (type: string | null | undefined) => registry?.getPanel(type);

/** Loads the registry once (tests and the dashboard route call it too). */
export async function loadPanelRegistry(): Promise<PanelRegistry> {
	registry ??= await import('../panels/index.ts');
	return registry;
}

export type Dashboard = {
	id: string;
	name: string;
	note: string | null;
	icon: string;
	color: string | null;
	date_created: string;
	user_created: string;
};

export type CreatePanel = Partial<Panel> &
	Pick<Panel, 'id' | 'width' | 'height' | 'position_x' | 'position_y' | 'type' | 'options'>;

type GraphqlError = { extensions?: { code?: string; graphqlErrors?: { path?: string[] }[] } };

/** Error thrown for a non-2xx GraphQL answer, shaped like the axios error DR reads (`response.status`, `data`). */
class GraphqlRequestError extends Error {
	readonly errors: GraphqlError[];
	readonly response: { status: number; data: { errors?: GraphqlError[] } };

	constructor(status: number, data: { errors?: GraphqlError[] }) {
		super(`GraphQL request failed with status ${status}`);
		this.errors = data.errors ?? [];
		this.response = { status, data };
	}
}

async function postGraphql(path: string, query: string): Promise<{ data: Record<string, unknown>; errors?: unknown }> {
	const response = await apiFetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query }),
	});

	const body = await response.json().catch(() => ({}));

	if (!response.ok) throw new GraphqlRequestError(response.status, body);

	return body;
}

const MAX_CACHE_SIZE = 3; // Max number of dashboards to keep in cache at a time

export const useInsightsStore = defineStore('insightsStore', () => {
	/** All available dashboards in the platform */
	const dashboards = ref<Dashboard[]>([]);

	/** All available panels */
	const panels = ref<Panel[]>([]);

	/** Panels that are currently loading */
	const loading = ref<string[]>([]);

	/** Panels that errored while fetching data */
	const errors = ref<{ [id: string]: unknown }>({});

	/** Cache/store for the panel data */
	const data = ref<{ [panel: string]: Item | Item[] }>({});

	/** Runtime filter values */
	const variables = ref<{ [field: string]: any }>({});

	/** Staged edits  */
	const edits = reactive<{ create: CreatePanel[]; update: Partial<Panel>[]; delete: string[] }>({
		create: [],
		update: [],
		delete: [],
	});

	const refreshIntervals = {} as { [dashboard: string]: number | null };

	const saving = ref(false);

	/** Last MAX_CACHE_SIZE dashboards that we've loaded into data. Used to purge caches once too much data is loaded */
	const lastLoaded: string[] = [];

	/** If there's any unsaved staged changes */
	const hasEdits = computed(() => edits.create.length > 0 || edits.update.length > 0 || edits.delete.length > 0);

	/** Raw panels modified to assign the edits */
	const panelsWithEdits = computed<Panel[]>(() => {
		return [
			...unref(panels)
				.filter((panel) => edits.delete.includes(panel.id) === false)
				.map((panel) => {
					const updates = edits.update.find((updated) => updated.id === panel.id);

					if (updates) {
						return assign({}, panel, updates);
					}

					return panel;
				}),
			...(edits.create as Panel[]),
		];
	});

	return {
		dashboards,
		panels: panelsWithEdits,
		loading,
		errors,
		data,
		hasEdits,
		saving,
		edits,
		variables,
		hydrate,
		dehydrate,
		clearCache,
		clearEdits,
		getDashboard,
		getPanelsForDashboard,
		refresh,
		stagePanelCreate,
		stagePanelUpdate,
		stagePanelDuplicate,
		stagePanelDelete,
		saveChanges,
		refreshIntervals,
		getVariable,
		setVariable,
	};

	async function hydrate() {
		const { hasPermission } = usePermissionsStore();

		if (hasPermission('directus_dashboards', 'read') && hasPermission('directus_panels', 'read')) {
			await loadPanelRegistry();

			try {
				const [dashboardsResponse, panelsResponse] = await Promise.all([
					fetchAll<Dashboard>('/dashboards', { params: { fields: ['*'], sort: ['name'] } }),
					fetchAll<Panel>('/panels', { params: { fields: ['*'], sort: ['dashboard'] } }),
				]);

				dashboards.value = dashboardsResponse;
				panels.value = panelsResponse;
			} catch {
				dashboards.value = [];
				panels.value = [];
			}
		}

		const variableDefaults: Record<string, any> = {};

		panels.value.forEach((panel) => {
			const panelType = getPanel(panel.type);

			if (panelType?.variable === true && panel.options?.['field']) {
				variableDefaults[panel.options['field']] = panel.options?.['defaultValue'];
			}
		});

		variables.value = assign({}, variableDefaults, variables.value);
	}

	function dehydrate() {
		dashboards.value = [];
		panels.value = [];

		clearCache();
		clearEdits();
	}

	function clearCache() {
		loading.value = [];
		errors.value = {};
		data.value = {};
	}

	function clearEdits() {
		edits.create = [];
		edits.update = [];
		edits.delete = [];
	}

	function getDashboard(id: string) {
		return unref(dashboards).find((dashboard) => dashboard.id === id);
	}

	function getPanelsForDashboard(dashboard: string) {
		return unref(panelsWithEdits).filter((panel) => panel.dashboard === dashboard);
	}

	async function refresh(dashboard: string) {
		const panelsForDashboard = unref(panels).filter((panel) => panel.dashboard === dashboard);

		await loadPanelData(panelsForDashboard);

		if (lastLoaded.includes(dashboard) === false) {
			lastLoaded.push(dashboard);

			if (lastLoaded.length > MAX_CACHE_SIZE) {
				const removed = lastLoaded.shift();

				const removedPanels = unref(panels)
					.filter((panel) => panel.dashboard === removed)
					.map(({ id }) => id);

				data.value = omit(data.value, ...removedPanels);
			}
		}
	}

	function emptyRelations() {
		return unref(panels)
			.filter(({ type }) => type === 'relational-variable')
			.filter(({ options }) => get(unref(variables), options['field']) == undefined)
			.map(({ options }) => options['field'])
			.filter((fieldName) => typeof fieldName === 'string' && fieldName.length > 0) as string[];
	}

	function hasEmptyRelation(panel: Pick<Panel, 'options' | 'type'>) {
		const stringOptions = JSON.stringify(panel.options);

		for (const relationVar of emptyRelations()) {
			const fieldRegex = new RegExp(`{{\\s*?${escapeRegExp(relationVar)}\\s*?}}`);
			if (fieldRegex.test(stringOptions)) return true;
		}

		return false;
	}

	async function loadPanelData(
		panels: Pick<Panel, 'id' | 'options' | 'type'> | Pick<Panel, 'id' | 'options' | 'type'>[],
	): Promise<void> {
		panels = toArray(panels);

		const fieldsStore = useFieldsStore();

		const queries = new Map<
			string,
			{ panel: string; collection: string; query: any; key: string; index: number; length: number }
		>();

		for (const panel of panels) {
			const req = prepareQuery(panel);

			// Backoffice (D-111, owner 2026-10-18): a collection the viewer cannot read is not in the collections and
			// fields stores. DR then throws in queryToGqlString (formatQuery) and the whole dashboard breaks, or the
			// panel's own query() returns nothing and the tile shows no data. Here only this tile shows a FORBIDDEN error.
			const collections: string[] = req
				? toArray(req).map(({ collection }) => collection)
				: getPanel(panel.type)?.query && typeof panel.options?.['collection'] === 'string'
					? [panel.options['collection']]
					: [];
			const unreadable = collections.find((collection) => !fieldsStore.getPrimaryKeyFieldForCollection(collection));

			if (unreadable) {
				errors.value[panel.id] = {
					errors: [
						{
							message: `You don't have permission to access collection "${unreadable}" or it does not exist.`,
							extensions: { code: 'FORBIDDEN' },
						},
					],
				};
				continue;
			}

			if (!req) continue;

			if (hasEmptyRelation(panel)) {
				data.value[panel.id] = {};
				continue;
			}

			toArray(req).forEach(({ collection, query }, index) => {
				const key = getSimpleHash(panel.id + collection + JSON.stringify(query));
				queries.set(key, { panel: panel.id, collection, query, key, index, length: toArray(req).length });
			});
		}

		loading.value = uniq([...loading.value, ...Array.from(queries.values()).map(({ panel }) => panel)]);

		// Backoffice: lazy, json-to-graphql-query stays out of the entry chunk (hydrate imports this store, FR-109).
		const { queryToGqlString } = await import('../utils/query-to-gql-string.ts');

		const gqlString = queryToGqlString(
			Array.from(queries.values())
				.filter(({ collection }) => isSystemCollection(collection) === false)
				.map(({ key, ...rest }) => ({ key: `query_${key}`, ...rest })),
		);

		const systemGqlString = queryToGqlString(
			Array.from(queries.values())
				.filter(({ collection }) => isSystemCollection(collection))
				.map(({ key, ...rest }) => ({
					key: `query_${key}`,
					...rest,
				})),
		);

		try {
			const requests: Promise<{ data: Record<string, unknown>; errors?: unknown }>[] = [];

			if (gqlString) requests.push(postGraphql(`/graphql`, gqlString));
			if (systemGqlString) requests.push(postGraphql(`/graphql/system`, systemGqlString));

			const responses = await Promise.all(requests);

			const results: { [panel: string]: any } = {};

			for (const response of responses) {
				const result = mapKeys(response.data ?? {}, (_, key) => key.substring('query_'.length));

				for (const [key, data] of Object.entries(result)) {
					const { panel, length } = queries.get(key)!;
					if (length === 1) results[panel] = data;
					else if (!results[panel]) results[panel] = [data];
					else results[panel]?.push(data);
				}

				if (Array.isArray(response.errors)) {
					setErrorsFromResponseData(response.errors);
				}
			}

			data.value = assign({}, data.value, results);

			const succeededPanels = Object.keys(results);
			errors.value = omit(errors.value, ...succeededPanels);
		} catch (error: any) {
			/**
			 * A thrown error means the request failed completely. This can happen for a wide variety
			 * of reasons, but there's one common one we need to account for: misconfigured panels. A
			 * GraphQL validation error will throw a 400 rather than a 200+partial data, so we need to
			 * retry the request without the failed panels */

			if (error?.response?.status === 400 && Array.isArray(error.response.data?.errors)) {
				const failedIDs = setErrorsFromResponseData(error.response.data.errors);

				const panelsToTryAgain = panels.filter(({ id }) => failedIDs.includes(id) === false);

				// Make sure we don't end in an infinite loop of retries
				if (panels.length !== panelsToTryAgain.length) {
					await loadPanelData(panelsToTryAgain);
				} else {
					showUnexpectedError(error);
				}
			} else {
				showUnexpectedError(error);
			}
		} finally {
			loading.value = pull(unref(loading), ...Array.from(queries.values()).map(({ panel }) => panel));
		}

		/**
		 * Set the error objects based on the gqlError paths, returns the panel IDs of the panels that failed
		 */
		function setErrorsFromResponseData(responseErrors: any[]): string[] {
			const failedIDs: string[] = [];

			for (const gqlError of responseErrors) {
				const queryKey = gqlError?.extensions?.graphqlErrors?.[0]?.path?.[0];
				if (!queryKey) continue;
				const panelID = queries.get(queryKey.substring('query_'.length))?.panel;
				if (!panelID) continue;
				failedIDs.push(panelID);
				errors.value = assign({}, errors.value, { [panelID]: gqlError });
			}

			return failedIDs;
		}
	}

	function prepareQuery(panel: Pick<Panel, 'options' | 'type'>) {
		const panelType = getPanel(panel.type);
		return (
			panelType?.query?.(applyOptionsData(panel.options ?? {}, unref(variables), panelType.skipUndefinedKeys)) ?? null
		);
	}

	function stagePanelCreate(panel: CreatePanel) {
		edits.create.push(panel);
		loadPanelData(panel);
	}

	function stagePanelUpdate({
		id,
		edits: changes,
	}: {
		id: string;
		edits: { [K in keyof Panel]?: Panel[K] | undefined };
	}) {
		const panelEdits = omitBy(changes, isUndefined) as Partial<Panel>;

		const isNew = id.startsWith('_');

		// Backoffice: an unknown id (the panel drawer opened at a stale URL) is ignored instead of throwing below.
		if (!isNew && !unref(panels).some((panel) => panel.id === id)) return;

		const arr = isNew ? edits.create : edits.update;

		/**
		 * Check what the currently used data query is, so we can compare it to the new query later to
		 * decide whether or not to reload the data
		 */
		let oldQuery;

		if ('options' in panelEdits) {
			// Edits not yet applied
			const panel = unref(panelsWithEdits).find((panel) => panel.id === id);

			if (panel) {
				const panelType = getPanel(panel.type);

				oldQuery = panelType?.query?.(
					applyOptionsData(panel.options ?? {}, unref(variables), panelType.skipUndefinedKeys),
				);
			}
		}

		if (arr.map(({ id }) => id).includes(id)) {
			const updatedArr = arr.map((currentEdit) => {
				if (currentEdit.id === id) {
					return assign({}, currentEdit, panelEdits);
				}

				return currentEdit;
			});

			if (isNew) edits.create = updatedArr as CreatePanel[];
			else edits.update = updatedArr;
		} else {
			arr.push({ id, ...panelEdits } as CreatePanel);
		}

		// Reload data for panel if the query has changed
		if ('options' in panelEdits) {
			// This panel has the edits applied
			const panel = unref(panelsWithEdits).find((panel) => panel.id === id);
			if (!panel) return;
			const panelType = getPanel(panel.type);

			const newQuery = panelType?.query?.(
				applyOptionsData(panelEdits.options ?? {}, unref(variables), panelType.skipUndefinedKeys),
			);

			if (JSON.stringify(oldQuery) !== JSON.stringify(newQuery)) loadPanelData(panel);

			// Clear relational variable cache if collection was changed
			if (panel.type === 'relational-variable' && panelEdits.options?.['collection'] && panel.options?.['field']) {
				variables.value[panel.options['field']] = undefined;
			}
		}
	}

	function stagePanelDuplicate(panelKey: string, overrides?: Partial<Panel>) {
		const panel = unref(panelsWithEdits).find((panel) => panel.id === panelKey);
		if (!panel) return;

		const newPanel = clone(panel);

		newPanel.id = `_${nanoid()}`;
		newPanel.position_x = (newPanel.position_x ?? 0) + 2;
		newPanel.position_y = (newPanel.position_y ?? 0) + 2;

		// In case width/height is totally unknown (which it shouldn't be) fallback to 4x4 as a last-resort
		newPanel.width ??= 4;
		newPanel.height ??= 4;

		if (overrides) {
			assign(newPanel, overrides);
		}

		stagePanelCreate(newPanel as CreatePanel);
	}

	function stagePanelDelete(panelKey: string) {
		if (edits.create.some((created) => created.id === panelKey)) {
			edits.create = edits.create.filter((created) => created.id !== panelKey);
			return;
		}

		edits.update = edits.update.filter((updated) => updated.id !== panelKey);
		edits.delete.push(panelKey);
		data.value = omit(data.value, panelKey);
	}

	// Backoffice (D-112, owner 2026-10-18): DR sends the three requests in parallel and on any error keeps every
	// staged edit, so a second Save creates the already created panels again (R-56). Here the parts that succeeded leave
	// the staging and the store is reloaded; only the failed parts stay staged for the next Save.
	async function saveChanges() {
		saving.value = true;

		try {
			const jobs: { kind: 'create' | 'update' | 'delete'; request: Promise<unknown> }[] = [];

			if (edits.create.length > 0) {
				// Created edits might come with a temporary ID for editing. Make sure to submit to API without temp ID
				jobs.push({
					kind: 'create',
					request: sdk.request(
						requestEndpoint('/panels', { method: 'POST', body: edits.create.map((create) => omit(create, 'id')) }),
					),
				});
			}

			if (edits.update.length > 0) {
				jobs.push({
					kind: 'update',
					request: sdk.request(requestEndpoint('/panels', { method: 'PATCH', body: edits.update })),
				});
			}

			if (edits.delete.length > 0) {
				jobs.push({
					kind: 'delete',
					request: sdk.request(requestEndpoint('/panels', { method: 'DELETE', body: edits.delete })),
				});
			}

			const results = await Promise.allSettled(jobs.map(({ request }) => request));
			const done = jobs.filter((_, index) => results[index]!.status === 'fulfilled').map(({ kind }) => kind);
			const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');

			if (done.length > 0) {
				await hydrate();

				if (done.includes('create')) {
					// Remove cached data for the newly created panels
					data.value = omit(data.value, ...edits.create.map(({ id }) => id));
				}

				// Fetch data for panels that now exist in the dashboard (from create) but haven't been fetched yet
				// (like DR, before the edits are cleared: the temporary created panels load once more).
				const panelsToLoad = unref(panelsWithEdits).filter(({ id }) => id in unref(data) === false);
				loadPanelData(panelsToLoad);

				for (const kind of done) edits[kind] = [];
			}

			if (failure) showUnexpectedError(failure.reason);
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			saving.value = false;
		}
	}

	function getVariable(field: string) {
		return get(unref(variables), field);
	}

	function setVariable(field: string, value: unknown) {
		const newVariables = assign({}, variables.value, { [field]: value });

		// Find all panels that are using this variable in their options
		const regex = new RegExp(`{{\\s*?${escapeRegExp(field)}\\s*?}}`);

		const needReload = unref(panelsWithEdits).filter((panel) => {
			if (panel.id in unref(data) === false) return false;

			const optionsString = JSON.stringify(panel.options ?? {});
			const containsVariable = regex.test(optionsString);
			if (!containsVariable) return false;

			const panelType = getPanel(panel.type);
			if (!panelType) return false;

			const oldQuery = panelType.query?.(
				applyOptionsData(panel.options ?? {}, unref(variables), panelType.skipUndefinedKeys),
			);

			const newQuery = panelType.query?.(
				applyOptionsData(panel.options ?? {}, unref(newVariables), panelType.skipUndefinedKeys),
			);

			return JSON.stringify(oldQuery) !== JSON.stringify(newQuery);
		});

		variables.value = newVariables;

		if (needReload.length > 0) {
			loadPanelData(needReload);
		}
	}
});
