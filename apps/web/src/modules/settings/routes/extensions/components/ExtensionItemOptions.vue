<!-- Ported from directus/app/src/modules/settings/routes/extensions/components/extension-item-options.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-41): a BoMenu on a `more_vert` icon button. A disabled menu item cannot show a tooltip
// (Reka skips it), so the locked reasons (`enabled_dev_tooltip`, `uninstall_locked`) are its title attribute.
import type { ApiOutput } from '@directus/types';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoMenu, { type BoMenuItem } from '../../../../../components/BoMenu.vue';
import BoIcon from '../../../../../components/BoIcon.vue';
import type { ExtensionState, ExtensionType } from '../types.ts';

const props = defineProps<{
	extension: ApiOutput;
	name: string;
	type: ExtensionType;
	state: ExtensionState;
	stateLocked: boolean;
	loading?: boolean;
}>();

const emit = defineEmits<{ toggleState: [enabled: boolean]; uninstall: []; reinstall: []; remove: [] }>();

const { t } = useI18n();

const uninstallLocked = computed(() => props.extension.meta.source !== 'registry');

const stateActions = computed(() => {
	const enabled = props.state === 'enabled';
	if (props.type !== 'bundle') return [{ text: enabled ? t('disable') : t('enable'), enabled }];
	if (props.state !== 'partial') return [{ text: enabled ? t('disable_all') : t('enable_all'), enabled }];

	return [
		{ text: t('enable_all'), enabled: false },
		{ text: t('disable_all'), enabled: true },
	];
});

const items = computed<BoMenuItem[]>(() => {
	if (props.type === 'missing') {
		return [
			...(props.extension.meta.source === 'registry'
				? [{ text: t('reinstall'), icon: 'download', divider: true, onSelect: () => emit('reinstall') }]
				: []),
			{ text: t('remove'), icon: 'delete', onSelect: () => emit('remove') },
		];
	}

	const actions: BoMenuItem[] = stateActions.value.map((action, index) => ({
		text: action.text,
		icon: 'mode_off_on',
		disabled: props.stateLocked,
		divider: index === stateActions.value.length - 1 && !props.extension.bundle,
		onSelect: () => emit('toggleState', action.enabled),
	}));

	if (!props.extension.bundle) {
		actions.push({
			text: uninstallLocked.value ? `${t('uninstall')} (${t('uninstall_locked')})` : t('uninstall'),
			icon: 'delete',
			disabled: uninstallLocked.value,
			onSelect: () => emit('uninstall'),
		});
	}

	return actions;
});

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<BoMenu :items="items" align="end">
		<template #trigger>
			<button
				type="button"
				class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
				:class="FOCUS"
				:aria-label="t('item_options', { item: name })"
				:title="stateLocked ? t('enabled_dev_tooltip') : undefined"
			>
				<BoIcon name="more_vert" size="sm" />
			</button>
		</template>
	</BoMenu>
</template>
