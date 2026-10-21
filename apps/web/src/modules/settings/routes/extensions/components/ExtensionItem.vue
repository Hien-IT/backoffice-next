<!-- Ported from directus/app/src/modules/settings/routes/extensions/components/ExtensionItem.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-41): a bordered row per extension, the status as a text chip (not by color alone), bundle
// entries nested under the bundle; errors open the error dialog (showUnexpectedError, 014).
import type { ApiOutput, ExtensionType as ApiExtensionType } from '@directus/types';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';
import BoChip from '../../../../../components/BoChip.vue';
import BoIcon from '../../../../../components/BoIcon.vue';
import BoProgressCircular from '../../../../../components/BoProgressCircular.vue';
import { showUnexpectedError } from '../../../../../composables/use-notices.ts';
import { useExtensionsStore } from '../../../../../stores/extensions.ts';
import { extensionTypeIconMap } from '../constants.ts';
import type { ExtensionState } from '../types.ts';
import ExtensionItemOptions from './ExtensionItemOptions.vue';

const APP_OR_HYBRID_EXTENSION_TYPES: readonly string[] = [
	'interface',
	'display',
	'layout',
	'module',
	'panel',
	'theme',
	'operation',
];

const props = withDefaults(
	defineProps<{
		extension: ApiOutput;
		children?: ApiOutput[];
		/** Entry of a bundle that is not partial: no menu (Directus hides `.options` there). */
		hideOptions?: boolean;
	}>(),
	{
		children: () => [],
		hideOptions: false,
	},
);

const { t } = useI18n();

const extensionsStore = useExtensionsStore();

// Backoffice: the marketplace routes come with spec 020 wave 3 (T175); until then the name is plain text.
const hasMarketplace = useRouter().hasRoute('marketplace-extension');

const loading = ref(false);

const name = computed(() => props.extension.schema?.name ?? props.extension.meta.folder);
const type = computed(() => props.extension.schema?.type ?? 'missing');
const icon = computed(() => extensionTypeIconMap[type.value]);

const version = computed(() => {
	if (!props.extension.schema || !('version' in props.extension.schema) || !props.extension.schema.version) return null;
	return props.extension.schema.version;
});

const stateLocked = computed(() => {
	if (!import.meta.env.DEV) return false;

	if (props.extension.schema?.type === 'bundle')
		return props.children.some((extension) => isAppExtension(extension.schema?.type));

	return isAppExtension(props.extension.schema?.type);
});

const disabled = computed(() => {
	if (type.value === 'missing') return true;
	if (stateLocked.value) return false;
	return !props.extension.meta.enabled;
});

const isPartialAllowed = computed(() => {
	if (props.extension.schema?.type !== 'bundle') return false;
	return 'partial' in props.extension.schema && props.extension.schema.partial !== false;
});

const isPartiallyEnabled = computed(() => {
	if (props.extension.schema?.type !== 'bundle') return false;
	const enabledExtensionCount = props.children.filter((extension) => extension.meta.enabled);
	return enabledExtensionCount.length !== 0 && enabledExtensionCount.length !== props.children.length;
});

const state = computed<{ text: string; value: ExtensionState }>(() => {
	if (type.value === 'bundle' && isPartiallyEnabled.value) return { text: t('partially_enabled'), value: 'partial' };
	if (props.extension.meta.enabled) return { text: t('enabled'), value: 'enabled' };
	return { text: t('disabled'), value: 'disabled' };
});

const STATE_CLASSES: Record<ExtensionState, string> = {
	enabled: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400',
	disabled: 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400',
	partial: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
};

const requestHandler = (requestCallback: () => Promise<unknown>) => async () => {
	loading.value = true;

	try {
		await requestCallback();
	} catch (err) {
		showUnexpectedError(err);
	} finally {
		loading.value = false;
	}
};

const toggleState = requestHandler(() => extensionsStore.toggleState(props.extension.id));
const uninstall = requestHandler(() => extensionsStore.uninstall(props.extension.id));
const reinstall = requestHandler(() => extensionsStore.reinstall(props.extension.id));
const remove = requestHandler(() => extensionsStore.remove(props.extension.id));

function isAppExtension(type?: ApiExtensionType) {
	if (!type) return false;
	return APP_OR_HYBRID_EXTENSION_TYPES.includes(type);
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<li class="list-none">
		<div
			class="flex items-center gap-3 rounded-xl border border-gray-200 px-4 dark:border-gray-800"
			:class="[
				children.length === 0 && extension.bundle ? 'py-2' : 'py-3',
				disabled ? 'bg-gray-50 dark:bg-transparent' : 'bg-white dark:bg-white/[0.03]',
			]"
			:data-extension="name"
		>
			<BoIcon :name="icon" :title="t(`extension_${type}`)" class="text-gray-500 dark:text-gray-400" />
			<span class="flex min-w-0 flex-1 items-center gap-2 text-theme-sm font-medium">
				<RouterLink
					v-if="hasMarketplace && extension.meta.source === 'registry' && !extension.bundle"
					:to="{ name: 'marketplace-extension', params: { extensionId: extension.id } }"
					:title="t('open_in_marketplace')"
					class="truncate rounded underline-offset-2 hover:underline"
					:class="[FOCUS, disabled ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-white/90']"
				>
					{{ name }}
				</RouterLink>
				<span
					v-else
					class="truncate"
					:class="disabled ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-white/90'"
				>
					{{ name }}
				</span>
				<BoChip v-if="version" :text="version" size="sm" />
			</span>
			<BoProgressCircular v-if="loading" indeterminate :aria-label="t('loading')" />
			<span
				v-if="type !== 'missing'"
				class="inline-flex items-center rounded-full px-2.5 py-0.5 text-theme-xs font-medium"
				:class="STATE_CLASSES[state.value]"
			>
				{{ state.text }}
			</span>
			<ExtensionItemOptions
				v-if="!hideOptions"
				:extension
				:name
				:type
				:state="state.value"
				:state-locked
				@toggle-state="toggleState"
				@uninstall="uninstall"
				@reinstall="reinstall"
				@remove="remove"
			/>
		</div>
		<ul v-if="children.length > 0" class="m-0 ms-8 mt-2 space-y-2 p-0">
			<ExtensionItem v-for="item in children" :key="item.id" :extension="item" :hide-options="!isPartialAllowed" />
		</ul>
	</li>
</template>
