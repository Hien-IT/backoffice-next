<!-- Ported from directus/app/src/interfaces/_system/system-permissions/detail/permissions-detail.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US4-8, recipe Q-23): BoDrawer; the tab list (detail/components/tabs.vue, a dot when the tab has
// a value) and the tab content in one BoTabs, vertical from 1024px as the field drawer (Q-22); the save button of
// detail/components/actions.vue in the drawer actions. The tabs are PermissionsTab, FieldsTab, ValidationTab,
// PresetsTab (lint wants two-word names). `currentTabInfo` only fed the VDrawer sidebar label and is not ported.
import type { Permission, Policy, PrimaryKey } from '@directus/types';
import { useMediaQuery } from '@vueuse/core';
import { computed, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import BoButton from '../../../../components/BoButton.vue';
import BoTabs from '../../../../components/BoTabs.vue';
import BoDrawer from '../../../../components/drawers/BoDrawer.vue';
import { showUnexpectedError as unexpectedError } from '../../../../composables/use-notices.ts';
import { isPermissionEmpty } from '../../../../utils/is-permission-empty.ts';
import { appAccessMinimalPermissions } from '../app-permissions.ts';
import FieldsTab from './FieldsTab.vue';
import PermissionsTab from './PermissionsTab.vue';
import PresetsTab from './PresetsTab.vue';
import ValidationTab from './ValidationTab.vue';

const props = defineProps<{
	active: boolean;
	policyKey: PrimaryKey | null;
	permissionKey: PrimaryKey | null;
	policyEdits?: Record<string, any> | undefined;
	edits: Record<string, any>;
}>();

const emit = defineEmits<{
	input: [Permission | null];
	'update:active': [boolean];
}>();

const { permissionKey, policyKey } = toRefs(props);
const { t } = useI18n();

const { internalActive } = useActiveState();

const permission = ref<Permission | null>(null);
const policy = ref<Policy | null>(null);

const loading = ref(false);

const modalTitle = computed(() => {
	if (loading.value || !permission.value) return t('loading');

	if (props.policyKey) {
		return (
			(policy.value?.name ?? t('editing_policy')) +
			' -> ' +
			permission.value!.collection +
			' -> ' +
			t(permission.value.action)
		);
	}

	return t('public_label') + ' -> ' + permission.value!.collection + ' -> ' + t(permission.value.action);
});

watch([permissionKey, policyKey], load, { immediate: true });

const tabsValue = computed(() => {
	if (!permission.value) return [];

	const action = permission.value.action;

	const tabs: { label: string; value: string; hasValue: boolean }[] = [];

	if (['read', 'update', 'delete', 'share'].includes(action)) {
		tabs.push({
			label: t('item_permissions'),
			value: 'permissions',
			hasValue: permission.value.permissions !== null && Object.keys(permission.value.permissions).length > 0,
		});
	}

	if (['create', 'read', 'update'].includes(action)) {
		tabs.push({
			label: t('field_permissions'),
			value: 'fields',
			hasValue: permission.value.fields !== null,
		});
	}

	if (['create', 'update'].includes(action)) {
		tabs.push({
			label: t('field_validation'),
			value: 'validation',
			hasValue: permission.value.validation !== null && Object.keys(permission.value.validation).length > 0,
		});
	}

	if (['create', 'update'].includes(action)) {
		tabs.push({
			label: t('field_presets'),
			value: 'presets',
			hasValue: permission.value.presets !== null && Object.keys(permission.value.presets).length > 0,
		});
	}

	return tabs;
});

const currentTab = ref<string>('');

watch(
	tabsValue,
	(newTabs, oldTabs) => {
		if (newTabs && oldTabs && newTabs.length === oldTabs.length) return;
		currentTab.value = tabsValue.value?.[0]?.value ?? '';
	},
	{ immediate: true },
);

const appMinimal = computed(() => {
	if (!policy.value?.app_access) return null;

	const currentPermission = permission.value;

	if (!currentPermission) return null;

	return appAccessMinimalPermissions.find(
		(minimalPermission: Partial<Permission>) =>
			minimalPermission.collection === currentPermission.collection &&
			minimalPermission.action === currentPermission.action,
	);
});

function close() {
	internalActive.value = false;
	permission.value = null;
	policy.value = null;
}

async function load() {
	loading.value = true;

	try {
		if (props.policyKey !== null && props.policyKey !== '+') {
			const response = await sdk.request<Policy>(
				requestEndpoint(`/policies/${props.policyKey}`, {
					params: {
						deep: { users: { _limit: 0 } },
					},
				}),
			);

			policy.value = { ...response, ...props.policyEdits };
		} else {
			policy.value = { ...props.policyEdits } as Policy;
		}

		if (props.permissionKey !== null && props.permissionKey !== '+') {
			const response = await sdk.request<Permission>(requestEndpoint(`/permissions/${props.permissionKey}`));
			permission.value = { ...response, ...props.edits };
		} else if (props.permissionKey === '+') {
			permission.value = { ...props.edits } as Permission;
		}
	} catch (error: any) {
		unexpectedError(error);
	} finally {
		loading.value = false;
	}
}

function useActiveState() {
	const localActive = ref(false);

	const internalActive = computed({
		get() {
			return props.active ?? localActive.value;
		},
		set(newActive: boolean) {
			localActive.value = newActive;
			emit('update:active', newActive);
		},
	});

	return { internalActive };
}

function save() {
	if (permission.value && isPermissionEmpty(permission.value)) {
		emit('input', null);
	} else {
		emit('input', permission.value);
	}

	close();
}

const wide = useMediaQuery('(min-width: 1024px)');
</script>

<template>
	<BoDrawer
		v-model="internalActive"
		:title="modalTitle"
		icon="admin_panel_settings"
		class="new-collection"
		wide
		persistent
		@cancel="close"
		@apply="save"
	>
		<template v-if="!loading && permission" #actions>
			<BoButton icon="check" :aria-label="$t('save')" :title="$t('save')" @click="save" />
		</template>

		<div v-if="!loading && permission && policy" class="content p-6">
			<BoTabs
				v-model="currentTab"
				:items="tabsValue"
				:label="modalTitle"
				:orientation="wide ? 'vertical' : 'horizontal'"
			>
				<template #trigger="{ item }">
					<span class="text">{{ item.label }}</span>
					<span
						class="dot ms-auto size-1.5 shrink-0 rounded-full"
						:class="
							tabsValue.find((tab) => tab.value === item.value)?.hasValue
								? 'on bg-brand-500 dark:bg-brand-400'
								: 'bg-transparent'
						"
						aria-hidden="true"
					/>
				</template>
				<template #content="{ item }">
					<PermissionsTab
						v-if="item.value === 'permissions'"
						v-model:permission="permission"
						:policy="policy"
						:app-minimal="appMinimal?.permissions"
					/>
					<FieldsTab
						v-if="item.value === 'fields'"
						v-model:permission="permission"
						:policy="policy"
						:app-minimal="appMinimal?.fields"
					/>
					<ValidationTab
						v-if="item.value === 'validation'"
						v-model:permission="permission"
						:policy="policy"
						:app-minimal="appMinimal?.validation"
					/>
					<PresetsTab v-if="item.value === 'presets'" v-model:permission="permission" :policy="policy" />
				</template>
			</BoTabs>
		</div>
	</BoDrawer>
</template>
