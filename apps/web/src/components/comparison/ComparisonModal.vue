<!-- Ported from directus/app/src/views/private/components/comparison/comparison-modal.vue -->
<script setup lang="ts">
// Backoffice: no `collab` mode (D-68: no currentCollab, collabContext, `discard`/`collab_collision`). Recipe Q-10:
// Reka dialog `max-w-6xl` (BoDialog is fixed at 700px), "show differences only" Switch, `outdated` as a warning
// notice, and the "delete version after promote" Checkbox in the footer instead of the Directus keep/delete dialog
// (`promote` still emits `deleteOnPromote`). `updateAllowed` (no Directus prop: version-menu hides the entry) disables
// promoting without update permission on the main item (FR-072). The Apply hint of a disabled button is shown as text
// (a tooltip on a disabled button cannot be reached). Focus returns to the element that opened the modal.
import type { ContentVersion, PrimaryKey } from '@directus/types';
import { isEqual } from 'lodash-es';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { computed, ref, toRefs, unref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { showUnexpectedError } from '../../composables/use-notices.ts';
import type { Revision } from '../../types/revisions.ts';
import type { ContentVersionWithType } from '../../types/versions.ts';
import BoButton from '../BoButton.vue';
import BoCheckbox from '../BoCheckbox.vue';
import BoNotice from '../BoNotice.vue';
import BoSwitch from '../BoSwitch.vue';
import BoForm from '../form/BoForm.vue';
import ComparisonHeader from './ComparisonHeader.vue';
import ComparisonToggle from './ComparisonToggle.vue';
import { useComparison } from './use-comparison.ts';

interface Props {
	deleteVersionsAllowed: boolean;
	collection: string;
	primaryKey: PrimaryKey;
	mode: 'version' | 'revision';
	currentVersion: ContentVersionWithType | null | undefined;
	revisions?: Revision[] | null | undefined;
	updateAllowed?: boolean | undefined;
}

const props = withDefaults(defineProps<Props>(), { revisions: undefined, updateAllowed: true });
const active = defineModel<boolean>();
const currentRevision = defineModel<Revision | null>('currentRevision');

const emit = defineEmits<{
	cancel: [];
	promote: [deleteOnPromote: boolean];
	confirm: [data: Record<string, any>];
}>();

const { t } = useI18n();

const { deleteVersionsAllowed, collection, primaryKey, mode, currentVersion, revisions } = toRefs(props);

const compareToOption = ref<'Previous' | 'Latest'>('Previous');
const showDifferencesOnly = ref(false);
const deleteOnPromote = ref(false);

const {
	comparisonData,
	selectedComparisonFields,
	userUpdated,
	baseUserUpdated,
	mainHash,
	allFieldsSelected,
	someFieldsSelected,
	availableFieldsCount,
	comparisonFields,
	userLoading,
	baseUserLoading,
	baseDisplayName,
	deltaDisplayName,
	normalizedData,
	toggleSelectAll,
	toggleComparisonField,
	fetchComparisonData,
	fetchUserUpdated,
	fetchBaseItemUserUpdated,
	persistedCompareToOption,
	isFirstRevision,
	isLatestRevision,
} = useComparison({
	collection,
	primaryKey,
	mode,
	currentVersion,
	currentRevision,
	revisions,
	compareToOption,
});

const incomingTooltipMessage = computed(() => {
	if (props.mode === 'revision') return `${t('changes_made')} ${t('no_relational_data')}`;
	if (comparisonData.value?.outdated) return t('main_updated_notice');
	return undefined;
});

const baseDateUpdated = computed(() => {
	if (props.mode === 'revision' && compareToOption.value === 'Previous') {
		return normalizedData.value?.base.date.dateObject || null;
	}

	return t('latest');
});

const applyHint = computed(() => {
	if (mode.value === 'revision' && compareToOption.value === 'Previous') {
		return t('compare_to_latest_to_restore');
	}

	if (mode.value === 'revision' && compareToOption.value === 'Latest' && isLatestRevision.value) {
		return t('select_earlier_revision_to_restore');
	}

	return undefined;
});

const applyDisabled = computed(
	() =>
		selectedComparisonFields.value.length === 0 ||
		(mode.value === 'revision' && compareToOption.value === 'Previous') ||
		(mode.value === 'version' && !props.updateAllowed),
);

const { onPromoteClick, promoting } = usePromote();

const modalLoading = ref(false);

const hintId = useId();

async function loadComparisonData() {
	modalLoading.value = true;

	try {
		await fetchComparisonData();
		await fetchUserUpdated();
		await fetchBaseItemUserUpdated();
	} finally {
		modalLoading.value = false;
	}
}

// Backoffice: the element that opened the modal gets the focus back (Reka only restores it to a DialogTrigger).
let opener: HTMLElement | null = null;

watch(
	active,
	async (isActive, wasActive) => {
		if (!isActive) return;

		if (wasActive === undefined || wasActive === false) {
			opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			compareToOption.value = isFirstRevision.value ? 'Latest' : 'Previous';
			showDifferencesOnly.value = false;
			deleteOnPromote.value = false;
		}

		await loadComparisonData();
	},
	{ immediate: true },
);

watch(currentRevision, async () => {
	if (!active.value || mode.value !== 'revision') return;

	compareToOption.value = persistedCompareToOption.value;
	await loadComparisonData();
});

watch([compareToOption], async () => {
	if (props.mode !== 'revision' || !active.value) return;

	await loadComparisonData();
});

watch([isFirstRevision], () => {
	if (isFirstRevision.value && compareToOption.value === 'Previous') {
		compareToOption.value = 'Latest';
	}
});

function usePromote() {
	const promoting = ref(false);

	return { onPromoteClick, promoting, promote };

	function onPromoteClick() {
		if (applyDisabled.value) return;
		promote(deleteVersionsAllowed.value && deleteOnPromote.value);
	}

	async function promote(deleteOnPromote: boolean) {
		if (promoting.value) return;

		promoting.value = true;

		try {
			if (props.mode === 'version') {
				// Handle version promotion
				const versionId = (comparisonData.value!.selectableDeltas?.[0] as ContentVersion)?.id;

				if (versionId) {
					await sdk.request(
						requestEndpoint(`/versions/${versionId}/promote`, {
							method: 'POST',
							body:
								unref(selectedComparisonFields).length > 0
									? { mainHash: unref(mainHash), fields: unref(selectedComparisonFields) }
									: { mainHash: unref(mainHash) },
						}),
					);
				}

				emit('promote', deleteOnPromote);
			} else {
				const restoreData: Record<string, any> = {};
				const selectedFields = unref(selectedComparisonFields);

				// Get the delta from the comparison data
				const delta = comparisonData.value!.raw?.incoming ?? comparisonData.value!.incoming;
				const base = comparisonData.value!.raw?.base ?? comparisonData.value!.base;

				for (const [field, newValue] of Object.entries(delta)) {
					if (selectedFields.length > 0 && !selectedFields.includes(field)) continue;
					const previousValue = base[field] ?? null;
					if (isEqual(newValue, previousValue)) continue;
					restoreData[field] = newValue;
				}

				emit('confirm', restoreData);
				emit('cancel');
			}
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			promoting.value = false;
		}
	}
}

function onIncomingSelectionChange(newDeltaId: PrimaryKey) {
	if (props.mode !== 'revision') return;

	currentRevision.value = revisions.value?.find((revision) => revision.id === newDeltaId) ?? null;
}

function onOpenChange(open: boolean) {
	if (!open) emit('cancel');
}

function onCloseAutoFocus(event: Event) {
	event.preventDefault();
	opener?.focus();
}

const SKELETON = 'h-11 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-800';
</script>

<template>
	<DialogRoot :open="!!active" @update:open="onOpenChange">
		<DialogPortal>
			<DialogOverlay class="fixed inset-0 z-99999 bg-gray-900/40 backdrop-blur-[2px] dark:bg-gray-950/60" />
			<DialogContent
				class="fixed top-1/2 left-1/2 z-99999 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-white dark:bg-gray-900"
				:aria-describedby="undefined"
				data-comparison-modal
				@pointer-down-outside.prevent
				@interact-outside.prevent
				@close-auto-focus="onCloseAutoFocus"
				@keydown.meta.enter.prevent="onPromoteClick"
				@keydown.ctrl.enter.prevent="onPromoteClick"
			>
				<DialogTitle class="sr-only">
					{{ mode === 'version' ? $t('promote_version') : $t('item_revision') }}
				</DialogTitle>

				<div class="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
					<div v-if="mode === 'version' && comparisonData?.outdated && !modalLoading" class="px-6 pt-4">
						<BoNotice type="warning">{{ $t('main_updated_notice') }}</BoNotice>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2">
						<div class="min-w-0">
							<ComparisonHeader
								:loading="modalLoading"
								:mode="mode"
								:title="baseDisplayName"
								:date-updated="baseDateUpdated"
								:user-updated="baseUserUpdated"
								:user-loading="baseUserLoading"
							/>
							<div class="border-t border-gray-200 px-6 py-5 dark:border-gray-800">
								<div v-if="modalLoading" class="grid gap-5">
									<div v-for="n in 4" :key="n" :class="SKELETON" />
								</div>
								<BoForm
									v-else
									data-comparison-side="base"
									:collection="collection"
									:primary-key="primaryKey"
									:initial-values="comparisonData?.base || {}"
									:comparison="{
										side: 'base',
										fields: comparisonFields,
										revisionFields: comparisonData?.revisionFields,
										selectedFields: [],
										onToggleField: null,
										showDifferencesOnly,
									}"
									non-editable
								/>
							</div>
						</div>

						<div class="min-w-0 border-t border-gray-200 md:border-t-0 md:border-l dark:border-gray-800">
							<ComparisonHeader
								:loading="modalLoading"
								:mode="mode"
								:title="deltaDisplayName"
								:date-updated="normalizedData?.incoming.date.dateObject || null"
								:user-updated="userUpdated"
								:user-loading="userLoading"
								:show-delta-dropdown="mode === 'revision'"
								:comparison-data="comparisonData"
								:tooltip-message="incomingTooltipMessage"
								@delta-change="onIncomingSelectionChange"
							/>
							<div class="border-t border-gray-200 px-6 py-5 dark:border-gray-800">
								<div v-if="modalLoading" class="grid gap-5">
									<div v-for="n in 4" :key="n" :class="SKELETON" />
								</div>
								<BoForm
									v-else
									data-comparison-side="incoming"
									:collection="collection"
									:primary-key="primaryKey"
									:initial-values="comparisonData?.incoming || {}"
									:comparison="{
										side: 'incoming',
										fields: comparisonFields,
										revisionFields: comparisonData?.revisionFields,
										selectedFields: selectedComparisonFields,
										onToggleField: mode !== 'revision' || compareToOption !== 'Previous' ? toggleComparisonField : null,
										showDifferencesOnly,
									}"
									non-editable
								/>
							</div>
						</div>
					</div>
				</div>

				<div
					class="flex flex-col gap-4 border-t border-gray-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between dark:border-gray-800"
				>
					<div class="flex items-center gap-2 text-theme-sm font-semibold text-gray-700 dark:text-gray-400">
						<template v-if="mode !== 'revision'">
							<span class="text-gray-500 dark:text-gray-400" role="status">
								{{ $t('differences_count', availableFieldsCount) }}
							</span>
						</template>
						<template v-else>
							<span>{{ $t('comparing_to') }}</span>
							<ComparisonToggle v-model="compareToOption" :disable-previous="isFirstRevision" />
						</template>
					</div>

					<div class="flex flex-col gap-4 lg:flex-row lg:items-center">
						<BoSwitch
							v-if="availableFieldsCount > 0"
							v-model="showDifferencesOnly"
							:label="$t('show_differences_only')"
						/>
						<BoCheckbox
							v-if="availableFieldsCount > 0 && (mode !== 'revision' || compareToOption !== 'Previous')"
							:model-value="allFieldsSelected"
							:indeterminate="someFieldsSelected && !allFieldsSelected"
							@update:model-value="toggleSelectAll"
						>
							{{ $t('select_all_differences') }} ({{ selectedComparisonFields.length }}/{{ availableFieldsCount }})
						</BoCheckbox>
						<BoCheckbox
							v-if="mode === 'version' && deleteVersionsAllowed"
							v-model="deleteOnPromote"
							:label="$t('delete_version_after_promote', { version: deltaDisplayName })"
						/>
						<p v-if="applyHint" :id="hintId" class="text-theme-xs text-gray-500 dark:text-gray-400">
							{{ applyHint }}
						</p>
						<div class="flex gap-3">
							<BoButton variant="secondary" icon="close" @click="$emit('cancel')">{{ $t('cancel') }}</BoButton>
							<BoButton
								icon="arrow_upload_progress"
								data-test="comparison-modal_apply-button"
								:disabled="applyDisabled"
								:loading="promoting"
								:aria-describedby="applyHint ? hintId : undefined"
								@click="onPromoteClick"
							>
								{{ $t('apply') }}
							</BoButton>
						</div>
					</div>
				</div>
			</DialogContent>
		</DialogPortal>
	</DialogRoot>
</template>
