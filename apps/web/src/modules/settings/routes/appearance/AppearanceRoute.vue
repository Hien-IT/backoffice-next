<!-- Ported from directus/app/src/modules/settings/routes/appearance/item.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US5-5): as ProjectRoute, with the fields of `theming_group` only.
import { clone } from 'lodash-es';
import { computed, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import BoButton from '../../../../components/BoButton.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoForm from '../../../../components/form/BoForm.vue';
import { useCollection } from '../../../../composables/use-collection.ts';
import { useEditsGuard } from '../../../../composables/use-edits-guard.ts';
import { useShortcut } from '../../../../composables/use-shortcut.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import { useServerStore } from '../../../../stores/server.ts';
import { useSettingsStore } from '../../../../stores/settings.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';

const router = useRouter();

const settingsStore = useSettingsStore();
const serverStore = useServerStore();

const { fields: allFields } = useCollection('directus_settings');

const fields = computed(() =>
	allFields.value.filter((field) => field.meta?.group === 'theming_group' || field.field === 'theming_group'),
);

const initialValues = ref(clone(settingsStore.settings));

const edits = ref<{ [key: string]: any } | null>(null);

const hasEdits = computed(() => edits.value !== null && Object.keys(edits.value).length > 0);

const saving = ref(false);

const form = useTemplateRef<InstanceType<typeof BoForm>>('form');

useShortcut(
	'meta+s',
	() => {
		if (hasEdits.value) save();
	},
	form as never,
);

const { confirmLeave, leaveTo } = useEditsGuard(hasEdits);

async function save() {
	if (edits.value === null) return;
	saving.value = true;
	await settingsStore.updateSettings(edits.value);
	await serverStore.hydrate();
	edits.value = null;
	saving.value = false;
	initialValues.value = clone(settingsStore.settings);
}

function discardAndLeave() {
	if (!leaveTo.value) return;
	edits.value = {};
	confirmLeave.value = false;
	router.push(leaveTo.value);
}
</script>

<template>
	<PrivateView
		:title="$t('settings_appearance')"
		icon="palette"
		:breadcrumb="[{ name: $t('settings'), to: '/settings' }]"
	>
		<template #actions>
			<BoButton
				icon="check"
				:aria-label="$t('save')"
				:title="$t('save')"
				:disabled="!hasEdits"
				:loading="saving"
				@click="save"
			/>
		</template>

		<template #navigation>
			<SettingsNavigation />
		</template>

		<div class="settings max-w-5xl">
			<BoForm
				ref="form"
				:model-value="edits ?? {}"
				:initial-values="initialValues"
				:fields="fields"
				:primary-key="1"
				@update:model-value="edits = $event"
			/>
		</div>

		<BoDialog v-model:open="confirmLeave" :title="$t('unsaved_changes')" :description="$t('unsaved_changes_copy')">
			<template #actions>
				<!-- Backoffice: the non-discarding button first, it gets the initial focus (D-76). -->
				<BoButton @click="confirmLeave = false">{{ $t('keep_editing') }}</BoButton>
				<BoButton variant="secondary" @click="discardAndLeave">{{ $t('discard_changes') }}</BoButton>
			</template>
		</BoDialog>
	</PrivateView>
</template>
