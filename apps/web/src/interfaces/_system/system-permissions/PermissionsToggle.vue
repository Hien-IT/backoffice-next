<!-- Ported from directus/app/src/interfaces/_system/system-permissions/permissions-toggle.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-23): the chip is a menu button (BoMenu) showing the action, with the level as its accessible
// name and `title` (DR tooltip) and as an icon: all `check`, custom `rule`, none `block`; an app-minimal chip with
// full access is static with a `lock` icon. Menu items as DR: all_access, no_access (not for app-minimal), a
// divider, use_custom.
import type { Permission } from '@directus/types';
import { computed, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../../../components/BoMenu.vue';
import type { Collection } from '../../../stores/collections.ts';
import type { MatrixAction } from './app-permissions.ts';

const props = defineProps<{
	collection: Collection;
	action: MatrixAction;
	permission?: Permission | undefined;
	appMinimal?: Partial<Permission> | undefined;
	/** Backoffice (spec 025, FR-025): the cell is muted with this hint (the bo_show_* toggle is off); still editable. */
	mutedHint?: string | undefined;
}>();

const emit = defineEmits<{
	setFullAccess: [];
	setNoAccess: [];
	edit: [];
}>();

const { t } = useI18n();

const { permission } = toRefs(props);

const permissionLevel = computed<'all' | 'none' | 'custom'>(() => {
	if (permission.value === undefined) return 'none';

	if (
		permission.value.fields?.includes('*') &&
		Object.keys(permission.value.permissions || {}).length === 0 &&
		Object.keys(permission.value.validation || {}).length === 0 &&
		// Backoffice (spec 025, FR-026): an import or export limited to some formats is custom.
		!((permission.value as { options?: { formats?: string[] } | null }).options?.formats?.length ?? 0)
	) {
		return 'all';
	}

	return 'custom';
});

const appMinimalLevel = computed(() => {
	if (!props.appMinimal) return null;

	if (
		props.appMinimal.fields?.includes('*') &&
		Object.keys(props.appMinimal.permissions || {}).length === 0 &&
		Object.keys(props.appMinimal.validation || {}).length === 0
	)
		return 'full';

	return 'partial';
});

const tooltip = computed(
	() =>
		(props.appMinimal && t('required_for_app_access')) ||
		[t(`permissionsLevel.${permissionLevel.value}`, { action: t(props.action) }), props.mutedHint]
			.filter(Boolean)
			.join('. '),
);

const levelName = computed(() => t(`permissionsLevel.${permissionLevel.value}`, { action: t(props.action) }));

const menuItems = computed<BoMenuItem[]>(() =>
	[
		{
			text: t('all_access'),
			icon: 'check',
			disabled: permissionLevel.value === 'all',
			onSelect: () => emit('setFullAccess'),
		},
		...(!!appMinimalLevel.value === false
			? [
					{
						text: t('no_access'),
						icon: 'block',
						disabled: permissionLevel.value === 'none',
						onSelect: () => emit('setNoAccess'),
					},
				]
			: []),
		{ text: t('use_custom'), icon: 'rule', onSelect: () => emit('edit') },
	].map((item, index, items) => (index === items.length - 2 ? { ...item, divider: true } : item)),
);

const CHIP =
	'toggle inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-theme-xs font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const LEVEL = {
	all: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500',
	custom: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
	none: 'border border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
};
const LEVEL_ICON = { all: 'check', custom: 'rule', none: 'block' };
</script>

<template>
	<div :class="[{ 'has-app-minimal': !!appMinimal, 'muted opacity-50': !!mutedHint }, appMinimalLevel]">
		<span
			v-if="appMinimalLevel === 'full'"
			:class="[CHIP, LEVEL.all]"
			class="all cursor-default"
			:title="tooltip"
			role="img"
			:aria-label="`${$t(action)}: ${tooltip}`"
		>
			<BoIcon name="lock" size="sm" class="[font-size:0.875rem]!" />
			{{ $t(action) }}
		</span>

		<BoMenu v-else :items="menuItems">
			<template #trigger>
				<button
					type="button"
					:class="[CHIP, LEVEL[permissionLevel], permissionLevel]"
					class="cursor-pointer"
					:title="tooltip"
					:aria-label="appMinimal ? `${levelName} (${tooltip})` : levelName"
				>
					<BoIcon :name="appMinimal ? 'lock' : LEVEL_ICON[permissionLevel]" size="sm" class="[font-size:0.875rem]!" />
					{{ $t(action) }}
				</button>
			</template>
		</BoMenu>
	</div>
</template>
