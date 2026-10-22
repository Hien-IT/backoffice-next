<!-- Ported from directus/app/src/modules/settings/routes/project/project.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US5-1, US5-2): PrivateView with the breadcrumb, a BoButton save, BoForm `directus_settings`
// without the theming, AI and MCP groups (D-93 for the last two), the unsaved changes dialog with Keep Editing first
// (D-76). Directus calls serverStore.hydrate({ isLanguageUpdated }), an argument its hydrate does not take: the
// server store reloads the same way here.
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

const EXCLUDED_GROUPS = ['theming_group', 'ai_group', 'mcp_group'] as const;

const fields = computed(() => {
	return allFields.value
		.map((field) => {
			if (
				field.field === 'collaborative_editing_enabled' &&
				(serverStore.info.websocket === false || serverStore.info.websocket?.['collaborativeEditing'] === false)
			) {
				return {
					...field,
					meta: {
						...field.meta,
						readonly: true,
					},
				} as any;
			}

			return field;
		})
		.filter((field) => {
			if (field.meta?.group) {
				return (EXCLUDED_GROUPS as readonly string[]).includes(field.meta?.group) === false;
			}

			return (EXCLUDED_GROUPS as readonly string[]).includes(field.field) === false;
		});
});

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
	<PrivateView :title="$t('settings_project')" icon="tune" :breadcrumb="[{ name: $t('settings'), to: '/settings' }]">
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
				card
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
