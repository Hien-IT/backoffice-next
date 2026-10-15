<!-- Ported from directus/app/src/views/private/components/drawer-batch.vue -->
<script setup lang="ts">
// Backoffice: requests go through the SDK; errors other than validation open the unexpected error dialog of useNotices.
// The direct save (PATCH <endpoint> with keys, translations merge, `refresh` event) came with feature 014 (batch edit
// of the collection page, contracts/api-calls.md #72).
import type { PrimaryKey } from '@directus/types';
import { getEndpoint, isObject } from '@directus/utils';
import { omit } from 'lodash-es';
import { computed, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { useCollection } from '../../composables/use-collection.ts';
import { showUnexpectedError as unexpectedError } from '../../composables/use-notices.ts';
import { VALIDATION_TYPES } from '../../constants.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { fetchAll } from '../../utils/fetch-all.ts';
import BoButton from '../BoButton.vue';
import BoForm from '../form/BoForm.vue';
import BoDrawer from './BoDrawer.vue';

const props = withDefaults(
	defineProps<{
		collection: string;
		primaryKeys: PrimaryKey[];
		active?: boolean | undefined;
		edits?: Record<string, any> | undefined;
		stageOnSave?: boolean;
	}>(),
	{ active: undefined, edits: undefined },
);

const emit = defineEmits<{
	(e: 'update:active', value: boolean): void;
	(e: 'input', value: Record<string, any>): void;
	(e: 'refresh'): void;
}>();

type APIError = { extensions?: { code?: string } & Record<string, unknown> };

type TranslationsFieldInfo = {
	field: string;
	creates: Record<string, any>[];
	junctionField: string;
	relatedPkField: string;
};

const { t } = useI18n();

const { collection } = toRefs(props);
const { primaryKeyField } = useCollection(collection);

const { internalEdits } = useEdits();
const { internalActive } = useActiveState();
const { save, cancel, saving, validationErrors } = useActions();
const { getTranslationsFields, saveBatchWithTranslations } = useTranslationsFields();

function useEdits() {
	const localEdits = ref<Record<string, any>>({});

	const internalEdits = computed<Record<string, any>>({
		get() {
			if (props.edits !== undefined) {
				return {
					...props.edits,
					...localEdits.value,
				};
			}

			return localEdits.value;
		},
		set(newEdits) {
			localEdits.value = newEdits;
		},
	});

	return { internalEdits };
}

function useActiveState() {
	const localActive = ref(false);

	const internalActive = computed({
		get() {
			return props.active === undefined ? localActive.value : props.active;
		},
		set(newActive: boolean) {
			localActive.value = newActive;
			emit('update:active', newActive);
		},
	});

	return { internalActive };
}

function useActions() {
	const saving = ref(false);
	const validationErrors = ref<any[]>([]);

	return { save, cancel, saving, validationErrors };

	async function save() {
		if (props.stageOnSave) {
			emit('input', internalEdits.value);
			internalActive.value = false;
			internalEdits.value = {};
			return;
		}

		saving.value = true;

		try {
			const translationsFields = getTranslationsFields(internalEdits.value);

			if (translationsFields.length === 0) {
				await sdk.request(
					requestEndpoint(getEndpoint(collection.value), {
						method: 'PATCH',
						body: {
							keys: props.primaryKeys,
							data: internalEdits.value,
						},
					}),
				);
			} else {
				await saveBatchWithTranslations(translationsFields);
			}

			emit('refresh');

			internalActive.value = false;
			internalEdits.value = {};
		} catch (error: any) {
			// Backoffice: the SDK rejects with the `errors` list itself (no axios response).
			const errors = error?.errors ?? error?.response?.data?.errors;

			if (!errors) {
				unexpectedError(error);
				return;
			}

			validationErrors.value = errors
				.filter((err: APIError) => VALIDATION_TYPES.includes(err?.extensions?.code ?? ''))
				.map((err: APIError) => {
					return err.extensions;
				});

			const otherErrors = errors.filter(
				(err: APIError) => VALIDATION_TYPES.includes(err?.extensions?.code ?? '') === false,
			);

			if (otherErrors.length > 0) {
				otherErrors.forEach(unexpectedError);
			}
		} finally {
			saving.value = false;
		}
	}

	function cancel() {
		internalActive.value = false;
		internalEdits.value = {};
	}
}

function useTranslationsFields() {
	const fieldsStore = useFieldsStore();
	const relationsStore = useRelationsStore();

	return { getTranslationsFields, saveBatchWithTranslations };

	function getTranslationsFields(edits: Record<string, any>): TranslationsFieldInfo[] {
		const results: TranslationsFieldInfo[] = [];

		for (const [key, value] of Object.entries(edits)) {
			// Batch mode form (primary-key="+") only produces `create` operations for relational fields.
			if (!isObject(value) || !('create' in value)) continue;

			const fieldInfo = fieldsStore.getField(collection.value, key);
			if (!fieldInfo?.meta?.special?.includes('translations')) continue;

			const relations = relationsStore.getRelationsForField(collection.value, key);
			const junctionRelation = relations.find((r) => r.meta?.one_field === key);
			const junctionField = junctionRelation?.meta?.junction_field;

			if (!junctionField) continue;

			const relatedCollection = relations.find((r) => r.field === junctionField)?.related_collection;

			const relatedPkField = relatedCollection
				? fieldsStore.getPrimaryKeyFieldForCollection(relatedCollection)?.field
				: null;

			if (!relatedPkField) continue;

			results.push({
				field: key,
				creates: (value as any).create as Record<string, any>[],
				junctionField,
				relatedPkField,
			});
		}

		return results;
	}

	async function saveBatchWithTranslations(translationsFields: TranslationsFieldInfo[]) {
		const otherEdits = omit(
			internalEdits.value,
			translationsFields.map((t) => t.field),
		);

		if (!primaryKeyField.value) {
			throw new Error(`No primary key field found for collection ${collection.value}`);
		}

		const pkField = primaryKeyField.value.field;
		const endpoint = getEndpoint(collection.value);

		const existingItems = await fetchAll<Record<string, any>>(endpoint, {
			params: {
				filter: { [pkField]: { _in: props.primaryKeys } },
				fields: [pkField, ...translationsFields.map((t) => `${t.field}.*`)],
			},
		});

		const itemMap = new Map(existingItems.map((item) => [item[pkField], item]));
		const resolveId = (val: unknown, field: string) => (isObject(val) ? (val as Record<string, any>)[field] : val);

		const payload = props.primaryKeys
			.filter((pk) => itemMap.has(pk))
			.map((pk) => {
				const item: Record<string, any> = { [pkField]: pk, ...otherEdits };

				for (const { field, creates, junctionField, relatedPkField } of translationsFields) {
					const merged = new Map(
						(itemMap.get(pk)![field] || []).map((row: Record<string, any>) => [
							resolveId(row[junctionField], relatedPkField),
							row,
						]),
					);

					for (const create of creates) {
						const id = resolveId(create[junctionField], relatedPkField);
						merged.set(id, { ...(merged.get(id) ?? {}), ...create });
					}

					item[field] = [...merged.values()];
				}

				return item;
			});

		await sdk.request(requestEndpoint(endpoint, { method: 'PATCH', body: payload }));
	}
}

defineExpose({ save, cancel });
</script>

<template>
	<BoDrawer
		v-model="internalActive"
		:title="t('editing_in_batch', { count: primaryKeys.length })"
		persistent
		@cancel="cancel"
		@apply="save"
	>
		<template #actions>
			<BoButton icon="check" :aria-label="t('save')" :loading="saving" @click="save" />
		</template>

		<BoForm
			v-model="internalEdits"
			:collection="collection"
			batch-mode
			primary-key="+"
			:validation-errors="validationErrors"
		/>
	</BoDrawer>
</template>
