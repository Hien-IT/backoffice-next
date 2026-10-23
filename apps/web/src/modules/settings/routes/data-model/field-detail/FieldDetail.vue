<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail.vue; Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced-actions.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-22, spec 016 US3): BoDrawer (wide) with the simple mode (interface cards, a search in the header)
// or the advanced mode (tabs, a save icon button in the header: field-detail-advanced-actions.vue). D-97: a field that
// does not exist or a `?type=` that is not a local type shows the error dialog and goes back to the collection page
// (Directus breaks on them).
import formatTitle from '@directus/format-title';
import type { LocalType } from '@directus/types';
import { storeToRefs } from 'pinia';
import { computed, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import BoButton from '../../../../../components/BoButton.vue';
import BoDrawer from '../../../../../components/drawers/BoDrawer.vue';
import SearchInput from '../../../../../components/SearchInput.vue';
import { useDialogRoute } from '../../../../../composables/use-dialog-route.ts';
import { showUnexpectedError as unexpectedError } from '../../../../../composables/use-notices.ts';
import { useCollectionsStore } from '../../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../../stores/fields.ts';
import FieldDetailAdvanced from './advanced/FieldDetailAdvanced.vue';
import FieldDetailSimple from './simple/FieldDetailSimple.vue';
import { useFieldDetailStore } from './store/index.ts';

/** LOCAL_TYPES of @directus/constants (not a dependency of apps/web). */
const LOCAL_TYPES = ['standard', 'file', 'files', 'm2o', 'o2m', 'm2m', 'm2a', 'presentation', 'translations', 'group'];

const props = withDefaults(
	defineProps<{
		collection: string;
		field: string;
		type?: LocalType | null | undefined;
	}>(),
	{
		type: null,
	},
);

const { collection, field, type } = toRefs(props);

const search = ref<string | null>(null);

const isOpen = useDialogRoute();

const fieldDetail = useFieldDetailStore();

const { editing, saving, readyToSave } = storeToRefs(fieldDetail);

const collectionsStore = useCollectionsStore();
const fieldsStore = useFieldsStore();
const router = useRouter();
const { t } = useI18n();

watch(
	field,
	() => {
		const missingField = field.value !== '+' && !fieldsStore.getField(collection.value, field.value);
		const badType = !!type.value && !LOCAL_TYPES.includes(type.value);

		if (missingField || badType) {
			unexpectedError(
				new Error(missingField ? `Field "${field.value}" not found` : `Unknown field type "${type.value}"`),
			);
			router.replace({ name: 'settings-fields', params: { collection: collection.value } });
			return;
		}

		fieldDetail.startEditing(collection.value, field.value, type.value ?? undefined);
	},
	{ immediate: true },
);

const collectionInfo = computed(() => {
	return collectionsStore.getCollection(collection.value);
});

const simple = ref(props.type === null);

const title = computed(() => {
	const existingField = fieldsStore.getField(props.collection, props.field);
	const fieldName = formatTitle(existingField?.field || fieldDetail.field.field || '');

	if (props.field === '+' && fieldName === '') {
		return t('creating_new_field', { collection: collectionInfo.value?.collection });
	} else {
		return t('field_in_collection', { field: fieldName, collection: collectionInfo.value?.collection });
	}
});

const currentTab = ref('schema');

const showAdvanced = computed(() => {
	return editing.value !== '+' || !simple.value;
});

async function cancel() {
	await router.push({ name: 'settings-fields', params: { collection: props.collection } });
	fieldDetail.$reset();
}

async function save() {
	try {
		await fieldDetail.save();
	} catch (error) {
		unexpectedError(error);
		return;
	}

	router.push({ name: 'settings-fields', params: { collection: props.collection } });
	fieldDetail.$reset();
}
</script>

<template>
	<BoDrawer
		:model-value="isOpen"
		:title="title"
		icon="add"
		wide
		:flush="showAdvanced"
		persistent
		@cancel="cancel"
		@apply="save"
		@update:model-value="!$event && cancel()"
	>
		<template v-if="showAdvanced" #actions>
			<BoButton
				icon="check"
				:aria-label="$t('save')"
				:title="$t('save')"
				:disabled="readyToSave === false"
				:loading="saving"
				@click="save"
			/>
		</template>
		<template v-else #actions>
			<SearchInput v-model="search" :show-filter="false" autofocus :placeholder="$t('search_field')" />
		</template>

		<FieldDetailSimple
			v-if="!showAdvanced && collectionInfo"
			:collection="collectionInfo"
			:search="search"
			@save="save"
			@toggle-advanced="simple = false"
		/>

		<FieldDetailAdvanced v-if="showAdvanced" v-model:current-tab="currentTab" />
	</BoDrawer>
</template>
