<!-- Ported from directus/app/src/modules/settings/routes/data-model/collections/components/collection-dialog.vue -->
<script setup lang="ts">
// Backoffice: BoDialog (Cancel first, recipe Q-20 / Q-27) instead of v-dialog with an activator slot: the page opens it.
// The key is a db-safe BoInput (FR-007), disabled when editing; icon, color and the name translations use the 013
// interfaces as DR does. Errors go to the error dialog (D-66).
import type { DeepPartial, Field } from '@directus/types';
import { isEqual } from 'lodash-es';
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../../../../api/sdk.ts';
import BoButton from '../../../../../components/BoButton.vue';
import BoDialog from '../../../../../components/BoDialog.vue';
import BoInput from '../../../../../components/BoInput.vue';
import { showUnexpectedError } from '../../../../../composables/use-notices.ts';
import { getInterface } from '../../../../../interfaces/index.ts';
import InterfaceSelectColor from '../../../../../interfaces/select-color/SelectColor.vue';
import InterfaceSelectIcon from '../../../../../interfaces/select-icon/SelectIcon.vue';
import { type Collection, useCollectionsStore } from '../../../../../stores/collections.ts';

const props = defineProps<{ collection?: Collection | null | undefined }>();

const open = defineModel<boolean>('open', { default: false });

const { t } = useI18n();
// The list interface through the registry: importing InterfaceList.vue here first would start the BoForm ↔ registry
// import cycle from the wrong end.
const InterfaceList = getInterface('list')!.component;
const collectionsStore = useCollectionsStore();

const values = reactive({
	collection: props.collection?.collection ?? null,
	icon: props.collection?.icon ?? 'folder',
	note: props.collection?.meta?.note ?? null,
	color: props.collection?.color ?? null,
	translations: props.collection?.meta?.translations ?? null,
});

watch(open, (newValue, oldValue) => {
	if (isEqual(newValue, oldValue) === false) {
		values.collection = props.collection?.collection ?? null;
		values.icon = props.collection?.icon ?? 'folder';
		values.note = props.collection?.meta?.note ?? null;
		values.color = props.collection?.color ?? null;
		values.translations = props.collection?.meta?.translations ?? null;
	}
});

const saving = ref(false);

const translationFields: DeepPartial<Field>[] = [
	{
		field: 'language',
		name: t('language'),
		type: 'string',
		schema: { default_value: 'en-US' },
		meta: { interface: 'system-language', width: 'half' },
	},
	{
		field: 'translation',
		name: t('field_options.directus_collections.collection_name'),
		type: 'string',
		meta: {
			interface: 'input',
			width: 'half',
			options: { placeholder: '$t:field_options.directus_collections.translation_placeholder' },
		},
	},
];

async function save() {
	if (!values.collection || saving.value) return;

	saving.value = true;

	try {
		if (props.collection) {
			await sdk.request(
				requestEndpoint(`/collections/${props.collection.collection}`, { method: 'PATCH', body: { meta: { ...values } } }),
			);
		} else {
			await sdk.request(
				requestEndpoint('/collections', { method: 'POST', body: { collection: values.collection, meta: { ...values } } }),
			);
		}

		await collectionsStore.hydrate();
		open.value = false;
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<BoDialog v-model:open="open" :title="collection ? $t('edit_folder') : $t('create_folder')">
		<form id="collection-dialog-form" class="grid grid-cols-2 gap-3" @submit.prevent="save">
			<div class="col-span-2">
				<BoInput
					v-model="values.collection"
					class="font-mono"
					:aria-label="$t('folder_key')"
					:placeholder="$t('folder_key')"
					:disabled="!!collection"
					db-safe
					autofocus
				/>
			</div>
			<InterfaceSelectIcon width="half" :value="values.icon" @input="values.icon = $event" />
			<InterfaceSelectColor width="half" :value="values.color" @input="values.color = $event" />
			<div class="col-span-2">
				<BoInput v-model="values.note" :aria-label="$t('note')" :placeholder="$t('note')" />
			</div>
			<div class="col-span-2">
				<InterfaceList
					:value="values.translations"
					:placeholder="$t('no_translations')"
					template="{{ translation }} ({{ language }})"
					:fields="translationFields"
					@input="values.translations = $event as never"
				/>
			</div>
		</form>

		<template #actions>
			<BoButton variant="secondary" @click="open = false">{{ $t('cancel') }}</BoButton>
			<BoButton type="submit" form="collection-dialog-form" :disabled="!values.collection" :loading="saving">
				{{ $t('save') }}
			</BoButton>
		</template>
	</BoDialog>
</template>
