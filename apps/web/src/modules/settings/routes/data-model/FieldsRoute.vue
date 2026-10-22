<!-- Ported from directus/app/src/modules/settings/routes/data-model/fields/fields.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US2-1, FR-020): PrivateView with back to the data model and the breadcrumb, the delete
// collection button (not for system collections) and its BoDialog, the save button (PATCH /collections/:c with the
// edited `meta` keys, then back to the list), Ctrl/Cmd+S saves and stays, the field grid, the `field` named view of the
// field drawer, then BoForm `directus_collections` bound to `edits.meta`, locked for system collections. The unsaved
// changes dialog puts Keep Editing first (D-76). isSystemCollection is the `directus_` prefix (stores/collections.ts).
import formatTitle from '@directus/format-title';
import type { PrimaryKey } from '@directus/types';
import { computed, ref, toRefs, useTemplateRef } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import BoButton from '../../../../components/BoButton.vue';
import BoChip from '../../../../components/BoChip.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoForm from '../../../../components/form/BoForm.vue';
import { useEditsGuard } from '../../../../composables/use-edits-guard.ts';
import { useItem } from '../../../../composables/use-item/index.ts';
import { useShortcut } from '../../../../composables/use-shortcut.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import { useCollectionsStore } from '../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../stores/fields.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import FieldsManagement from './fields/FieldsManagement.vue';

const props = defineProps<{
	collection: string;
	// Field detail modal only
	field?: string | undefined;
	type?: string | undefined;
}>();

const router = useRouter();

const { collection } = toRefs(props);
const collectionsStore = useCollectionsStore();
const fieldsStore = useFieldsStore();

const { edits, item, saving, loading, save, remove, deleting } = useItem(
	ref('directus_collections'),
	collection as unknown as import('vue').Ref<PrimaryKey | null>,
);

const isSystem = computed(() => collection.value.startsWith('directus_'));

const hasEdits = computed<boolean>(() => {
	if (!edits.value['meta']) return false;
	return Object.keys(edits.value['meta']).length > 0;
});

const form = useTemplateRef<InstanceType<typeof BoForm>>('form');

useShortcut(
	'meta+s',
	() => {
		if (hasEdits.value) saveAndStay();
	},
	form as never,
);

const confirmDelete = ref(false);

const { confirmLeave, leaveTo } = useEditsGuard(hasEdits);

async function deleteAndQuit() {
	if (deleting.value) return;

	await remove();
	await Promise.all([collectionsStore.hydrate(), fieldsStore.hydrate()]);
	edits.value = {};
	router.replace({ name: 'settings-collections' });
}

async function saveAndStay() {
	await save();
	await Promise.all([collectionsStore.hydrate(), fieldsStore.hydrate()]);
}

async function saveAndQuit() {
	await save();
	await Promise.all([collectionsStore.hydrate(), fieldsStore.hydrate()]);
	router.push({ name: 'settings-collections' });
}

function discardAndLeave() {
	if (!leaveTo.value) return;
	edits.value = {};
	confirmLeave.value = false;
	router.push(leaveTo.value);
}

const meta = computed({
	get: () => (edits.value['meta'] ?? {}) as Record<string, unknown>,
	set: (value) => (edits.value = { ...edits.value, meta: value }),
});
</script>

<template>
	<PrivateView
		:title="formatTitle(collection)"
		back="/settings/data-model"
		:breadcrumb="[{ name: $t('settings_data_model'), to: '/settings/data-model' }]"
	>
		<template #actions>
			<BoButton
				v-if="isSystem === false"
				variant="secondary"
				icon="delete"
				class="hover:bg-error-600 hover:text-white"
				:aria-label="$t('delete_collection')"
				:title="$t('delete_collection')"
				:disabled="!item"
				@click="confirmDelete = true"
			/>

			<BoButton
				icon="check"
				:aria-label="$t('save')"
				:title="$t('save')"
				:loading="saving"
				:disabled="hasEdits === false"
				@click="saveAndQuit"
			/>
		</template>

		<template #navigation>
			<SettingsNavigation />
		</template>

		<div class="flex max-w-3xl flex-col gap-10">
			<section :aria-labelledby="`fields-${collection}`">
				<h2
					:id="`fields-${collection}`"
					class="m-0 mb-3 flex items-center gap-2 text-theme-sm font-medium text-gray-800 dark:text-white/90"
				>
					{{ $t('fields_and_layout') }}
					<BoChip :text="$t('saves_automatically')" size="sm" />
				</h2>
				<FieldsManagement :collection="collection" />
			</section>

			<RouterView name="field" :collection="collection" :field="field" :type="type" />

			<BoForm
				ref="form"
				v-model="meta"
				card
				collection="directus_collections"
				:loading="loading"
				:initial-values="(item?.['meta'] as Record<string, unknown> | undefined) ?? null"
				:primary-key="collection"
				:disabled="isSystem"
			/>
		</div>

		<BoDialog v-model:open="confirmDelete" :title="$t('delete_are_you_sure')">
			<template #actions>
				<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
				<BoButton variant="danger" :loading="deleting" @click="deleteAndQuit">{{ $t('delete_label') }}</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="confirmLeave" :title="$t('unsaved_changes')" :description="$t('unsaved_changes_copy')">
			<template #actions>
				<!-- Backoffice: the non-discarding button first, it gets the initial focus (D-76). -->
				<BoButton @click="confirmLeave = false">{{ $t('keep_editing') }}</BoButton>
				<BoButton variant="secondary" @click="discardAndLeave">{{ $t('discard_changes') }}</BoButton>
			</template>
		</BoDialog>
	</PrivateView>
</template>
