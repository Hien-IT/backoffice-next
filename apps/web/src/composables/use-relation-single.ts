// Ported from directus/app/src/composables/use-relation-single.ts
// Backoffice: `@/sdk` -> src/api/sdk.ts (FR-001). unexpectedError has no notifications store before feature 018
// (D-45): only its console warning is kept.
import { getEndpoint } from '@directus/utils';
import { merge } from 'lodash-es';
import { computed, type MaybeRefOrGetter, ref, type Ref, toValue, watch } from 'vue';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import type { RelationM2O } from './use-relation-m2o.ts';

function unexpectedError(error: unknown): void {
	// eslint-disable-next-line no-console
	console.warn(error);
}

export type RelationQuerySingle = {
	fields: string[];
};

export type UseRelationSingleOptions = {
	enabled?: MaybeRefOrGetter<boolean>;
};

export function useRelationSingle<T extends Record<string, any>>(
	value: Ref<number | string | Record<string, any> | null>,
	previewQuery: Ref<RelationQuerySingle>,
	relation: Ref<RelationM2O | undefined>,
	options?: UseRelationSingleOptions,
) {
	const displayItem: Ref<T | null> = ref(null);
	const loading = ref(false);

	const enabled = computed(() => (options?.enabled === undefined ? true : toValue(options?.enabled)));

	watch(
		[value, previewQuery, relation, enabled],
		() => {
			if (enabled.value) getDisplayItem();
		},
		{ immediate: true },
	);

	return { update, remove, refresh, displayItem, loading };

	function update(item: Record<string, any> | string | number) {
		if (!relation.value) return;

		const pkField = relation.value.relatedPrimaryKeyField.field;

		// make sure when updating from an existing primary key, we also have it inside the changes
		if (value.value && typeof item === 'object' && pkField in item === false) {
			const existingPk: string | number = typeof value.value === 'object' ? value.value[pkField] : value.value;

			item[pkField] = existingPk;
		}

		value.value = item;
	}

	function remove() {
		value.value = null;
	}

	async function refresh() {
		await getDisplayItem();
	}

	async function getDisplayItem() {
		const val = value.value;

		if (!val) {
			displayItem.value = null;
			return;
		}

		if (!relation.value) return;

		const relatedCollection = relation.value.relatedCollection.collection;
		const pkField = relation.value.relatedPrimaryKeyField.field;

		const id = typeof val === 'object' ? val[relation.value.relatedPrimaryKeyField.field] : val;

		if (!id) {
			displayItem.value = val as T;
			return;
		}

		const fields = new Set(previewQuery.value.fields);
		fields.add(pkField);

		loading.value = true;

		try {
			const item = await sdk.request<T>(
				requestEndpoint(`${getEndpoint(relatedCollection)}/${encodeURIComponent(id)}`, {
					params: { fields: Array.from(fields) },
				}),
			);

			if (typeof val === 'object') {
				displayItem.value = merge({}, item, val);
			} else {
				displayItem.value = item;
			}
		} catch (error: any) {
			// if the item has a manually entered primary key, we can ignore the error
			if (typeof val === 'object' && error.response && error.response.status === 403) {
				displayItem.value = val as T;
			} else {
				unexpectedError(error);
			}
		} finally {
			loading.value = false;
		}
	}
}
