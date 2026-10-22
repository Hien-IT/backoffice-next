<!-- Ported from directus/app/src/modules/settings/routes/translations/item.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US6-5, FR-086): the header actions are BoButtons (delete, save with the SaveOptions split button
// of recipe Q-8) and the confirmations BoDialogs; the unsaved-changes dialog puts "keep editing" first (D-76). The form
// is BoForm on use-item of 014. A load error shows the module not-found page (ContentNotFound `settings`, the Directus
// settings not-found.vue). RevisionsSidebarDetail of 014 takes no `scope` prop.
import type { PrimaryKey } from '@directus/types';
import { computed, ref, toRefs, unref, type ComponentPublicInstance, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import BoButton from '../../../../components/BoButton.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoForm from '../../../../components/form/BoForm.vue';
import SaveOptions from '../../../../components/SaveOptions.vue';
import CommentsSidebarDetail from '../../../../components/sidebar/CommentsSidebarDetail.vue';
import RevisionsSidebarDetail from '../../../../components/sidebar/RevisionsSidebarDetail.vue';
import { useCollection } from '../../../../composables/use-collection.ts';
import { useEditsGuard } from '../../../../composables/use-edits-guard.ts';
import { useItem } from '../../../../composables/use-item/index.ts';
import { useShortcut } from '../../../../composables/use-shortcut.ts';
import { refreshCurrentLanguage } from '../../../../lang/refresh-current-language.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import ContentNotFound from '../../../content/routes/ContentNotFound.vue';
import SettingsNavigation from '../../components/SettingsNavigation.vue';

interface Props {
	primaryKey?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
	primaryKey: null,
});

const router = useRouter();

const form = ref<ComponentPublicInstance>();

const { primaryKey } = toRefs(props);
const { breadcrumb } = useBreadcrumb();

const revisionsSidebarDetailRef = ref<InstanceType<typeof RevisionsSidebarDetail> | null>(null);

const {
	info: collectionInfo,
	defaults,
	primaryKeyField,
	isSingleton,
	accountabilityScope,
} = useCollection('directus_translations');

const {
	isNew,
	edits,
	hasEdits,
	item,
	saving,
	loading,
	error,
	save,
	remove,
	deleting,
	saveAsCopy,
	refresh,
	validationErrors,
} = useItem(ref('directus_translations'), primaryKey as Ref<PrimaryKey | null>);

const isSavable = computed(() => {
	if (hasEdits.value === true) return true;

	if (!primaryKeyField.value?.schema?.has_auto_increment && !primaryKeyField.value?.meta?.special?.includes('uuid')) {
		return !!edits.value?.[primaryKeyField.value!.field];
	}

	if (isNew.value === true) {
		return Object.keys(defaults.value).length > 0 || hasEdits.value;
	}

	return hasEdits.value;
});

const { confirmLeave, leaveTo } = useEditsGuard(hasEdits);
const confirmDelete = ref(false);

useShortcut('meta+s', saveAndStay, form);
useShortcut('meta+shift+s', saveAndAddNew, form);

const internalPrimaryKey = computed(() => {
	if (unref(loading)) return '+';
	if (unref(isNew)) return '+';

	if (unref(isSingleton)) {
		const pkField = unref(primaryKeyField)?.field;

		if (pkField) {
			return unref(item)?.[pkField] ?? '+';
		} else {
			return '+';
		}
	}

	return props.primaryKey;
});

const disabledOptions = computed(() => {
	if (isNew.value) return ['save-as-copy'];
	return [];
});

function useBreadcrumb() {
	const breadcrumb = computed(() => [
		{
			name: collectionInfo.value?.name ?? '',
			to: `/settings/translations`,
		},
	]);

	return { breadcrumb };
}

async function saveAndQuit() {
	if (isSavable.value === false) return;

	try {
		await save();
		await refreshCurrentLanguage();
		router.push({ name: 'settings-translations-collection' });
	} catch {
		// Save shows unexpected error dialog
	}
}

async function saveAndStay() {
	if (isSavable.value === false) return;

	try {
		const savedItem: Record<string, any> = (await save()) ?? {};
		await refreshCurrentLanguage();

		revisionsSidebarDetailRef.value?.refresh?.();

		if (props.primaryKey === '+') {
			const newPrimaryKey = savedItem[primaryKeyField.value!.field];
			router.replace({ name: 'settings-translations-item', params: { primaryKey: encodeURIComponent(newPrimaryKey) } });
		}
	} catch {
		// Save shows unexpected error dialog
	}
}

async function saveAndAddNew() {
	if (isSavable.value === false) return;

	try {
		await save();
		await refreshCurrentLanguage();

		if (isNew.value === true) {
			refresh();
		} else {
			router.push({ name: 'settings-translations-item', params: { primaryKey: '+' } });
		}
	} catch {
		// Save shows unexpected error dialog
	}
}

async function saveAsCopyAndNavigate() {
	try {
		const newPrimaryKey = await saveAsCopy();
		if (newPrimaryKey)
			router.replace({
				name: 'settings-translations-item',
				params: { primaryKey: encodeURIComponent(newPrimaryKey) },
			});
	} catch {
		// Save shows unexpected error dialog
	}
}

async function deleteAndQuit() {
	if (deleting.value) return;

	try {
		await remove();
		await refreshCurrentLanguage();

		edits.value = {};
		router.replace({ name: 'settings-translations-collection' });
	} catch {
		// `remove` will show the unexpected error dialog
	}
}

function discardAndLeave() {
	if (!leaveTo.value) return;
	edits.value = {};
	confirmLeave.value = false;
	router.push(leaveTo.value);
}

function discardAndStay() {
	edits.value = {};
	confirmLeave.value = false;
}

async function revert(values: Record<string, any>) {
	edits.value = {
		...edits.value,
		...values,
	};

	await refreshCurrentLanguage();
}
</script>

<template>
	<ContentNotFound v-if="error" module="settings" />

	<PrivateView
		v-else
		:title="primaryKey === '+' ? $t('create_custom_translation') : $t('edit_custom_translation')"
		back="/settings/translations"
		:breadcrumb="
			collectionInfo?.meta && collectionInfo.meta.singleton === true
				? [{ name: $t('content'), to: '/content' }]
				: breadcrumb
		"
	>
		<template #actions>
			<BoButton
				v-if="!isNew && collectionInfo?.meta?.singleton === false"
				variant="secondary"
				icon="delete"
				class="action-delete hover:bg-error-600 hover:text-white"
				:aria-label="$t('delete_label')"
				:title="$t('delete_label')"
				:disabled="item === null"
				@click="confirmDelete = true"
			/>

			<div class="flex items-center">
				<BoButton
					icon="check"
					:class="hasEdits ? 'rounded-e-none' : ''"
					:aria-label="$t('save')"
					:title="$t('save')"
					:loading="saving"
					:disabled="!isSavable"
					@click="saveAndQuit"
				/>
				<SaveOptions
					v-if="hasEdits"
					:disabled-options="disabledOptions"
					@save-and-stay="saveAndStay"
					@save-and-add-new="saveAndAddNew"
					@save-as-copy="saveAsCopyAndNavigate"
					@discard-and-stay="discardAndStay"
				/>
			</div>
		</template>

		<template #navigation>
			<SettingsNavigation />
		</template>

		<div class="max-w-5xl">
			<BoForm
				ref="form"
				v-model="edits"
				card
				:autofocus="isNew"
				:loading="loading"
				:initial-values="item"
				collection="directus_translations"
				:primary-key="internalPrimaryKey ?? undefined"
				:validation-errors="validationErrors"
			/>
		</div>

		<BoDialog v-if="!isNew" v-model:open="confirmDelete" :title="$t('delete_are_you_sure')">
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

		<template #sidebar>
			<template v-if="isNew === false && loading === false && internalPrimaryKey">
				<RevisionsSidebarDetail
					v-if="accountabilityScope === 'all'"
					ref="revisionsSidebarDetailRef"
					collection="directus_translations"
					:primary-key="internalPrimaryKey"
					@revert="revert"
				/>
				<CommentsSidebarDetail collection="directus_translations" :primary-key="internalPrimaryKey" />
			</template>
		</template>
	</PrivateView>
</template>
