<!-- Ported from directus/app/src/interfaces/files/files.vue -->
<script setup lang="ts">
// Backoffice: the draggable v-list is BoSortableList (SortableList row menu recipe, D-60): the row menu holds the
// Directus items (open in a new tab, download) and "Move up" / "Move down", which emit the same order as a drag and
// go through sortItems. The row is a button that opens the drawer; deselect/remove sits next to it. v-pagination is
// the previous / next pair of DrawerCollection. The menu download item opens the `?download` URL in a new tab (BoMenu
// links), so the server names the file.
import type { ContentVersion, Filter } from '@directus/types';
import { deepMap, getFieldsFromTemplate } from '@directus/utils';
import { clamp, get, isEmpty, isNil, set } from 'lodash-es';
import { render } from 'micromustache';
import { computed, inject, ref, toRef, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../components/BoButton.vue';
import BoDialog from '../../components/BoDialog.vue';
import BoIcon from '../../components/BoIcon.vue';
import type { BoMenuItem } from '../../components/BoMenu.vue';
import BoNotice from '../../components/BoNotice.vue';
import BoSortableList from '../../components/BoSortableList.vue';
import DrawerFiles from '../../components/drawers/DrawerFiles.vue';
import DrawerItem from '../../components/drawers/DrawerItem.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import { parseFilter } from '../../components/form/utils/parse-filter.ts';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import { useMimeTypeFilter } from '../../composables/use-mime-type-filter.ts';
import { useRelationM2M } from '../../composables/use-relation-m2m.ts';
import {
	type DisplayItem,
	type RelationQueryMultiple,
	useRelationMultiple,
} from '../../composables/use-relation-multiple.ts';
import { useRelationPermissionsM2M } from '../../composables/use-relation-permissions.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import ItemRemove from '../file/ItemRemove.vue';

const props = withDefaults(
	defineProps<{
		value: (number | string | Record<string, any>)[] | Record<string, any> | null;
		primaryKey: string | number;
		collection: string;
		field: string;
		disabled?: boolean;
		nonEditable?: boolean;
		version?: ContentVersion | null;
		template?: string | null;
		enableCreate?: boolean;
		enableSelect?: boolean;
		folder?: string | undefined;
		filter?: Filter | undefined;
		showNavigation?: boolean;
		limit?: number;
		allowedMimeTypes?: string[] | undefined;
	}>(),
	{
		disabled: false,
		nonEditable: false,
		version: null,
		template: null,
		enableCreate: true,
		enableSelect: true,
		folder: undefined,
		filter: undefined,
		limit: 15,
		allowedMimeTypes: undefined,
	},
);

defineOptions({ name: 'InterfaceFiles' });

const emit = defineEmits<{
	input: [value: (number | string | Record<string, any>)[] | Record<string, any> | null];
}>();

const { t } = useI18n();

const a11y = inject(FORM_FIELD_A11Y, null);

const { collection, field, primaryKey, limit, version } = toRefs(props);
const { relationInfo } = useRelationM2M(collection, field);

const value = computed({
	get: () => props.value,
	set: (val) => {
		emit('input', val);
	},
});

const { mimeTypeFilter, combinedAcceptString } = useMimeTypeFilter(toRef(props, 'allowedMimeTypes'));

const templateWithDefaults = computed(() => {
	if (!relationInfo.value) return null;

	if (props.template) return props.template;

	if (relationInfo.value.junctionCollection.meta?.display_template) {
		return relationInfo.value.junctionCollection.meta?.display_template;
	}

	let relatedDisplayTemplate = relationInfo.value.relatedCollection.meta?.display_template;

	if (relatedDisplayTemplate) {
		const regex = /({{.*?}})/g;
		const parts = relatedDisplayTemplate.split(regex).filter((p) => p);

		for (const part of parts) {
			if (part.startsWith('{{') === false) continue;
			const key = part.replace(/{{/g, '').replace(/}}/g, '').trim();
			const newPart = `{{${relationInfo.value.relation.field}.${key}}}`;

			relatedDisplayTemplate = relatedDisplayTemplate.replace(part, newPart);
		}

		return relatedDisplayTemplate;
	}

	return `{{${relationInfo.value.relation.field}.${relationInfo.value.relatedPrimaryKeyField.field}}}`;
});

const fields = computed(() =>
	adjustFieldsForDisplays(
		[...getFieldsFromTemplate(templateWithDefaults.value), `${relationInfo.value?.relation.field}.filename_download`],
		relationInfo.value?.junctionCollection.collection ?? '',
	),
);

const page = ref(1);

const query = computed<RelationQueryMultiple>(() => ({
	fields: fields.value,
	limit: limit.value,
	page: page.value,
}));

const {
	update,
	remove,
	select,
	displayItems,
	totalItemCount,
	loading,
	selected,
	isItemSelected,
	isLocalItem,
	getItemEdits,
} = useRelationMultiple(value, query, relationInfo, primaryKey, version);

const { createAllowed, updateAllowed, selectAllowed, deleteAllowed } = useRelationPermissionsM2M(relationInfo);

const pageCount = computed(() => Math.ceil(totalItemCount.value / limit.value));

function sortItems(items: DisplayItem[]) {
	const info = relationInfo.value;
	const sortField = info?.sortField;
	if (!info || !sortField) return;

	const sortedItems = items.map((item, index) => {
		const junctionId = item?.[info.junctionPrimaryKeyField.field];
		const relatedId = item?.[info.junctionField.field]?.[info.relatedPrimaryKeyField.field];

		const changes: Record<string, any> = {
			$index: item.$index,
			$type: item.$type,
			$edits: item.$edits,
			...getItemEdits(item),
			[sortField]: index + 1,
		};

		if (!isNil(junctionId)) {
			changes[info.junctionPrimaryKeyField.field] = junctionId;
		}

		if (!isNil(relatedId)) {
			set(changes, info.junctionField.field + '.' + info.relatedPrimaryKeyField.field, relatedId);
		}

		return changes;
	});

	update(...sortedItems);
}

const selectedPrimaryKeys = computed(() => {
	if (!relationInfo.value) return [];
	const junctionField = relationInfo.value.junctionField.field;
	const relationPkField = relationInfo.value.relatedPrimaryKeyField.field;

	return selected.value.map((item) => item[junctionField][relationPkField]);
});

const editModalActive = ref(false);
const currentlyEditing = ref<string | number | null>(null);
const relatedPrimaryKey = ref<string | number | null>(null);
const selectModalActive = ref(false);
const editsAtStart = ref<Record<string, any>>({});

function editItem(item: DisplayItem) {
	if (!relationInfo.value) return;

	const relationPkField = relationInfo.value.relatedPrimaryKeyField.field;
	const junctionField = relationInfo.value.junctionField.field;
	const junctionPkField = relationInfo.value.junctionPrimaryKeyField.field;

	editsAtStart.value = getItemEdits(item);

	editModalActive.value = true;

	if (item?.$type === 'created' && !isItemSelected(item)) {
		currentlyEditing.value = null;
		relatedPrimaryKey.value = null;
	} else {
		currentlyEditing.value = get(item, [junctionPkField], null);
		relatedPrimaryKey.value = get(item, [junctionField, relationPkField], null);
	}
}

function stageEdits(item: Record<string, any>) {
	if (isEmpty(item)) return;

	update(item);
}

function deleteItem(item: DisplayItem) {
	if (
		page.value === Math.ceil(totalItemCount.value / limit.value) &&
		page.value !== Math.ceil((totalItemCount.value - 1) / limit.value)
	) {
		page.value = Math.max(1, page.value - 1);
	}

	remove(item);
}

const showUpload = ref(false);

function onUpload(files: Record<string, any>[] | Record<string, any> | null) {
	showUpload.value = false;
	// Backoffice: BoUpload `multiple` emits an array; a single file is wrapped for safety.
	if (files && !Array.isArray(files)) files = [files];
	if (!files || files.length === 0 || !relationInfo.value) return;

	const fileIds = files.map((file: Record<string, any>) => file['id']);

	select(fileIds);
}

function onSelect(selected: (string | number)[] | null) {
	select(selected!.filter((id) => selectedPrimaryKeys.value.includes(id) === false));
}

const downloadName = computed(() => {
	if (relatedPrimaryKey.value === null || relationInfo.value?.relatedCollection.collection !== 'directus_files') return;
	const junctionField = relationInfo.value.junctionField.field;
	const relationPkField = relationInfo.value.relatedPrimaryKeyField.field;

	return displayItems.value.find((item) => get(item, [junctionField, relationPkField]) === relatedPrimaryKey.value)?.[
		junctionField
	]?.filename_download;
});

const downloadUrl = computed(() => {
	if (relatedPrimaryKey.value === null || relationInfo.value?.relatedCollection.collection !== 'directus_files') return;
	return getAssetUrl(String(relatedPrimaryKey.value), { isDownload: true });
});

function getFilename(junctionRow: Record<string, any>) {
	const junctionField = relationInfo.value?.junctionField.field;
	if (!junctionField) return;

	const key = junctionRow[junctionField]?.id ?? junctionRow[junctionField] ?? null;
	if (!key) return null;

	return key;
}

const values = inject('values', ref<Record<string, unknown>>({}));

const customFilter = computed(() => {
	if (!relationInfo.value) return;

	const filter: Filter = {
		_and: [],
	};

	const reverseRelation = `$FOLLOW(${relationInfo.value.junctionCollection.collection},${relationInfo.value.junctionField.field})`;

	const selectFilter: Filter = {
		[reverseRelation]: {
			_none: {
				[relationInfo.value.reverseJunctionField.field]: {
					_eq: props.primaryKey,
				},
			},
		},
	};

	if (selectedPrimaryKeys.value.length > 0) {
		filter._and.push({
			[relationInfo.value.relatedPrimaryKeyField.field]: {
				_nin: selectedPrimaryKeys.value,
			},
		});
	}

	if (props.primaryKey !== '+') filter._and.push(selectFilter);

	if (props.filter) {
		filter._and.push(
			parseFilter(
				deepMap(props.filter, (val: unknown) => {
					if (val && typeof val === 'string') {
						return render(val, values.value);
					}

					return val;
				}),
			),
		);
	}

	if (mimeTypeFilter.value) {
		filter._and.push(mimeTypeFilter.value);
	}

	return filter;
});

const allowDrag = computed(
	() =>
		totalItemCount.value <= limit.value &&
		relationInfo.value?.sortField !== undefined &&
		!props.disabled &&
		updateAllowed.value,
);

/** Directus row v-menu (hidden when non-editable, disabled with the field). */
function rowActions(element: DisplayItem): BoMenuItem[] {
	if (props.nonEditable) return [];

	const key = getFilename(element);
	if (!key) return [];

	return [
		{ text: t('open_file_in_tab'), icon: 'launch', href: getAssetUrl(key), disabled: props.disabled },
		{
			text: t('download_file'),
			icon: 'download',
			href: getAssetUrl(key, { isDownload: true }),
			disabled: props.disabled,
		},
	];
}

function itemKey(element: DisplayItem): string | number {
	return element[relationInfo.value?.junctionPrimaryKeyField.field ?? 'id'] ?? `$${element.$type}-${element.$index}`;
}

const ROW_BTN =
	'flex w-full min-w-0 items-center rounded-md text-start text-sm text-gray-800 disabled:cursor-not-allowed disabled:text-gray-500 dark:text-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<BoNotice v-if="!relationInfo" type="warning">{{ $t('relationship_not_setup') }}</BoNotice>
	<div
		v-else
		class="many-to-many space-y-3"
		role="group"
		:aria-labelledby="a11y?.labelId"
		:aria-describedby="a11y?.describedBy"
		:aria-invalid="a11y?.invalid || undefined"
	>
		<div v-if="loading" class="space-y-2" aria-busy="true">
			<div
				v-for="n in clamp(totalItemCount - (page - 1) * limit, 1, limit)"
				:key="n"
				class="animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5"
				:class="totalItemCount > 4 ? 'h-9' : 'h-12'"
			/>
		</div>

		<template v-else>
			<BoNotice v-if="displayItems.length === 0">{{ $t('no_items') }}</BoNotice>

			<BoSortableList
				v-else
				:model-value="displayItems"
				:item-key="itemKey"
				:disabled="!allowDrag"
				:row-actions="rowActions"
				:item-label="(element) => String(getFilename(element) ?? '')"
				@update:model-value="sortItems($event)"
			>
				<template #item="{ element }">
					<div class="flex items-center gap-2" :class="totalItemCount > 4 ? 'min-h-6' : 'min-h-8'">
						<button
							type="button"
							:class="[ROW_BTN, { 'deleted line-through opacity-60': element.$type === 'deleted' }]"
							:disabled="disabled && !nonEditable"
							@click="editItem(element)"
						>
							<RenderTemplate
								:collection="relationInfo.junctionCollection.collection"
								:item="element"
								:template="templateWithDefaults ?? ''"
							/>
						</button>

						<div v-if="!nonEditable" class="item-actions flex shrink-0 items-center">
							<ItemRemove
								v-if="deleteAllowed || isLocalItem(element)"
								:disabled="disabled"
								:item-type="element.$type"
								:item-info="relationInfo"
								:item-is-local="isLocalItem(element)"
								:item-edits="getItemEdits(element)"
								@action="deleteItem(element)"
							/>
						</div>
					</div>
				</template>
			</BoSortableList>
		</template>

		<div v-if="!nonEditable || pageCount > 1" class="actions flex flex-wrap items-center gap-2">
			<template v-if="!nonEditable">
				<BoButton v-if="enableCreate && createAllowed" :disabled="disabled" @click="showUpload = true">
					{{ $t('upload_file') }}
				</BoButton>

				<BoButton v-if="enableSelect && selectAllowed" :disabled="disabled" @click="selectModalActive = true">
					{{ $t('add_existing') }}
				</BoButton>
			</template>

			<div class="flex-1" />

			<div v-if="pageCount > 1" class="pagination flex gap-2">
				<BoButton variant="secondary" icon="chevron_left" :disabled="page <= 1" @click="page--">
					{{ $t('previous') }}
				</BoButton>
				<BoButton variant="secondary" :disabled="page >= pageCount" @click="page++">
					{{ $t('next') }}
					<BoIcon name="chevron_right" size="sm" />
				</BoButton>
			</div>
		</div>

		<DrawerItem
			v-model:active="editModalActive"
			:disabled="disabled"
			:non-editable="nonEditable"
			:collection="relationInfo.junctionCollection.collection"
			:primary-key="currentlyEditing || '+'"
			:related-primary-key="relatedPrimaryKey || '+'"
			:junction-field="relationInfo.junctionField.field"
			:edits="editsAtStart"
			:circular-field="relationInfo.reverseJunctionField.field"
			@input="stageEdits"
		>
			<template #actions>
				<BoButton
					v-if="
						currentlyEditing !== '+' && relationInfo.relatedCollection.collection === 'directus_files' && downloadUrl
					"
					variant="secondary"
					icon="download"
					:aria-label="$t('download')"
					:download="downloadName"
					:href="downloadUrl"
				/>
			</template>
		</DrawerItem>

		<DrawerFiles
			v-if="!disabled"
			v-model:active="selectModalActive"
			:collection="relationInfo.relatedCollection.collection"
			:folder="folder"
			:field="field"
			:filter="customFilter"
			multiple
			@input="onSelect"
		/>

		<BoDialog v-if="!disabled" v-model:open="showUpload" :title="$t('upload_file')">
			<BoUpload multiple from-url :folder="folder" :accept="combinedAcceptString" @input="onUpload" />
			<template #actions>
				<BoButton @click="showUpload = false">{{ $t('done') }}</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
