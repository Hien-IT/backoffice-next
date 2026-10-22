<!-- Ported from directus/app/src/modules/content/routes/item.vue -->
<script setup lang="ts">
// Backoffice: user story 2 of feature 014 (FR-050 to FR-062, FR-115c/d). No collaboration, AI tools or visual editing
// (D-70, Q1 = A): `discardAndStay` clears the edits. User story 5: versions (VersionMenu, save version), the detail
// panel (revisions, comments, shares, flows). Live preview (T047, FR-063 to FR-069): split or popup; storage keys
// `backoffice-live-preview-*` (D-39). Confirmations are BoDialog modals whose first
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
import BoMenu from '../../../components/BoMenu.vue';
import CommentsSidebarDetail from '../../../components/sidebar/CommentsSidebarDetail.vue';
import FlowSidebarDetail from '../../../components/sidebar/FlowSidebarDetail.vue';
import RevisionsSidebarDetail from '../../../components/sidebar/RevisionsSidebarDetail.vue';
import SharesSidebarDetail from '../../../components/sidebar/SharesSidebarDetail.vue';
import { useItemPermissions } from '../../../composables/use-permissions/index.ts';
import { useFlows } from '../../../composables/use-run-manual-flow.ts';
import { formColumnClass } from '../../../utils/form-column.ts';
import { translateShortcut } from '../../../composables/use-shortcut.ts';
import { useVersions } from '../../../composables/use-versions.ts';
import FlowDialogs from '../../../interfaces/presentation-header/FlowDialogs.vue';
import ContentNavigation from '../components/ContentNavigation.vue';
import VersionMenu from '../components/VersionMenu.vue';
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

const revisionsSidebarDetailRef = ref<InstanceType<typeof RevisionsSidebarDetail> | null>(null);

const { info: collectionInfo, defaults, primaryKeyField, isSingleton, accountabilityScope } = useCollection(collection);

const {
	readVersionsAllowed,
	currentVersion,
	versions,
	loading: versionsLoading,
	addVersion,
	updateVersion,
	deleteVersion,
	saveVersionLoading,
	saveVersion,
	validationErrors: versionValidationErrors,
} = useVersions(collection, isSingleton, primaryKey);

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
	validationErrors: itemValidationErrors,
} = useItem(collection, primaryKey, currentVersion);

const validationErrors = computed(() => {
	if (currentVersion.value === null) return itemValidationErrors.value;
	return versionValidationErrors.value;
});

const {
	collectionPermissions: { createAllowed, revisionsAllowed },
	itemPermissions: { updateAllowed, deleteAllowed, saveAllowed, archiveAllowed, shareAllowed, fields },
} = permissions;

const { templateData } = useTemplateData(collectionInfo, primaryKey);

// Backoffice (owner 2026-10-18): the form is centred, the page header keeps the full width (layout-patterns §5).
const formColumn = computed(() => formColumnClass(unref(fields)));

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

useShortcut(
	'meta+s',
	() => {
		if (unref(currentVersion) === null) {
			saveAndStay();
		} else {
			saveVersionAction('stay');
		}
	},
	form,
);

useShortcut(
	'meta+shift+s',
	() => {
		if (unref(currentVersion) === null) {
			saveAndAddNew();
		} else {
			saveVersionAction('quit');
		}
	},
	form,
);

useShortcut(
	'meta+alt+s',
	() => {
		if (unref(currentVersion) !== null) {
			saveVersionAction('main');
		}
	},
	form,
);

const isSavable = computed(() => {
	if (saveAllowed.value === false && currentVersion.value === null) return false;
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

const { updateAllowed: updateVersionsAllowed } = useItemPermissions(
	'directus_versions',
	computed(() => currentVersion.value?.id ?? null),
	computed(() => !currentVersion.value),
);

const isFormDisabled = computed(() => {
	if (isNew.value) return false;
	if (updateAllowed.value) return false;
	if (currentVersion.value !== null && updateVersionsAllowed.value) return false;
	return true;
});

const actualPrimaryKey = computed(() => {
	if (unref(isSingleton)) {
		const singleton = unref(item);
		const pkField = unref(primaryKeyField)?.field;
		return (singleton && pkField ? (singleton[pkField] ?? null) : null) as PrimaryKey | null;
	}

	return props.primaryKey;
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

watch(currentVersion, async () => {
	edits.value = {};
	await refreshLivePreview();
});

const previewTemplate = computed(() => collectionInfo.value?.meta?.preview_url ?? '');

const { templateData: previewData, fetchTemplateValues } = useTemplateData(collectionInfo, primaryKey, {
	template: previewTemplate,
	injectData: computed(() => ({ $version: currentVersion.value?.key ?? 'main' })),
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

watch(saveVersionLoading, async (newVal, oldVal) => {
	if (newVal === true || oldVal === false) return;

	await refreshLivePreview();
});

const { flowDialogsContext, manualFlows, provideRunManualFlow } = useFlows({
	collection,
	primaryKey: actualPrimaryKey,
	location: 'item',
	hasEdits,
	onRefreshCallback: refresh,
});

provideRunManualFlow();

const shouldShowVersioning = computed(
	() =>
		!!collectionInfo.value?.meta?.versioning &&
		!isNew.value &&
		internalPrimaryKey.value !== '+' &&
		readVersionsAllowed.value &&
		!versionsLoading.value,
);

const versionSaveOptions = computed(() => [
	{
		// Backoffice: BoMenu has no hint column; the shortcut follows the text.
		text: `${t('save_and_return_to_main')} (${translateShortcut(['meta', 'alt', 's'])})`,
		icon: 'check',
		onSelect: () => saveVersionAction('main'),
	},
	{
		text: `${t('save_and_quit')} (${translateShortcut(['meta', 'shift', 's'])})`,
		icon: 'done_all',
		onSelect: () => saveVersionAction('quit'),
	},
	{ text: t('discard_all_changes'), icon: 'undo', onSelect: discardAndStay },
]);

async function saveVersionAction(action: 'main' | 'stay' | 'quit') {
	if (isSavable.value === false) return;

	try {
		await saveVersion(edits, ref(item.value ?? {}), actualPrimaryKey.value);
		edits.value = {};

		if (action === 'main') {
			currentVersion.value = null;
			refresh();
		} else if (action === 'stay') {
			refresh();
			revisionsSidebarDetailRef.value?.refresh?.();
		} else if (action === 'quit') {
			if (!props.singleton) router.push({ name: 'content-collection', params: { collection: props.collection } });
		}
	} catch {
		// Save shows unexpected error dialog
	}
}

function revert(values: Record<string, any>) {
	edits.value = {
		...edits.value,
		...values,
	};
}

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
			revisionsSidebarDetailRef.value?.refresh?.();
			refresh();
		}
	} catch {
		// Save shows unexpected error dialog
	}
}

async function saveAndAddNew() {
	if (isSavable.value === false) return;
	if (unref(currentVersion) !== null) return;

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
		await router.replace(collectionRoute.value);
		// Backoffice: FR-115c, the list page title; after the closing dialog has returned focus (timeout of its scope).
		setTimeout(() => {
			const title = document.querySelector<HTMLElement>('main h1');
			title?.setAttribute('tabindex', '-1');
			title?.focus();
		});
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

	<!-- With live preview open the page is `fill` and the split takes its height, so the form and the preview scroll on
	     their own: private-view-main.vue:223-231, routes/item.vue:1064-1077. -->
	<PrivateView
		v-else
		:title="collectionInfo.meta?.singleton ? collectionInfo.name : title"
		:fill="livePreviewActive"
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

		<template v-if="shouldShowVersioning" #headline-append>
			<VersionMenu
				:collection="collection"
				:primary-key="internalPrimaryKey!"
				:update-allowed="updateAllowed"
				:has-edits="hasEdits"
				:current-version="currentVersion"
				:versions="versions"
				@add="addVersion"
				@update="updateVersion"
				@delete="deleteVersion"
				@switch="currentVersion = $event"
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

			<template v-if="!isNew && currentVersion === null && collectionInfo.meta?.singleton !== true">
				<BoButton
					variant="secondary"
					icon="delete"
					class="hover:bg-error-600 hover:text-white"
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

			<div v-if="currentVersion === null" class="flex items-center">
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

			<div v-else class="flex items-center">
				<BoButton
					icon="beenhere"
					:class="collectionInfo.meta?.singleton !== true && isSavable ? 'rounded-e-none' : ''"
					:aria-label="$t('save_version')"
					:title="$t('save_version')"
					:loading="saveVersionLoading"
					:disabled="!isSavable"
					@click="saveVersionAction('stay')"
				/>
				<BoMenu
					v-if="collectionInfo.meta?.singleton !== true && isSavable === true"
					:items="versionSaveOptions"
					align="end"
				>
					<template #trigger>
						<BoButton
							variant="secondary"
							icon="more_vert"
							class="rounded-s-none"
							:aria-label="$t('more_save_options')"
						/>
					</template>
				</BoMenu>
			</div>
		</template>

		<template #navigation>
			<ContentNavigation :current-collection="collection" />
		</template>

		<SplitPanel
			v-model:size="livePreviewSize"
			v-model:collapsed="livePreviewCollapsed"
			:class="{ 'min-h-0 flex-1': livePreviewActive }"
			:label="$t('live_preview.change_size')"
			:collapse-threshold="15"
			:min-size="livePreviewSizeMinSize"
			:max-size="isMobile || livePreviewFullWidth ? 100 : 80"
			:snap-points="[livePreviewSizeDefault]"
			:disabled="isMobile"
		>
			<template #start>
				<!-- Backoffice (D-82): the form stops at 64rem on wide screens, so `fill` fields do not run across the page;
				     centred (owner 2026-10-18, `formColumn`), in a card (D-150).
				     `fields` only, as Directus item.vue: with `collection` BoForm reads the fields store and drops the field
				     permissions (read-only fields, presets) that useItemPermissions puts on `fields` (016 T111). -->
				<BoForm
					ref="form"
					v-model="edits"
					card
					:class="formColumn"
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

		<FlowDialogs v-bind="flowDialogsContext" />

		<template #sidebar>
			<template v-if="isNew === false && actualPrimaryKey">
				<RevisionsSidebarDetail
					v-if="revisionsAllowed && accountabilityScope === 'all'"
					ref="revisionsSidebarDetailRef"
					:collection="collection"
					:primary-key="actualPrimaryKey"
					:version="currentVersion"
					@revert="revert"
				/>
				<CommentsSidebarDetail
					v-if="currentVersion === null"
					:collection="collection"
					:primary-key="actualPrimaryKey"
				/>
				<SharesSidebarDetail
					v-if="currentVersion === null"
					:collection="collection"
					:primary-key="actualPrimaryKey"
					:allowed="shareAllowed"
				/>
				<FlowSidebarDetail v-if="currentVersion === null" :manual-flows="manualFlows" />
			</template>
		</template>

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
				<!-- Backoffice: the non-discarding button first, it gets the initial focus (FR-115d). -->
				<BoButton @click="confirmLeave = false">{{ $t('keep_editing') }}</BoButton>
				<BoButton variant="secondary" @click="discardAndLeave">{{ $t('discard_changes') }}</BoButton>
			</template>
		</BoDialog>
	</PrivateView>
</template>
