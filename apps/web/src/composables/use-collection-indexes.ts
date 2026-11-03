// Backoffice (spec 030, D-210.4, contracts/web.md): the indexes of a user collection, from
// GET/POST/DELETE /backoffice/collections/:collection/indexes. One store per collection (the Indexes card and the
// delete-field dialog of FieldsManagement share it); unavailable (404) when the API is DR; polls every 5 s while a
// row is still `creating` (the API builds it in a background job), with a toast when it ends.
import { computed, getCurrentScope, type MaybeRefOrGetter, onScopeDispose, ref, type Ref, toValue } from 'vue';
import { apiFetch, requestEndpoint, sdk } from '../api/sdk.ts';
import { i18n } from '../lang/index.ts';
import { notify } from './use-notices.ts';

export type IndexType = 'btree' | 'trigram';
export type IndexStatus = 'creating' | 'ready' | 'failed';

export interface CollectionIndex {
	id: string;
	collection: string;
	name: string;
	fields: string[];
	type: IndexType;
	unique: boolean;
	status: IndexStatus;
	error: string | null;
	date_created: string;
	missing: boolean | null;
}

export interface IndexMeta {
	trigram: boolean;
	concurrent: boolean;
}

export interface IndexBody {
	fields: string[];
	type: IndexType;
	unique: boolean;
}

export const POLL_MS = 5000;

interface Store {
	indexes: Ref<CollectionIndex[]>;
	meta: Ref<IndexMeta>;
	available: Ref<boolean>;
	loading: Ref<boolean>;
	error: Ref<unknown>;
	timer: ReturnType<typeof setInterval> | null;
	watchers: number;
	loaded: boolean;
}

const stores = new Map<string, Store>();

function storeFor(collection: string): Store {
	let store = stores.get(collection);

	if (!store) {
		store = {
			indexes: ref([]),
			meta: ref({ trigram: false, concurrent: false }),
			available: ref(false),
			loading: ref(false),
			error: ref(null),
			timer: null,
			watchers: 0,
			loaded: false,
		};

		stores.set(collection, store);
	}

	return store;
}

const path = (collection: string) => `/backoffice/collections/${collection}/indexes`;
const t = (key: string, values?: Record<string, unknown>) => i18n.global.t(key, values ?? {});

async function load(collection: string): Promise<void> {
	const store = storeFor(collection);
	store.loading.value = true;
	store.loaded = true;

	try {
		const res = await apiFetch(path(collection), { method: 'GET' });

		// 404: the API is DR (D-210); 403: not an admin or a system collection. Either way no card.
		if (!res.ok) {
			store.available.value = false;
			store.indexes.value = [];
			return;
		}

		const body = (await res.json()) as { data: CollectionIndex[]; meta: IndexMeta };
		const before = new Map(store.indexes.value.map((row) => [row.id, row.status]));
		store.available.value = true;
		store.meta.value = body.meta;
		store.indexes.value = body.data;
		store.error.value = null;

		for (const row of body.data) {
			const previous = before.get(row.id);
			if (previous !== 'creating' || row.status === 'creating') continue;

			if (row.status === 'ready') notify({ title: t('index_ready_notice', { name: row.name }), type: 'success' });
			else notify({ title: t('index_failed_notice', { name: row.name, error: row.error ?? '' }), type: 'error' });
		}
	} catch (err) {
		store.error.value = err;
	} finally {
		store.loading.value = false;
		syncPolling(collection);
	}
}

/** A timer while a row is `creating` and someone watches the store; cleared otherwise. */
function syncPolling(collection: string): void {
	const store = storeFor(collection);
	const wanted = store.watchers > 0 && store.indexes.value.some((row) => row.status === 'creating');

	if (wanted && !store.timer) {
		store.timer = setInterval(() => void load(collection), POLL_MS);
	} else if (!wanted && store.timer) {
		clearInterval(store.timer);
		store.timer = null;
	}
}

export function useCollectionIndexes(collection: MaybeRefOrGetter<string>) {
	const key = () => toValue(collection);
	const store = computed(() => storeFor(key()));

	// Polling only while a component uses the store (the card or the field list); none after leaving the page.
	if (getCurrentScope()) {
		storeFor(key()).watchers++;
		onScopeDispose(() => {
			const s = storeFor(key());
			s.watchers--;
			syncPolling(key());
		});
	}

	async function create(body: IndexBody, concurrent = true): Promise<CollectionIndex> {
		const target = `${path(key())}${concurrent ? '' : '?concurrentIndexCreation=false'}`;
		const row = await sdk.request(requestEndpoint<CollectionIndex>(target, { method: 'POST', body: { ...body } }));
		const s = storeFor(key());
		s.indexes.value = [...s.indexes.value, row];
		notify({ title: t('index_created_notice', { name: row.name }) });
		syncPolling(key());
		return row;
	}

	async function remove(name: string): Promise<void> {
		await sdk.request(requestEndpoint(`${path(key())}/${name}`, { method: 'DELETE' }));
		const s = storeFor(key());
		s.indexes.value = s.indexes.value.filter((row) => row.name !== name);
		syncPolling(key());
	}

	return {
		available: computed(() => store.value.available.value),
		indexes: computed(() => store.value.indexes.value),
		meta: computed(() => store.value.meta.value),
		loading: computed(() => store.value.loading.value),
		error: computed(() => store.value.error.value),
		load: () => load(key()),
		/** The first read only (the delete-field dialog): the card refreshes with load(). */
		loadOnce: () => (storeFor(key()).loaded ? Promise.resolve() : load(key())),
		create,
		remove,
		/** The indexes that would be dropped with this field (FR-019a). */
		indexesOf: (field: string) => store.value.indexes.value.filter((row) => row.fields.includes(field)),
	};
}

/** Tests: forget every store and timer. */
export function _resetCollectionIndexes(): void {
	for (const store of stores.values()) if (store.timer) clearInterval(store.timer);
	stores.clear();
}
