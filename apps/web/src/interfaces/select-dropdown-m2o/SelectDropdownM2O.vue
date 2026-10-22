<!-- Ported from directus/app/src/interfaces/select-dropdown-m2o/select-dropdown-m2o.vue -->
<script setup lang="ts">
// Backoffice: v-list-item is a field-styled row whose main control is a native button stretched over the row (the
// whole row stays clickable as in Directus, actions are sibling buttons instead of nested ones); v-remove is BoRemove;
// tooltips are BoTooltip; v-prevent-focusout is not needed (drawers are portals). A related collection missing from the collections store (no read permission)
// shows `relationship_not_setup` instead of throwing.
import type { Filter } from '@directus/types';
import { deepMap, getFieldsFromTemplate } from '@directus/utils';
import { get } from 'lodash-es';
import { render } from 'micromustache';
import { computed, inject, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import BoIcon from '../../components/BoIcon.vue';
import BoNotice from '../../components/BoNotice.vue';
import BoRemove from '../../components/BoRemove.vue';
import BoTooltip from '../../components/BoTooltip.vue';
import DrawerCollection from '../../components/drawers/DrawerCollection.vue';
import DrawerItem from '../../components/drawers/DrawerItem.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { parseFilter } from '../../components/form/utils/parse-filter.ts';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import { useRelationM2O } from '../../composables/use-relation-m2o.ts';
import { useRelationPermissionsM2O } from '../../composables/use-relation-permissions.ts';
import { type RelationQuerySingle, useRelationSingle } from '../../composables/use-relation-single.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import { getItemRoute } from '../../utils/get-item-route.ts';

const props = withDefaults(
	defineProps<{
		value?: number | string | Record<string, any> | null;
		collection: string;
		field: string;
		template?: string | null;
		selectMode?: 'auto' | 'dropdown' | 'modal';
		disabled?: boolean;
		nonEditable?: boolean;
		filter?: Filter | null;
		enableCreate?: boolean;
		enableSelect?: boolean;
		loading?: boolean;
		enableLink?: boolean;
	}>(),
	{
		value: null,
		selectMode: 'auto',
		disabled: false,
		nonEditable: false,
		template: null,
		filter: null,
		enableCreate: true,
		enableSelect: true,
		enableLink: false,
	},
);

const emit = defineEmits(['input']);

const { t } = useI18n();

const a11y = inject(FORM_FIELD_A11Y, null);

const values = inject('values', ref<Record<string, any>>({}));

const collectionsStore = useCollectionsStore();

const customFilter = computed(() => {
	return parseFilter(
		deepMap(props.filter, (val: any) => {
			if (val && typeof val === 'string') {
				return render(val, values.value);
			}

			return val;
		}),
	);
});

const { collection, field } = toRefs(props);
const { relationInfo: m2oRelationInfo } = useRelationM2O(collection, field);

// Backoffice: a related collection missing from the collections store (no read permission) counts as no relation.
const relationInfo = computed(() => (m2oRelationInfo.value?.relatedCollection ? m2oRelationInfo.value : undefined));

const value = computed({
	get: () => props.value ?? null,
	set: (value) => {
		emit('input', value);
	},
});

const selectModalActive = ref(false);
const editModalActive = ref(false);

const displayTemplate = computed(() => {
	if (props.template) return props.template;

	if (!relationInfo.value) return '';

	const displayTemplate = collectionsStore.getCollection(relationInfo.value.relatedCollection.collection)?.meta
		?.display_template;

	return displayTemplate || `{{ ${relationInfo.value.relatedPrimaryKeyField.field || ''} }}`;
});

const requiredFields = computed(() => {
	if (!displayTemplate.value || !relationInfo.value?.relatedCollection.collection) return [];

	return adjustFieldsForDisplays(
		getFieldsFromTemplate(displayTemplate.value),
		relationInfo.value?.relatedCollection.collection,
	);
});

const query = computed<RelationQuerySingle>(() => ({
	fields: requiredFields.value,
}));

const { update, remove, displayItem, loading } = useRelationSingle(value, query, relationInfo, {
	enabled: computed(() => !props.loading),
});

const { createAllowed } = useRelationPermissionsM2O(relationInfo);

const currentPrimaryKey = computed<string | number>(() => {
	if (!displayItem.value || !props.value || !relationInfo.value) return '+';

	if (typeof props.value === 'number' || typeof props.value === 'string') {
		return props.value;
	}

	return get(props.value, relationInfo.value.relatedPrimaryKeyField.field, '+');
});

const edits = computed(() => {
	if (!props.value || typeof props.value !== 'object') return {};

	return props.value;
});

function onPreviewClick() {
	if (props.disabled) return;

	// Prevent double dialog in case the edit dialog is already open
	if (editModalActive.value === true) return;

	if (props.enableSelect) {
		selectModalActive.value = true;
		return;
	}

	editModalActive.value = true;
}

function onDrawerItemInput(event: any) {
	if (props.disabled) return;
	update(event);
}

const selection = computed<(number | string)[]>(() => {
	const pkField = relationInfo.value?.relatedPrimaryKeyField.field;

	if (!props.value || !pkField) return [];

	if (typeof props.value === 'object' && pkField in props.value) {
		return [props.value[pkField]];
	}

	return [props.value];
});

function onSelection(selection: (number | string)[] | null) {
	if (selection) {
		if (selection[0]) {
			update(selection[0]);
		} else {
			remove();
		}
	}

	selectModalActive.value = false;
}

function getLinkForItem() {
	if (!collection.value || !currentPrimaryKey.value || !relationInfo.value) return '';
	return getItemRoute(relationInfo.value.relatedCollection.collection, currentPrimaryKey.value);
}

const ICON_BTN =
	'relative z-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<BoNotice v-if="!relationInfo" type="warning">
		{{ t('relationship_not_setup') }}
	</BoNotice>
	<BoNotice v-else-if="relationInfo.relatedCollection.meta?.singleton" type="warning">
		{{ t('no_singleton_relations') }}
	</BoNotice>
	<BoNotice v-else-if="!displayTemplate" type="warning">
		{{ t('display_template_not_setup') }}
	</BoNotice>
	<BoNotice v-else-if="!enableCreate && !enableSelect && !displayItem">
		{{ t('no_items') }}
	</BoNotice>

	<div v-else class="many-to-one relative">
		<div
			v-if="loading"
			aria-busy="true"
			class="h-11 w-full animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5"
		>
			<span class="sr-only">{{ t('loading') }}</span>
		</div>

		<!-- Not `list-item` (the Directus class): Tailwind reads it as `display: list-item` and drops the flex row. -->
		<div
			v-else
			class="item-row relative flex min-h-11 w-full items-center gap-1 rounded-lg border py-1 ps-4 pe-2 text-sm shadow-theme-xs"
			:class="[
				disabled && !nonEditable
					? 'border-gray-100 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400'
					: 'border-gray-300 bg-transparent text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90',
				{ 'border-error-600 dark:border-error-400': a11y?.invalid },
			]"
		>
			<button
				:id="a11y?.inputId"
				type="button"
				class="main min-w-0 flex-1 truncate text-start outline-hidden after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-500 disabled:cursor-not-allowed dark:focus-visible:after:outline-brand-400"
				:disabled="disabled && !(nonEditable && displayItem)"
				:aria-labelledby="a11y ? `${a11y.labelId} ${a11y.inputId}` : undefined"
				:aria-describedby="a11y?.describedBy"
				:aria-invalid="a11y?.invalid || undefined"
				@click="!(nonEditable && displayItem) ? onPreviewClick() : (editModalActive = true)"
			>
				<span v-if="displayItem" class="preview block truncate">
					<RenderTemplate
						:collection="relationInfo.relatedCollection.collection"
						:item="displayItem"
						:template="displayTemplate"
					/>
				</span>
				<span v-else class="placeholder text-gray-500 dark:text-gray-400">
					{{ t(enableSelect ? 'select_an_item' : 'create_item') }}
				</span>
			</button>

			<div v-if="!nonEditable || (enableLink && displayItem)" class="item-actions flex shrink-0 items-center gap-0.5">
				<template v-if="displayItem">
					<RouterLink v-if="enableLink" v-slot="{ href, navigate }" :to="getLinkForItem()" custom>
						<span v-if="disabled && !nonEditable" :class="ICON_BTN">
							<BoIcon name="launch" size="sm" />
						</span>

						<BoTooltip v-else :text="t('navigate_to_item')">
							<a
								:href="href"
								class="item-link"
								:class="ICON_BTN"
								:aria-label="t('navigate_to_item')"
								@click.stop="navigate"
								@keydown.stop
							>
								<BoIcon name="launch" size="sm" />
							</a>
						</BoTooltip>
					</RouterLink>

					<BoTooltip v-if="!nonEditable" :text="t('edit_item')">
						<button
							type="button"
							class="edit"
							:class="ICON_BTN"
							:aria-label="t('edit_item')"
							:disabled
							@click="editModalActive = true"
						>
							<BoIcon name="edit" size="sm" />
						</button>
					</BoTooltip>

					<BoRemove
						v-if="!nonEditable"
						class="remove relative z-1"
						deselect
						:disabled
						:item-info="relationInfo"
						:item-edits="edits"
						@action="emit('input', null)"
					/>
				</template>

				<template v-else>
					<BoTooltip v-if="!nonEditable && createAllowed && enableCreate" :text="t('create_item')">
						<button
							type="button"
							class="add"
							:class="ICON_BTN"
							:aria-label="t('create_item')"
							:disabled
							@click="editModalActive = true"
						>
							<BoIcon name="add" size="sm" />
						</button>
					</BoTooltip>

					<!-- The row button opens the selection; the chevron only shows it (Directus `expand`). -->
					<BoIcon
						v-if="enableSelect"
						class="expand pointer-events-none px-1.5 text-gray-500 dark:text-gray-400"
						name="expand_more"
						size="sm"
					/>
				</template>
			</div>
		</div>

		<DrawerItem
			v-model:active="editModalActive"
			:collection="relationInfo.relatedCollection.collection"
			:primary-key="currentPrimaryKey"
			:edits="edits"
			:circular-field="relationInfo.relation.meta?.one_field ?? null"
			:disabled="disabled"
			:non-editable="nonEditable"
			@input="onDrawerItemInput"
		/>

		<DrawerCollection
			v-if="!disabled"
			v-model:active="selectModalActive"
			:collection="relationInfo.relatedCollection.collection"
			:selection="selection"
			:filter="customFilter"
			@input="onSelection"
		/>
	</div>
</template>
