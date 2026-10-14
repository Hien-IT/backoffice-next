<!-- Ported from directus/app/src/interfaces/collection-item-dropdown/collection-item-dropdown.vue -->
<script setup lang="ts">
// Backoffice: v-list-item is a field-styled row whose main control is a native button stretched over the row, the
// deselect button (v-remove, BoRemove) is a sibling; v-prevent-focusout is not needed (drawers are portals). unexpectedError
// has no snackbar before feature 018 (D-45): a failed load shows as a BoNotice in the field (spec Edge Cases), and a
// selectedCollection missing from the collections store (removed, or not readable) shows `relationship_not_setup`.
import type { Filter, Item } from '@directus/types';
import { getEndpoint, getFieldsFromTemplate } from '@directus/utils';
import { computed, inject, ref, toRefs, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import BoIcon from '../../components/BoIcon.vue';
import BoNotice from '../../components/BoNotice.vue';
import BoRemove from '../../components/BoRemove.vue';
import DrawerCollection from '../../components/drawers/DrawerCollection.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';

type Value = {
	key: (string | number) | null;
	collection: string;
};

const props = withDefaults(
	defineProps<{
		value?: Value | null;
		selectedCollection: string;
		template?: string | null;
		disabled?: boolean;
		nonEditable?: boolean;
		filter?: Filter | null;
	}>(),
	{
		value: () => ({ key: null, collection: '' }),
		template: null,
		filter: null,
	},
);

const emit = defineEmits(['input']);

const { t } = useI18n();

const a11y = inject(FORM_FIELD_A11Y, null);

const { selectedCollection, template } = toRefs(props);

const collectionsStore = useCollectionsStore();
const fieldStore = useFieldsStore();

const loading = ref(false);
const loadError = ref<string | null>(null);
const selectDrawerOpen = ref(false);
const displayItem = ref<Record<string, any> | null>(null);

const collectionExists = computed(() => !!collectionsStore.getCollection(unref(selectedCollection)));

const value = computed({
	get: () => props.value,
	set: (value) => {
		if (value && typeof value === 'object' && value.key) {
			emit('input', value);
		} else {
			emit('input', null);
		}
	},
});

const primaryKey = computed(() => fieldStore.getPrimaryKeyFieldForCollection(unref(selectedCollection))?.field ?? '');

const displayTemplate = computed(() => {
	if (unref(template)) return unref(template);

	const displayTemplate = collectionsStore.getCollection(unref(selectedCollection))?.meta?.display_template;

	return displayTemplate || `{{ ${primaryKey.value || ''} }}`;
});

const requiredFields = computed(() => {
	if (!displayTemplate.value || !unref(selectedCollection)) return [];
	return adjustFieldsForDisplays(getFieldsFromTemplate(displayTemplate.value), unref(selectedCollection));
});

watch(value, getDisplayItem, { immediate: true });

async function getDisplayItem() {
	if (!value.value || !value.value.key) {
		displayItem.value = null;
		return;
	}

	if (!unref(selectedCollection) || !primaryKey.value) return;

	const fields = new Set(requiredFields.value);
	fields.add(primaryKey.value);

	try {
		loading.value = true;
		loadError.value = null;

		const response = await sdk.request<Item[]>(
			requestEndpoint(getEndpoint(unref(selectedCollection)), {
				params: { fields: Array.from(fields), filter: { [primaryKey.value]: { _eq: value.value?.key } } },
			}),
		);

		displayItem.value = response?.[0] ?? null;
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn(error);
		loadError.value = translateAPIError(error as APIError);
	} finally {
		loading.value = false;
	}
}

function onSelection(selectedIds: (number | string)[] | null) {
	selectDrawerOpen.value = false;

	value.value = {
		key: Array.isArray(selectedIds) && selectedIds[0] ? selectedIds[0] : null,
		collection: unref(selectedCollection),
	};
}
</script>

<template>
	<BoNotice v-if="!collectionExists" type="warning">
		{{ t('relationship_not_setup') }}
	</BoNotice>

	<div v-else class="collection-item-dropdown space-y-2">
		<div
			v-if="loading"
			aria-busy="true"
			class="h-11 w-full animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5"
		>
			<span class="sr-only">{{ t('loading') }}</span>
		</div>

		<div
			v-else
			class="list-item relative flex min-h-11 w-full items-center gap-1 rounded-lg border py-1 ps-4 pe-2 text-sm shadow-theme-xs"
			:class="[
				disabled && !nonEditable
					? 'border-gray-100 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400'
					: 'border-gray-500 bg-transparent text-gray-800 dark:border-gray-500 dark:bg-gray-900 dark:text-white/90',
				{ 'border-error-600 dark:border-error-400': a11y?.invalid || loadError },
			]"
		>
			<button
				:id="a11y?.inputId"
				type="button"
				class="main min-w-0 flex-1 truncate text-start outline-hidden after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-500 disabled:cursor-not-allowed dark:focus-visible:after:outline-brand-400"
				:disabled
				:aria-labelledby="a11y ? `${a11y.labelId} ${a11y.inputId}` : undefined"
				:aria-describedby="a11y?.describedBy"
				:aria-invalid="a11y?.invalid || undefined"
				@click="selectDrawerOpen = true"
			>
				<span v-if="displayItem && displayTemplate" class="preview block truncate">
					<RenderTemplate :collection="selectedCollection" :item="displayItem" :template="displayTemplate" />
				</span>
				<span v-else class="placeholder text-gray-500 dark:text-gray-400">{{ t('select_an_item') }}</span>
			</button>

			<div v-if="!nonEditable" class="item-actions flex shrink-0 items-center">
				<BoRemove v-if="displayItem" class="remove relative z-1" deselect :disabled @action="value = null" />

				<BoIcon
					v-else
					class="expand pointer-events-none px-1.5 text-gray-500 dark:text-gray-400"
					name="expand_more"
					size="sm"
				/>
			</div>
		</div>

		<BoNotice v-if="loadError" type="danger">{{ loadError }}</BoNotice>

		<DrawerCollection
			v-model:active="selectDrawerOpen"
			:collection="selectedCollection"
			:selection="value?.key ? [value.key] : []"
			:filter="filter!"
			@input="onSelection"
			@update:active="selectDrawerOpen = false"
		/>
	</div>
</template>
