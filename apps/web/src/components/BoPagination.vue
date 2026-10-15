<!-- Ported from directus/app/src/components/v-pagination.vue -->
<script setup lang="ts">
// Backoffice: recipe "Data table and pagination (Q-2)": a `nav` with `aria-label`, hidden when there is one page or
// none (Directus: the tabular layout hides v-pagination then), `aria-current="page"` on the current page, labelled
// previous/next icon buttons, `…` gaps; `totalVisible` defaults to 7 and `showFirstLast` to true (tabular layout values).
import { computed } from 'vue';
import BoIcon from './BoIcon.vue';

const props = withDefaults(
	defineProps<{
		/** The amount of pages to render */
		length: number;
		/** Disables the pagination */
		disabled?: boolean;
		/** Specify the max total visible pagination numbers */
		totalVisible?: number;
		/** Show first/last buttons */
		showFirstLast?: boolean;
		/** Accessible name of the nav (for example the collection name) */
		label: string;
	}>(),
	{ disabled: false, totalVisible: 7, showFirstLast: true },
);

/** Currently selected page */
const modelValue = defineModel<number>({ required: true });

const visiblePages = computed<number[]>(() => {
	if (props.totalVisible === undefined) return [];

	let startPage: number;
	let endPage: number;

	if (!Number.isInteger(props.totalVisible) || props.length <= props.totalVisible) {
		startPage = 1;
		endPage = props.length;
	} else {
		const pagesBeforeCurrentPage = Math.floor(props.totalVisible / 2);
		const pagesAfterCurrentPage = Math.ceil(props.totalVisible / 2) - 1;

		if (modelValue.value <= pagesBeforeCurrentPage) {
			startPage = 1;
			endPage = props.totalVisible;
		} else if (modelValue.value + pagesAfterCurrentPage >= props.length) {
			startPage = props.length - props.totalVisible + 1;
			endPage = props.length;
		} else {
			startPage = modelValue.value - pagesBeforeCurrentPage;
			endPage = modelValue.value + pagesAfterCurrentPage;
		}
	}

	return Array.from(Array(endPage + 1 - startPage).keys()).map((i) => startPage + i);
});

const half = computed(() => Math.ceil(props.totalVisible / 2));
const showFirst = computed(
	() => props.showFirstLast && modelValue.value > half.value + 1 && props.length > props.totalVisible,
);
const showStartGap = computed(() => showFirst.value && props.length > props.totalVisible + 1);
const showEndGap = computed(
	() => props.showFirstLast && modelValue.value < props.length - half.value && props.length > props.totalVisible + 1,
);
const showLast = computed(
	() => props.showFirstLast && modelValue.value <= props.length - half.value && props.length > props.totalVisible,
);

function toPage(page: number) {
	modelValue.value = page;
}

const BUTTON =
	'inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg px-2 text-theme-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:outline-brand-400';
const IDLE = 'text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5';
const CURRENT = 'bg-brand-500 text-white';
</script>

<template>
	<nav v-if="length > 1" :aria-label="label" class="flex items-center gap-1">
		<button
			type="button"
			:class="[BUTTON, IDLE]"
			:disabled="disabled || modelValue === 1"
			:aria-label="$t('previous')"
			@click="toPage(modelValue - 1)"
		>
			<BoIcon name="chevron_left" />
		</button>

		<button v-if="showFirst" type="button" :class="[BUTTON, IDLE]" :disabled="disabled" @click="toPage(1)">1</button>
		<span v-if="showStartGap" class="px-1 text-theme-sm text-gray-500 dark:text-gray-400" aria-hidden="true">…</span>

		<button
			v-for="page in visiblePages"
			:key="page"
			type="button"
			:class="[BUTTON, modelValue === page ? CURRENT : IDLE]"
			:aria-current="modelValue === page ? 'page' : undefined"
			:disabled="disabled"
			@click="toPage(page)"
		>
			{{ page }}
		</button>

		<span v-if="showEndGap" class="px-1 text-theme-sm text-gray-500 dark:text-gray-400" aria-hidden="true">…</span>
		<button
			v-if="showLast"
			type="button"
			:class="[BUTTON, modelValue === length ? CURRENT : IDLE]"
			:aria-current="modelValue === length ? 'page' : undefined"
			:disabled="disabled"
			@click="toPage(length)"
		>
			{{ length }}
		</button>

		<button
			type="button"
			:class="[BUTTON, IDLE]"
			:disabled="disabled || modelValue === length"
			:aria-label="$t('next')"
			@click="toPage(modelValue + 1)"
		>
			<BoIcon name="chevron_right" />
		</button>
	</nav>
</template>
