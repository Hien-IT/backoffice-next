<!-- Ported from directus/app/src/components/v-pagination.vue -->
<script setup lang="ts">
// Backoffice: recipe "Data table and pagination (Q-2)": a `nav` with `aria-label`, hidden when there is one page or
// none (DR: the tabular layout hides v-pagination then), `aria-current="page"` on the current page, labelled
// previous/next icon buttons, `…` gaps; `totalVisible` defaults to 7 and `showFirstLast` to true (tabular layout values).
// Look of the TailAdmin data table pagination (owner 2026-10-22, D-160): bordered 40 px arrow buttons, 40 px page
// buttons, the current page on a brand tint (brand-600 text for 4.5:1 where TailAdmin has brand-500).
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
		/** Also shown with one page or none (v-pagination, spec 020) */
		alwaysShow?: boolean;
	}>(),
	{ disabled: false, totalVisible: 7, showFirstLast: true, alwaysShow: false },
);

/** Currently selected page */
const modelValue = defineModel<number>({ required: true });

const visiblePages = computed<number[]>(() => {
	if (!props.totalVisible) return [];

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

// v-pagination: no first/last without `totalVisible` (0 here, since the default fills undefined in).
const firstLast = computed(() => props.showFirstLast && !!props.totalVisible);
const half = computed(() => Math.ceil(props.totalVisible / 2));
const showFirst = computed(
	() => firstLast.value && modelValue.value > half.value + 1 && props.length > props.totalVisible,
);
const showStartGap = computed(() => showFirst.value && props.length > props.totalVisible + 1);
const showEndGap = computed(
	() => firstLast.value && modelValue.value < props.length - half.value && props.length > props.totalVisible + 1,
);
const showLast = computed(
	() => firstLast.value && modelValue.value <= props.length - half.value && props.length > props.totalVisible,
);

function toPage(page: number) {
	modelValue.value = page;
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const BUTTON = `inline-flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const IDLE =
	'text-gray-700 hover:bg-brand-500/[0.08] hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400';
const CURRENT = 'bg-brand-500/[0.08] text-brand-600 dark:bg-brand-500/[0.12] dark:text-brand-400';
const ARROW = `inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] ${FOCUS}`;
</script>

<template>
	<nav v-if="length > 1 || alwaysShow" :aria-label="label" class="flex items-center gap-0.5">
		<button
			type="button"
			:class="[ARROW, 'me-2.5']"
			:disabled="disabled || modelValue === 1"
			:aria-label="$t('previous')"
			@click="toPage(modelValue - 1)"
		>
			<BoIcon name="arrow_back" class="rtl:rotate-180" />
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
			:class="[ARROW, 'ms-2.5']"
			:disabled="disabled || modelValue === length"
			:aria-label="$t('next')"
			@click="toPage(modelValue + 1)"
		>
			<BoIcon name="arrow_forward" class="rtl:rotate-180" />
		</button>
	</nav>
</template>
