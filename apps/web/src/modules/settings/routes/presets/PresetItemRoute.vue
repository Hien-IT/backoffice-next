<!-- Ported from directus/app/src/modules/settings/routes/presets/item.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US6-2, US6-3, recipe Q-26): the local form is BoForm with the DR fields (name, icon and
// color use the interfaces of the 014 BookmarkAdd dialog); the preview is the registry layout inside the read-only 014
// layout wrapper, in a bordered box; the layout options and the layout sidebar go to the detail panel. Header actions
// are named BoButtons and the confirmations BoDialogs; the unsaved-changes dialog puts "keep editing" first (D-76).
// Requests through the SDK; errors open the error dialog (showUnexpectedError, D-66). As DR, save always goes
// back to the list, also after an error (R-41).
import type { DeepPartial, Field, Filter, Preset } from '@directus/types';
import { isEqual } from 'lodash-es';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import BoButton from '../../../../components/BoButton.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoInfo from '../../../../components/BoInfo.vue';
import BoNotice from '../../../../components/BoNotice.vue';
import BoForm from '../../../../components/form/BoForm.vue';
import SidebarDetail from '../../../../components/sidebar/SidebarDetail.vue';
import { useEditsGuard } from '../../../../composables/use-edits-guard.ts';
import { showUnexpectedError as unexpectedError } from '../../../../composables/use-notices.ts';
import { useShortcut } from '../../../../composables/use-shortcut.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import { getLayout, getLayouts } from '../../../../layouts/index.ts';
import { useLayout } from '../../../../layouts/use-layout.ts';
import { useCollectionsStore } from '../../../../stores/collections.ts';
import { usePresetsStore } from '../../../../stores/presets.ts';
import { isSystemCollection } from '../../../../utils/get-item-route.ts';
import { translate } from '../../../../utils/translate-object-values.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';

type FormattedPreset = {
	id: number;
	scope: string;
	collection: string;
	layout: string | null;
	name: string | null;
	search: string | null;
	icon: string;
	layout_query: Record<string, any> | null;
	color?: string | null | undefined;
	layout_options: Record<string, any> | null;
	filter: Filter | null;
};

interface Props {
	id?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
	id: null,
});

const router = useRouter();

const collectionsStore = useCollectionsStore();
const presetsStore = usePresetsStore();
// Backoffice: the layouts of the registry (useExtensions in DR, names translated as its extensions store does).
const layouts = computed(() => getLayouts().map((layout) => ({ id: layout.id, name: translate(layout.name) })));

const isNew = computed(() => props.id === '+');

const { loading, preset } = usePreset();
const { fields } = useForm();
const { edits, hasEdits, initialValues, values, layoutQuery, layoutOptions, updateFilters, search } = useValues();
const { save, saving } = useSave();
const { deleting, deleteAndQuit, confirmDelete } = useDelete();

const layoutFilter = computed<any>({
	get() {
		return values.value['filter'] ?? null;
	},
	set(newFilters) {
		updateFilters(newFilters);
	},
});

const layout = computed(() => values.value['layout']);

const { layoutWrapper } = useLayout(layout);

// Backoffice: the registry layout rendered in the preview (DR `layout-${values.layout}`).
const currentLayout = computed(() => getLayout(values.value['layout']));

const layoutProps = computed(() => {
	if (values.value['layout'] === 'calendar') {
		return { height: 'auto' };
	}

	return undefined;
});

useShortcut('meta+s', () => {
	if (hasEdits.value) save();
});

const { confirmLeave, leaveTo } = useEditsGuard(hasEdits);

function useSave() {
	const saving = ref(false);

	return { saving, save };

	async function save() {
		saving.value = true;

		const editsParsed: Partial<Preset> = {};

		const keys = [
			'icon',
			'color',
			'collection',
			'layout',
			'layout_query',
			'layout_options',
			'filter',
			'search',
		] as (keyof Preset)[];

		if ('name' in edits.value) editsParsed.bookmark = edits.value['name'];

		for (const key of keys) {
			if (key in edits.value) (editsParsed as Record<string, unknown>)[key] = edits.value[key];
		}

		if (edits.value['scope']) {
			if (edits.value['scope'].startsWith('role_')) {
				editsParsed.role = edits.value['scope'].substring(5);
				editsParsed.user = null;
			} else if (edits.value['scope'].startsWith('user_')) {
				editsParsed.user = edits.value['scope'].substring(5);
				editsParsed.role = null;
			} else {
				editsParsed.role = null;
				editsParsed.user = null;
			}
		}

		try {
			if (isNew.value === true) {
				await sdk.request(requestEndpoint(`/presets`, { method: 'POST', body: editsParsed }));
			} else {
				await sdk.request(requestEndpoint(`/presets/${props.id}`, { method: 'PATCH', body: editsParsed }));
			}

			await presetsStore.hydrate();

			edits.value = {};
		} catch (error) {
			unexpectedError(error);
		} finally {
			saving.value = false;
			router.push({ name: 'settings-presets-collection' });
		}
	}
}

function useDelete() {
	const deleting = ref(false);
	const confirmDelete = ref(false);

	return { deleting, confirmDelete, deleteAndQuit };

	async function deleteAndQuit() {
		if (deleting.value) return;

		deleting.value = true;

		try {
			await presetsStore.delete([Number(props.id)]);
			edits.value = {};
			router.replace({ name: 'settings-presets-collection' });
		} catch (error) {
			unexpectedError(error);
		} finally {
			deleting.value = false;
		}
	}
}

function useValues() {
	const edits = ref<Record<string, any>>({});

	const hasEdits = computed(() => Object.keys(edits.value).length > 0);

	const initialValues = computed(() => {
		const defaultValues = {
			collection: null,
			layout: 'tabular',
			search: null,
			scope: 'all',
			layout_query: null,
			layout_options: null,
			filter: null,
		};

		if (isNew.value === true) return defaultValues;
		if (preset.value === null) return defaultValues;

		let scope = 'all';

		if (preset.value.user !== null) {
			scope = `user_${preset.value.user}`;
		} else if (preset.value.role !== null) {
			scope = `role_${preset.value.role}`;
		}

		const value: FormattedPreset = {
			id: preset.value.id!,
			collection: preset.value.collection,
			layout: preset.value.layout,
			name: preset.value.bookmark,
			icon: preset.value.icon,
			color: preset.value.color,
			search: preset.value.search,
			scope: scope,
			layout_query: preset.value.layout_query,
			layout_options: preset.value.layout_options,
			filter: preset.value.filter,
		};

		return value;
	});

	const values = computed<Record<string, any>>(() => {
		return {
			...initialValues.value,
			...edits.value,
		};
	});

	const layoutQuery = computed<any>({
		get() {
			if (!values.value['layout_query']) return null;
			if (!values.value['layout']) return null;

			return values.value['layout_query'][values.value['layout']];
		},
		set(newQuery) {
			if (
				values.value['layout_query'] &&
				values.value['layout'] &&
				isEqual(newQuery, values.value['layout_query'][values.value['layout']])
			) {
				return;
			}

			edits.value = {
				...edits.value,
				layout_query: {
					...edits.value['layout_query'],
					[values.value['layout'] || 'tabular']: newQuery,
				},
			};
		},
	});

	const layoutOptions = computed<any>({
		get() {
			if (!values.value['layout_options']) return null;
			if (!values.value['layout']) return null;

			return values.value['layout_options'][values.value['layout']];
		},
		set(newOptions) {
			if (
				values.value['layout_options'] &&
				values.value['layout'] &&
				isEqual(newOptions, values.value['layout_options'][values.value['layout']])
			) {
				return;
			}

			edits.value = {
				...edits.value,
				layout_options: {
					...edits.value['layout_options'],
					[values.value['layout'] || 'tabular']: newOptions,
				},
			};
		},
	});

	const search = computed<string | null>({
		get() {
			return values.value['search'];
		},
		set(newSearch) {
			edits.value = {
				...edits.value,
				search: newSearch,
			};
		},
	});

	return { edits, initialValues, values, layoutQuery, layoutOptions, hasEdits, updateFilters, search };

	function updateFilters(newFilter: Filter) {
		edits.value = {
			...edits.value,
			filter: newFilter,
		};
	}
}

function usePreset() {
	const loading = ref(false);
	const preset = ref<Preset | null>(null);

	fetchPreset();

	return { loading, preset, fetchPreset };

	async function fetchPreset() {
		if (props.id === '+') return;

		loading.value = true;

		try {
			preset.value = await sdk.request<Preset>(requestEndpoint(`/presets/${props.id}`));
		} catch (error) {
			unexpectedError(error);
		} finally {
			loading.value = false;
		}
	}
}

function useForm() {
	const systemCollectionWhiteList = ['directus_users', 'directus_files', 'directus_activity'];

	const fields = computed<DeepPartial<Field>[]>(() => [
		{
			field: 'meta-group',
			type: 'alias',
			meta: {
				field: 'meta-group',
				special: ['alias', 'no-data', 'group'],
				interface: 'group-raw',
			},
		},
		{
			field: 'name',
			name: '$t:name',
			type: 'string',
			meta: {
				interface: 'system-input-translated-string',
				options: {
					placeholder: '$t:preset_name_placeholder',
				},
				width: 'half',
				group: 'meta-group',
			},
		},
		{
			field: 'icon',
			name: '$t:icon',
			type: 'string',
			meta: {
				interface: 'select-icon',
				width: 'half',
				group: 'meta-group',
			},
			schema: {
				default_value: 'bookmark',
			},
		},
		{
			field: 'color',
			name: '$t:color',
			type: 'string',
			meta: {
				interface: 'select-color',
				width: 'half',
				group: 'meta-group',
			},
		},
		{
			field: 'collection',
			name: '$t:collection',
			type: 'string',
			meta: {
				interface: 'select-dropdown',
				options: {
					choices: collectionsStore.sortedCollections
						.map((collection) => ({
							text: collection.collection,
							value: collection.collection,
						}))
						.filter((option) => {
							if (isSystemCollection(option.value)) return systemCollectionWhiteList.includes(option.value);

							return true;
						}),
				},
				width: 'half',
			},
		},
		{
			field: 'scope',
			name: '$t:scope',
			type: 'string',
			meta: {
				interface: 'system-scope',
				width: 'half',
			},
		},
		{
			field: 'layout',
			name: '$t:layout',
			type: 'string',
			meta: {
				interface: 'select-dropdown',
				options: {
					choices: layouts.value.map((layout) => ({
						text: layout.name,
						value: layout.id,
					})),
				},
				width: 'half',
			},
		},

		{
			field: 'search',
			name: '$t:search',
			type: 'string',
			meta: {
				interface: 'input',
				width: 'half',
				options: {
					placeholder: '$t:search_items',
				},
			},
		},
		{
			field: 'filter',
			name: '$t:filter',
			type: 'json',
			meta: {
				interface: 'system-filter',
				options: {
					collectionField: 'collection',
					rawFieldNames: true,
				},
			},
		},
		{
			field: 'layout-divider',
			name: '$t:divider',
			type: 'alias',
			meta: {
				interface: 'presentation-divider',
				width: 'fill',
				options: {
					title: '$t:layout_preview',
					icon: 'visibility',
				},
			},
		},
	]);

	return { fields };
}

function discardAndLeave() {
	if (!leaveTo.value) return;
	edits.value = {};
	confirmLeave.value = false;
	router.push(leaveTo.value);
}
</script>

<template>
	<component
		:is="layoutWrapper"
		v-slot="{ layoutState }"
		v-model:layout-options="layoutOptions"
		v-model:layout-query="layoutQuery"
		:layout-props="layoutProps"
		:filter="layoutFilter"
		:search="search"
		:collection="values['collection']"
		readonly
	>
		<PrivateView
			:title="$t('editing_preset')"
			back="/settings/presets"
			:breadcrumb="[{ name: $t('settings_presets'), to: '/settings/presets' }]"
		>
			<template #navigation>
				<SettingsNavigation />
			</template>

			<template #actions>
				<BoButton
					variant="secondary"
					icon="delete"
					class="action-delete hover:bg-error-600 hover:text-white"
					:aria-label="$t('delete_label')"
					:title="$t('delete_label')"
					:disabled="preset === null || id === '+'"
					@click="confirmDelete = true"
				/>

				<BoButton
					icon="check"
					:aria-label="$t('save')"
					:title="$t('save')"
					:disabled="hasEdits === false"
					:loading="saving"
					@click="save"
				/>
			</template>

			<div class="preset-item max-w-5xl">
				<BoForm
					v-model="edits"
					card
					:fields="fields as Field[]"
					:loading="loading"
					:initial-values="initialValues"
					:primary-key="id ?? undefined"
				/>

				<div class="layout relative mt-7 w-full">
					<div
						v-if="currentLayout && values['collection']"
						class="min-h-96 rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
					>
						<component :is="currentLayout.component" v-bind="layoutState">
							<template #no-results>
								<BoInfo :title="$t('no_results')" icon="search">
									{{ $t('no_results_copy') }}
								</BoInfo>
							</template>

							<template #no-items>
								<BoInfo :title="$t('item_count', 0)">
									{{ $t('no_items_copy') }}
								</BoInfo>
							</template>
						</component>
					</div>

					<BoNotice v-else>
						{{ $t('no_layout_collection_selected_yet') }}
					</BoNotice>
				</div>
			</div>

			<template #sidebar>
				<component
					:is="currentLayout.slots.sidebar"
					v-if="currentLayout?.slots.sidebar && values['collection']"
					v-bind="layoutState"
				/>

				<SidebarDetail id="layout-options" icon="layers" :title="$t('layout_options')">
					<div class="layout-options flex flex-col gap-5">
						<component
							:is="currentLayout.slots.options"
							v-if="currentLayout?.slots.options && values['collection']"
							v-bind="layoutState"
						/>
					</div>
				</SidebarDetail>
			</template>

			<BoDialog v-model:open="confirmDelete" :title="$t('delete_are_you_sure')">
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
		</PrivateView>
	</component>
</template>
