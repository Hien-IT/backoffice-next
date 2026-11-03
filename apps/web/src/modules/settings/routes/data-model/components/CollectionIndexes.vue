<!-- Backoffice (spec 030, D-210.4, contracts/web.md): the Indexes card of a user collection, after the form cards of
the collection page (research R8). Lists the composite and trigram indexes Backoffice created (status creating / ready
/ failed, missing when the database lost it), adds one (fields in order, type, unique, without locking the table) and
deletes one. Hidden when the API is DR (GET 404). -->
<script setup lang="ts">
import type { Field } from '@directus/types';
import { computed, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../../../components/BoButton.vue';
import BoChip from '../../../../../components/BoChip.vue';
import BoDialog from '../../../../../components/BoDialog.vue';
import BoIcon from '../../../../../components/BoIcon.vue';
import BoNotice from '../../../../../components/BoNotice.vue';
import BoSelect, { type BoSelectItem } from '../../../../../components/BoSelect.vue';
import BoSortableList from '../../../../../components/BoSortableList.vue';
import BoSwitch from '../../../../../components/BoSwitch.vue';
import BoTable, { type BoTableColumn } from '../../../../../components/BoTable.vue';
import {
	type CollectionIndex,
	type IndexType,
	useCollectionIndexes,
} from '../../../../../composables/use-collection-indexes.ts';
import { translateAPIError } from '../../../../../lang/index.ts';
import { useFieldsStore } from '../../../../../stores/fields.ts';

const props = defineProps<{ collection: string }>();

const { t } = useI18n();
const id = useId();
const fieldsStore = useFieldsStore();
const { available, indexes, meta, loading, error, load, create, remove } = useCollectionIndexes(
	() => props.collection,
);

watch(() => props.collection, () => void load(), { immediate: true });

const columns = computed<BoTableColumn[]>(() => [
	{ key: 'name', label: t('index'), width: 280 },
	{ key: 'fields', label: t('field', 2), width: 220 },
	{ key: 'type', label: t('index_type'), width: 140 },
	{ key: 'unique', label: t('unique'), width: 100 },
	{ key: 'status', label: t('status'), width: 180 },
]);

const typeLabel = (type: IndexType) => (type === 'trigram' ? t('index_type_trigram') : t('index_type_btree'));

/* ------------------------------------------------------------------------------------------------------------ add */

const adding = ref(false);
const fields = ref<string[]>([]);
const type = ref<IndexType>('btree');
const unique = ref(false);
const concurrent = ref(true);
const busy = ref(false);
const addError = ref<unknown>(null);
const picked = ref<string | null>(null);

/** The real columns of the collection (no alias, no relational placeholder); strings only for a trigram index. */
const columnsOfCollection = computed<Field[]>(() =>
	fieldsStore
		.getFieldsForCollection(props.collection)
		.filter((field) => field.schema && field.type !== 'alias' && !field.meta?.special?.includes('no-data')),
);

const fieldItems = computed<BoSelectItem[]>(() =>
	columnsOfCollection.value
		.filter((field) => !fields.value.includes(field.field))
		.filter((field) => type.value !== 'trigram' || field.type === 'string' || field.type === 'text')
		.map((field) => ({ text: field.name ?? field.field, value: field.field })),
);

const typeItems = computed<BoSelectItem[]>(() => [
	{ text: t('index_type_btree'), value: 'btree' },
	...(meta.value.trigram ? [{ text: t('index_type_trigram'), value: 'trigram' }] : []),
]);

const labelOf = (field: string) => columnsOfCollection.value.find((f) => f.field === field)?.name ?? field;

function openAdd() {
	fields.value = [];
	type.value = 'btree';
	unique.value = false;
	concurrent.value = true;
	picked.value = null;
	addError.value = null;
	adding.value = true;
}

function pick(field: string) {
	if (!field) return;
	fields.value = type.value === 'trigram' ? [field] : [...fields.value, field];
	picked.value = null;
}

function setType(value: string) {
	type.value = value as IndexType;

	if (type.value === 'trigram') {
		unique.value = false;
		fields.value = fields.value.filter((f) => {
			const field = columnsOfCollection.value.find((c) => c.field === f);
			return field?.type === 'string' || field?.type === 'text';
		}).slice(0, 1);
	}
}

const canCreate = computed(() => fields.value.length > 0 && !busy.value);

async function submit() {
	if (!canCreate.value) return;
	busy.value = true;
	addError.value = null;

	try {
		await create({ fields: fields.value, type: type.value, unique: unique.value }, concurrent.value);
		adding.value = false;
	} catch (err) {
		addError.value = err;
	} finally {
		busy.value = false;
	}
}

/* --------------------------------------------------------------------------------------------------------- delete */

const deleting = ref<CollectionIndex | null>(null);
const deleteError = ref<unknown>(null);

function openDelete(row: CollectionIndex) {
	deleting.value = row;
	deleteError.value = null;
}

async function submitDelete() {
	if (!deleting.value) return;
	busy.value = true;

	try {
		await remove(deleting.value.name);
		deleting.value = null;
	} catch (err) {
		deleteError.value = err;
	} finally {
		busy.value = false;
	}
}

/** The API's reason (an INVALID_PAYLOAD of this route names the field and the rule), else the translated code. */
const errorText = (err: unknown) => {
	if (!err) return null;
	const e = err as { errors?: { extensions?: { reason?: string } }[]; response?: { data?: { errors?: { extensions?: { reason?: string } }[] } } };
	const reason = (e.errors ?? e.response?.data?.errors)?.[0]?.extensions?.reason;
	return reason ?? translateAPIError(err as never);
};
</script>

<template>
	<div
		v-if="available"
		class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]"
		data-testid="collection-indexes"
		:aria-labelledby="`${id}-title`"
		role="region"
	>
		<div class="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
			<div class="flex min-w-0 items-start gap-3">
				<BoIcon name="database" class="mt-0.5 text-gray-500 dark:text-gray-400" />
				<div class="min-w-0">
					<h3 :id="`${id}-title`" class="text-base font-medium text-gray-800 dark:text-white/90">
						{{ $t('indexes') }}
					</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ $t('indexes_description') }}</p>
				</div>
			</div>
			<BoButton size="sm" icon="add" :disabled="loading" @click="openAdd">{{ $t('add_index') }}</BoButton>
		</div>

		<div class="border-t border-gray-100 p-4 sm:p-6 dark:border-gray-800">
			<BoNotice v-if="error" type="danger" class="mb-4">{{ errorText(error) }}</BoNotice>
			<BoTable
				:columns="columns"
				:rows="indexes"
				row-key="name"
				:loading="loading && indexes.length === 0"
				:caption="$t('indexes')"
				:append-width="56"
			>
				<template #[`item.name`]="{ item }">
					<code class="text-theme-xs">{{ item.name }}</code>
				</template>
				<template #[`item.fields`]="{ item }">
					<span class="flex flex-wrap gap-1">
						<BoChip v-for="field in item.fields" :key="field" :text="labelOf(field)" size="sm" />
					</span>
				</template>
				<template #[`item.type`]="{ item }">{{ typeLabel(item.type) }}</template>
				<template #[`item.unique`]="{ item }">
					<BoIcon v-if="item.unique" name="check" :label="$t('unique')" />
					<span v-else aria-hidden="true">—</span>
				</template>
				<template #[`item.status`]="{ item }">
					<span v-if="item.status === 'creating'" class="inline-flex items-center gap-2">
						<BoIcon
							name="progress_activity"
							class="animate-spin text-brand-500 motion-reduce:animate-none"
							aria-hidden="true"
						/>
						{{ $t('index_status_creating') }}
					</span>
					<span v-else-if="item.status === 'failed'" class="text-error-500" :title="item.error ?? undefined">
						{{ $t('index_status_failed') }}<template v-if="item.error">: {{ item.error }}</template>
					</span>
					<span v-else-if="item.missing" class="inline-flex items-center gap-2">
						<BoChip :text="$t('index_missing')" size="sm" />
					</span>
					<span v-else>{{ $t('index_status_ready') }}</span>
				</template>
				<template #item-append="{ item }">
					<BoButton
						variant="ghost"
						size="sm"
						square
						icon="delete"
						:disabled="item.status === 'creating'"
						:aria-label="`${$t('delete_label')}: ${item.name}`"
						@click="openDelete(item as CollectionIndex)"
					/>
				</template>
				<template #empty>
					<div class="flex flex-col items-center gap-1 py-4 text-center">
						<BoIcon name="database" class="text-gray-500 dark:text-gray-400" />
						<p class="text-base font-medium text-gray-800 dark:text-white/90">{{ $t('indexes_empty') }}</p>
					</div>
				</template>
			</BoTable>
		</div>

		<BoDialog v-model:open="adding" :title="$t('add_index')">
			<form :id="`${id}-add`" class="flex flex-col gap-4" @submit.prevent="submit">
				<div>
					<BoSelect
						:model-value="picked"
						:items="fieldItems"
						:label="$t('field', 2)"
						:placeholder="$t('index_fields_add')"
						:disabled="type === 'trigram' && fields.length === 1"
						@update:model-value="pick"
					/>
					<BoSortableList
						v-if="fields.length > 0"
						v-model="fields"
						:item-key="(field: string) => field"
						:item-label="(field: string) => labelOf(field)"
						:row-actions="(field: string) => [{ text: $t('remove'), icon: 'close', onSelect: () => (fields = fields.filter((f) => f !== field)) }]"
						class="mt-3"
					>
						<template #item="{ element }">
							<span class="text-theme-sm text-gray-800 dark:text-white/90">{{ labelOf(element) }}</span>
							<code class="ml-2 text-theme-xs text-gray-500 dark:text-gray-400">{{ element }}</code>
						</template>
					</BoSortableList>
				</div>
				<BoSelect :model-value="type" :items="typeItems" :label="$t('index_type')" @update:model-value="setType" />
				<BoSwitch v-model="unique" :label="$t('index_unique_label')" :disabled="type === 'trigram'" />
				<BoSwitch v-if="meta.concurrent" v-model="concurrent" :label="$t('index_concurrent')" />
			</form>
			<BoNotice v-if="addError" type="danger" class="mt-4">{{ errorText(addError) }}</BoNotice>
			<template #actions>
				<BoButton variant="secondary" @click="adding = false">{{ $t('cancel') }}</BoButton>
				<BoButton type="submit" :form="`${id}-add`" :loading="busy" :disabled="!canCreate">{{ $t('create') }}</BoButton>
			</template>
		</BoDialog>

		<BoDialog
			:open="deleting !== null"
			:title="$t('index_delete_confirm', { name: deleting?.name ?? '' })"
			@update:open="!$event && (deleting = null)"
		>
			<BoNotice v-if="deleteError" type="danger" class="mt-4">{{ errorText(deleteError) }}</BoNotice>
			<template #actions>
				<BoButton variant="secondary" @click="deleting = null">{{ $t('cancel') }}</BoButton>
				<BoButton variant="danger" :loading="busy" @click="submitDelete">{{ $t('delete_label') }}</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
