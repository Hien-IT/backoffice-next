<!-- Ported from directus/app/src/layouts/cards/components/header.vue -->
<script setup lang="ts">
// Backoffice: recipe "Cards grid (Q-3)" header bar: the select-all button is a BoCheckbox (indeterminate while items are
// selected, a click clears them as the DR cancel icon); the sort field menu is a BoSelect with a screen reader
// label and lists only the sortable fields (DR shows the others disabled); size and direction are icon buttons
// (Material Symbols has no `grid_<n>` icon: `grid_view`); the `end` slot holds the per page select (recipe); not sticky.
// `extraSelection` holds the selected folder cards of the Files module (feature 015, FR-012): counted with the selection
// and cleared with it.
import type { Field, ShowSelect } from '@directus/types';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoCheckbox from '../../../components/BoCheckbox.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoSelect from '../../../components/BoSelect.vue';

const props = withDefaults(
	defineProps<{
		fields: Field[];
		size: number;
		sort: string[];
		showSelect?: ShowSelect;
		selection?: (number | string)[];
		extraSelection?: (number | string)[];
	}>(),
	{
		showSelect: 'multiple',
		selection: () => [],
		extraSelection: () => [],
	},
);

const emit = defineEmits<{
	'select-all': [];
	'update:size': [value: number];
	'update:sort': [value: string[]];
	'update:selection': [value: (number | string)[]];
	'update:extraSelection': [value: (number | string)[]];
}>();

const { t } = useI18n();

const totalSelectionCount = computed(() => props.selection.length + props.extraSelection.length);

// Also the aria-label: Reka reads the `<label>` text once, so a changed label would keep the old name.
const selectLabel = computed(() =>
	totalSelectionCount.value
		? t('n_items_selected', totalSelectionCount.value)
		: t(props.showSelect === 'multiple' ? 'select_all' : 'select_an_item'),
);

const descending = computed(() => props.sort[0]?.startsWith('-'));

const sortKey = computed(() => (props.sort[0]?.startsWith('-') ? props.sort[0].substring(1) : props.sort[0]));

const fieldsWithoutFake = computed(() => {
	return props.fields
		.filter((field) => field.field.startsWith('$') === false)
		.filter((field) => !['json', 'o2m', 'm2o', 'm2a', 'file', 'files', 'alias', 'presentation'].includes(field.type))
		.map((field) => ({ value: field.field, text: field.name }));
});

function toggleSize() {
	if (props.size >= 2 && props.size < 5) {
		emit('update:size', props.size + 1);
	} else {
		emit('update:size', 2);
	}
}

function toggleDescending() {
	if (!props.sort[0]) return;

	if (descending.value === true) {
		emit('update:sort', [props.sort[0].substring(1)]);
	} else {
		emit('update:sort', ['-' + props.sort[0]]);
	}
}

function onClickSelect() {
	if (totalSelectionCount.value) {
		emit('update:selection', []);
		emit('update:extraSelection', []);
	} else if (props.showSelect === 'multiple') {
		emit('select-all');
	}
}

const ICON_BTN =
	'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div
		class="sticky top-0 z-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-gray-200 bg-white px-2 py-2 dark:border-gray-800 dark:bg-gray-900"
	>
		<!-- sticky at the top of the page scroller (PrivateView `fill`): cards/components/header.vue:136-139 -->
		<BoCheckbox
			:model-value="totalSelectionCount ? null : false"
			:label="selectLabel"
			:aria-label="selectLabel"
			@update:model-value="onClickSelect"
		/>

		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				:class="ICON_BTN"
				:aria-label="$t('card_size')"
				:title="$t('card_size')"
				@click="toggleSize"
			>
				<BoIcon name="grid_view" />
			</button>

			<BoSelect
				class="w-44 [&>label]:sr-only"
				:label="$t('sort_field')"
				:model-value="sortKey ?? null"
				:items="fieldsWithoutFake"
				@update:model-value="emit('update:sort', [$event])"
			/>

			<button
				type="button"
				:class="ICON_BTN"
				:aria-label="$t('sort_direction')"
				:aria-pressed="descending ? 'true' : 'false'"
				:title="$t(descending ? 'sort_desc' : 'sort_asc')"
				@click="toggleDescending"
			>
				<BoIcon name="sort" :class="{ '-scale-y-100': descending }" />
			</button>

			<slot name="end" />
		</div>
	</div>
</template>
