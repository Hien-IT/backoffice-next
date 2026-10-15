<!-- Ported from directus/app/src/modules/content/routes/item.vue -->
<script setup lang="ts">
// Backoffice: user story 2 of feature 014 (FR-050 to FR-062, FR-115c/d). No collaboration, AI tools or visual editing
// (D-70, Q1 = A): `discardAndStay` clears the edits. Versions, revisions, comments, shares and flows of the sidebar are
// added by the tasks of user stories 4 and 5. Live preview (T047, FR-063 to FR-069): split or popup, the version key from
// `?version=` until useVersions; storage keys `backoffice-live-preview-*` (D-39). Confirmations are BoDialog modals whose first
// button is Cancel (focused on open, FR-115d). The tab title goes through PrivateView `tabTitle`.
import type { PrimaryKey } from '@directus/types';
import { sameOrigin } from '@directus/utils/browser';
import { useBreakpoints, useEventListener, useLocalStorage } from '@vueuse/core';
import {
	type ComponentPublicInstance,
	computed,
	nextTick,
	onBeforeUnmount,
	provide,
	ref,
	toRefs,
	unref,
	watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoForm from '../../../components/form/BoForm.vue';
import LivePreview from '../../../components/LivePreview.vue';
import RenderTemplate from '../../../components/render/RenderTemplate.vue';
import SaveOptions from '../../../components/SaveOptions.vue';
import SplitPanel from '../../../components/SplitPanel.vue';
import { useCollection } from '../../../composables/use-collection.ts';
import { useEditsGuard } from '../../../composables/use-edits-guard.ts';
import { useItem } from '../../../composables/use-item/index.ts';
import { useShortcut } from '../../../composables/use-shortcut.ts';
import { useTemplateData } from '../../../composables/use-template-data.ts';
import { BREAKPOINTS } from '../../../constants.ts';
import PrivateView from '../../../layout/PrivateView.vue';
import { useUserStore } from '../../../stores/user.ts';
import { getCollectionRoute, getItemRoute } from '../../../utils/get-item-route.ts';
import { renderStringTemplate } from '../../../utils/render-string-template.ts';
import ContentNavigation from '../components/ContentNavigation.vue';
import ContentNotFound from './ContentNotFound.vue';

interface Props {
	collection: string;
	primaryKey?: string | null;
	singleton?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	primaryKey: null,
	singleton: false,
});

const { t, te } = useI18n();

const router = useRouter();
const { collectionRoute, backRoute } = useItemNavigation();

const userStore = useUserStore();

const form = ref<ComponentPublicInstance>();

const { collection, primaryKey } = toRefs(props);
const { breadcrumb } = useBreadcrumb();

const { info: collectionInfo, defaults, primaryKeyField, isSingleton } = useCollection(collection);

const {
	isNew,
	edits,
	hasEdits,
	item,
	permissions,
	saving,
	loading,
	error,
	save,
	remove,
	deleting,
	archive,
	archiving,
	isArchived,
	saveAsCopy,
	refresh,
	validationErrors,
} = useItem(collection, primaryKey);

const {
	collectionPermissions: { createAllowed },
	itemPermissions: { updateAllowed, deleteAllowed, saveAllowed, archiveAllowed, fields },
} = permissions;

const { templateData } = useTemplateData(collectionInfo, primaryKey);

const route = useRoute();
const { confirmLeave, leaveTo } = useEditsGuard(hasEdits, { compareQuery: ['version'] });
const confirmDelete = ref(false);
const confirmArchive = ref(false);

const title = computed(() => {
	if (te(`collection_names_singular.${props.collection}`)) {
		return isNew.value
			? t('creating_unit', { unit: t(`collection_names_singular.${props.collection}`) })
			: t('editing_unit', { unit: t(`collection_names_singular.${props.collection}`) });
	}

	return isNew.value
		? t('creating_in', { collection: collectionInfo.value?.name })
		: t('editing_in', { collection: collectionInfo.value?.name });
});

const tabTitle = computed(() => {
	const tabTitle = (collectionInfo.value?.name || '') + ' | ';

	if (collectionInfo.value && collectionInfo.value.meta) {
		if (collectionInfo.value.meta.singleton === true) {
			return tabTitle + collectionInfo.value.name;
		} else if (isNew.value === false && collectionInfo.value.meta.display_template) {
			const { displayValue } = renderStringTemplate(collectionInfo.value.meta.display_template, templateData);

			if (displayValue.value !== undefined) return tabTitle + displayValue.value;
		}
	}

	return tabTitle + title.value;
});

const archiveTooltip = computed(() => {
	if (archiveAllowed.value === false) return t('not_allowed');
	if (isArchived.value === true) return t('unarchive');
	return t('archive');
});

useShortcut('meta+s', () => saveAndStay(), form);

useShortcut('meta+shift+s', () => saveAndAddNew(), form);

const isSavable = computed(() => {
	if (saveAllowed.value === false) return false;
	if (hasEdits.value === true) return true;

	if (
		primaryKeyField.value &&
		!primaryKeyField.value?.schema?.has_auto_increment &&
		!primaryKeyField.value?.meta?.special?.includes('uuid')
	) {
		return !!edits.value?.[primaryKeyField.value.field];
	}

	if (isNew.value === true) {
		return Object.keys(defaults.value).length > 0 || hasEdits.value;
	}

	return hasEdits.value;
});

const isFormDisabled = computed(() => {
	if (isNew.value) return false;
	if (updateAllowed.value) return false;
	return true;
});

const internalPrimaryKey = computed(() => {
	if (unref(loading)) return '+';
	if (unref(isNew)) return '+';

	if (unref(isSingleton)) {
		const singleton = unref(item);
		const pkField = unref(primaryKeyField)?.field;
		return (singleton && pkField ? (singleton[pkField] ?? '+') : '+') as PrimaryKey;
	}

	return props.primaryKey as PrimaryKey;
});

const disabledOptions = computed(() => {
	if (!createAllowed.value) return ['save-and-add-new', 'save-as-copy'];
	if (isNew.value) return ['save-as-copy'];
	return [];
});

const previewTemplate = computed(() => collectionInfo.value?.meta?.preview_url ?? '');
const versionKey = computed(() => (typeof route.query['version'] === 'string' ? route.query['version'] : null));

const { templateData: previewData, fetchTemplateValues } = useTemplateData(collectionInfo, primaryKey, {
	template: previewTemplate,
	injectData: computed(() => ({ $version: versionKey.value ?? 'main' })),
});

const previewUrl = computed(() => {
	const { displayValue } = renderStringTemplate(previewTemplate.value, previewData.value);

	if (!displayValue.value) return null;

	return displayValue.value.trim() || null;
});

const livePreviewFullWidth = useLocalStorage<boolean>('backoffice-live-preview-full-width', false);
const livePreviewMode = useLocalStorage<'split' | 'popup' | null>('backoffice-live-preview-mode', null);
const livePreviewSizeDefault = 50;
const livePreviewSizeStorage = useLocalStorage<number>('backoffice-live-preview-size', livePreviewSizeDefault);
const livePreviewEnforceDefault = ref(false);

const breakpoints = useBreakpoints(BREAKPOINTS);
const isMobile = breakpoints.smallerOrEqual('sm');
const livePreviewSizeMinSize = computed(() => (isMobile.value ? 0 : 20));

const livePreviewActive = computed(
	() => !!collectionInfo.value?.meta?.preview_url && !unref(isNew) && livePreviewMode.value === 'split',
);

const livePreviewCollapsed = computed({
	get() {
		return !livePreviewActive.value;
	},
	set(value: boolean) {
		if (!value) livePreviewEnforceDefault.value = true;
		livePreviewMode.value = value ? null : 'split';
	},
});

const livePreviewSize = computed({
	get() {
		if (isMobile.value || livePreviewFullWidth.value) {
			return livePreviewActive.value ? 100 : 0;
		}

		const storedValue = livePreviewSizeStorage.value || livePreviewSizeDefault;

		// Enforce default size when the preview is below the minimum size
		if (livePreviewEnforceDefault.value && storedValue <= livePreviewSizeMinSize.value) {
			return livePreviewSizeDefault;
		}

		return storedValue;
	},
	set(value: number) {
		if (isMobile.value) return;

		// Remove default size enforcement once the preview is larger than the minimum size
		if (livePreviewEnforceDefault.value && value > livePreviewSizeMinSize.value) {
			livePreviewEnforceDefault.value = false;
		}

		// Auto-toggle full-width based on drag position
		if (value >= 95 && !livePreviewFullWidth.value) {
			livePreviewFullWidth.value = true;
		} else if (value < 95 && livePreviewFullWidth.value) {
			livePreviewFullWidth.value = false;
		}

		livePreviewSizeStorage.value = value;
	},
});

provide('live-preview-active', livePreviewActive);

watch(previewUrl, (url) => {
	if (!url) livePreviewFullWidth.value = false;
});

let popupWindow: Window | null = null;

watch(
	[livePreviewMode, previewUrl],
	([mode, url]) => {
		if (mode !== 'popup' || !url) {
			if (popupWindow) popupWindow.close();
			return;
		}

		const targetUrl = new URL(window.location.href);
		targetUrl.pathname += targetUrl.pathname.endsWith('/') ? 'preview' : '/preview';

		popupWindow = window.open(
			targetUrl,
			'live-preview',
			'width=900,height=800,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes',
		);

		if (popupWindow) {
			const timer = setInterval(() => {
				if (!popupWindow?.closed) return;

				clearInterval(timer);
				popupWindow = null;

				if (livePreviewMode.value === 'popup') livePreviewMode.value = 'split';
			}, 1000);
		}
	},
	{ immediate: true },
);

useEventListener('message', (event: MessageEvent) => {
	if (!sameOrigin(event.origin, window.location.href)) return;
	if (event.source !== popupWindow) return;

	if (event.data === 'refresh') refresh();
});

async function refreshLivePreview() {
	try {
		await fetchTemplateValues();
		window.refreshLivePreview(previewUrl.value);
		if (popupWindow) (popupWindow as Window & typeof globalThis).refreshLivePreview(previewUrl.value);
	} catch {
		// noop
	}
}

watch(saving, async (newVal, oldVal) => {
	if (newVal === true || oldVal === false) return;

	await refreshLivePreview();
});

onBeforeUnmount(() => {
	if (popupWindow) popupWindow.close();
});

function useBreadcrumb() {
	const breadcrumb = computed(() => [
		{
			name: collectionInfo.value?.name ?? props.collection,
			to: collectionRoute.value,
		},
	]);

	return { breadcrumb };
}

/** Backoffice: focus the first form control after a new blank form shows (FR-115c). */
async function focusForm() {
	await nextTick();
	form.value?.$el?.querySelector?.('input, textarea, select, [contenteditable="true"], button')?.focus();
}

async function saveAndStay() {
	if (isSavable.value === false) return;

	try {
		const savedItem: Record<string, any> | undefined = await save();

		if (props.primaryKey === '+') {
			const newPrimaryKey = savedItem?.[primaryKeyField.value!.field];

			router.replace(getItemRoute(props.collection, newPrimaryKey));
		} else {
			refresh();
		}
	} catch {
		// Save shows unexpected error dialog
	}
}

async function saveAndAddNew() {
	if (isSavable.value === false) return;

	try {
		await save();

		if (isNew.value === true) {
			refresh();
			await focusForm();
		} else {
			await router.push(getItemRoute(props.collection, '+'));
			await focusForm();
		}
	} catch {
		// Save shows unexpected error dialog
	}
}

async function saveAsCopyAndNavigate() {
	try {
		const newPrimaryKey = await saveAsCopy();

		if (newPrimaryKey) router.replace(getItemRoute(props.collection, newPrimaryKey));
	} catch {
		// Save shows unexpected error dialog
	}
}

async function saveAndQuit() {
	if (isSavable.value === false) return;

	try {
		await save();
		if (props.singleton === false) router.push(collectionRoute.value);
	} catch {
		// Save shows unexpected error dialog
	}
}

async function deleteAndQuit() {
	if (deleting.value) return;

	try {
		await remove();
		edits.value = {};
		router.replace(collectionRoute.value);
	} catch {
		// `remove` will show the unexpected error dialog
	} finally {
		confirmDelete.value = false;
	}
}

async function toggleArchive() {
	if (archiving.value) return;

	try {
		await archive();

		if (isArchived.value === true) {
			router.push(collectionRoute.value);
		} else {
			confirmArchive.value = false;
		}
	} catch {
		// `archive` will show the unexpected error dialog
	}
}

function discardAndLeave() {
	if (!leaveTo.value) return;
	edits.value = {};
	confirmLeave.value = false;
	router.push(leaveTo.value);
}

function discardAndStay() {
	// Backoffice: no collaboration session to discard (D-70): the edits go back to the saved item.
	edits.value = {};
	confirmLeave.value = false;
}

function useItemNavigation() {
	const route = useRoute();

	const collectionRoute = computed(() => {
		const collectionPath = getCollectionRoute(props.collection);
		if (route.query['bookmark']) return `${collectionPath}?bookmark=${route.query['bookmark']}`;
		return collectionPath;
	});

	// If there's in-app navigation history, use browser back
	// Otherwise fall back to collection route
	const backRoute = computed(() => {
		if (history.state?.back) {
			return true as const;
		}

		return collectionRoute.value;
	});

	return { collectionRoute, backRoute };
}
</script>

<template>
	<ContentNotFound
		v-if="error || !collectionInfo || (collectionInfo?.meta?.singleton === true && primaryKey !== null)"
	/>

	<PrivateView
		v-else
		:title="collectionInfo.meta?.singleton ? collectionInfo.name : title"
		:tab-title="tabTitle"
		:back="collectionInfo.meta?.singleton ? undefined : backRoute"
		:icon="collectionInfo.meta?.singleton ? (collectionInfo.icon ?? undefined) : undefined"
		:breadcrumb="collectionInfo.meta?.singleton ? [{ name: $t('content'), to: '/content' }] : breadcrumb"
	>
		<template
			v-if="isNew === false && collectionInfo.meta?.singleton !== true && collectionInfo.meta?.display_template"
			#title
		>
			<span
				v-if="loading"
				class="inline-block h-6 w-48 animate-pulse rounded-lg bg-gray-100 align-middle motion-reduce:animate-none dark:bg-gray-800"
				:aria-label="$t('loading')"
			/>
			<RenderTemplate
				v-else
				:collection="collectionInfo.collection"
				:item="templateData ?? {}"
				:template="collectionInfo.meta.display_template"
			/>
		</template>

		<template #actions>
			<BoButton
				v-if="previewUrl"
				:variant="livePreviewMode === null ? 'secondary' : 'primary'"
				icon="visibility"
				:aria-label="$t(livePreviewMode === null ? 'live_preview.enable' : 'live_preview.disable')"
				:title="$t(livePreviewMode === null ? 'live_preview.enable' : 'live_preview.disable')"
				:aria-pressed="livePreviewMode !== null"
				@click="livePreviewCollapsed = !livePreviewCollapsed"
			/>

			<template v-if="!isNew && collectionInfo.meta?.singleton !== true">
				<BoButton
					variant="secondary"
					icon="delete"
					:aria-label="deleteAllowed ? $t('delete_label') : $t('not_allowed')"
					:title="deleteAllowed ? $t('delete_label') : $t('not_allowed')"
					:disabled="item === null || deleteAllowed !== true"
					@click="confirmDelete = true"
				/>

				<BoButton
					v-if="collectionInfo.meta?.archive_field"
					variant="secondary"
					:icon="isArchived ? 'unarchive' : 'archive'"
					:aria-label="archiveTooltip"
					:title="archiveTooltip"
					:disabled="item === null || archiveAllowed !== true"
					@click="confirmArchive = true"
				/>
			</template>

			<div class="flex items-center">
				<BoButton
					icon="check"
					:class="collectionInfo.meta?.singleton !== true && isSavable ? 'rounded-e-none' : ''"
					:aria-label="saveAllowed ? $t('save') : $t('not_allowed')"
					:title="saveAllowed ? $t('save') : $t('not_allowed')"
					:loading="saving"
					:disabled="!isSavable"
					@click="saveAndQuit"
				/>
				<SaveOptions
					v-if="collectionInfo.meta?.singleton !== true && isSavable === true"
					:disabled-options="disabledOptions"
					@save-and-stay="saveAndStay"
					@save-and-add-new="saveAndAddNew"
					@save-as-copy="saveAsCopyAndNavigate"
					@discard-and-stay="discardAndStay"
				/>
			</div>
		</template>

		<template #navigation>
			<ContentNavigation :current-collection="collection" />
		</template>

		<SplitPanel
			v-model:size="livePreviewSize"
			v-model:collapsed="livePreviewCollapsed"
			:label="$t('live_preview.change_size')"
			:collapse-threshold="15"
			:min-size="livePreviewSizeMinSize"
			:max-size="isMobile || livePreviewFullWidth ? 100 : 80"
			:snap-points="[livePreviewSizeDefault]"
			:disabled="isMobile"
		>
			<template #start>
				<BoForm
					ref="form"
					v-model="edits"
					:collection="collection"
					:autofocus="isNew"
					:disabled="isFormDisabled"
					:loading="loading"
					:initial-values="item"
					:fields="fields"
					:primary-key="internalPrimaryKey"
					:validation-errors="validationErrors"
					:direction="userStore.textDirection"
				/>
			</template>

			<template #end>
				<LivePreview
					v-if="livePreviewActive && previewUrl"
					:url="previewUrl"
					:is-full-width="livePreviewFullWidth"
					:display-options="[
						{ text: $t('full_width'), icon: 'width_full', onSelect: () => (livePreviewFullWidth = true) },
					]"
					@new-window="livePreviewMode = 'popup'"
					@exit-full-width="livePreviewFullWidth = false"
				/>
			</template>
		</SplitPanel>

		<BoDialog v-model:open="confirmDelete" :title="$t('delete_are_you_sure')">
			<template #actions>
				<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
				<BoButton variant="danger" :loading="deleting" @click="deleteAndQuit">{{ $t('delete_label') }}</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="confirmArchive" :title="isArchived ? $t('unarchive_confirm') : $t('archive_confirm')">
			<template #actions>
				<BoButton variant="secondary" @click="confirmArchive = false">{{ $t('cancel') }}</BoButton>
				<BoButton :loading="archiving" @click="toggleArchive">
					{{ isArchived ? $t('unarchive') : $t('archive') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="confirmLeave" :title="$t('unsaved_changes')" :description="$t('unsaved_changes_copy')">
			<template #actions>
				<BoButton variant="secondary" @click="discardAndLeave">{{ $t('discard_changes') }}</BoButton>
				<BoButton @click="confirmLeave = false">{{ $t('keep_editing') }}</BoButton>
			</template>
		</BoDialog>
	</PrivateView>
</template>
