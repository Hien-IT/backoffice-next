<!-- Ported from directus/app/src/panels/metric/panel-metric.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-042..FR-046, recipe Q-36): default color `var(--color-brand-500)` (D-108) instead of
// `var(--theme--primary)`; styles as Tailwind classes (text `text-gray-800 dark:text-white/90`, fonts `font-outfit`,
// `font-[serif]`, `font-[monospace]` as DisplayFormattedValue: the theme has no `font-serif`/`font-mono`);
// `inheritAttrs: false` (as the Directus label panel) keeps the tile context props it does not declare out of the DOM.
// Logic as Directus, quirks kept: the last matching conditional rule wins, `<=` compares with `<`.
import type { Filter } from '@directus/types';
import { isNil } from 'lodash-es';
import { type CSSProperties, computed, onBeforeUnmount, onMounted, onUpdated, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAutoFontFit } from '../../composables/use-auto-fit-text.ts';
import type { Notation, NumberFormatOptions, Style, Unit } from '../../utils/format-number.ts';
import { formatNumber } from '../../utils/format-number.ts';

defineOptions({ inheritAttrs: false });

interface Props {
	showHeader?: boolean;
	sortField?: string | undefined;
	collection: string;
	field: string;
	function: string;
	filter?: Filter;
	data?: Record<string, any>[];
	notation?: Notation;
	numberStyle?: Style;
	unit?: Unit | undefined;
	prefix?: string | null;
	suffix?: string | null;
	minimumFractionDigits?: number;
	maximumFractionDigits?: number;
	conditionalFormatting?: Record<string, any>[] | null;
	textAlign?: CSSProperties['text-align'];
	fontSize?: string;
	fontWeight?: number | undefined;
	fontStyle?: string | undefined;
	font?: 'sans-serif' | 'serif' | 'monospace';
}

const props = withDefaults(defineProps<Props>(), {
	showHeader: false,
	sortField: undefined,
	data: () => [],
	filter: () => ({}),
	notation: 'standard',
	numberStyle: 'decimal',
	unit: undefined,
	prefix: '',
	suffix: '',
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
	conditionalFormatting: () => [],
	fontSize: 'auto',
	fontWeight: 800,
	fontStyle: undefined,
	font: 'sans-serif',
	textAlign: 'center',
});

const FONTS = { 'sans-serif': 'font-outfit', serif: 'font-[serif]', monospace: 'font-[monospace]' };

const { locale } = useI18n();

const labelContainer = ref<HTMLDivElement | null>(null);
const labelText = ref<HTMLParagraphElement | null>(null);

const { adjustFontSize } = useAutoFontFit(labelContainer, labelText);

let resizeObserver: ResizeObserver | null = null;

function adjustPadding() {
	const container = labelContainer.value;
	if (!container) return;

	const paddingWidth = container.offsetWidth * 0.05;
	const paddingHeight = container.offsetHeight * 0.05;

	const padding = Math.round(Math.max(8, Math.min(paddingWidth, paddingHeight)));

	if (props.showHeader == true) {
		container.style.padding = '0 0.6875rem 0.6875rem 0.6875rem';
	} else {
		container.style.padding = `${padding}px`;
	}

	return;
}

function unmountResizeObserver() {
	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}
}

async function updateFit() {
	if (props.fontSize !== 'auto' || !props.data || props.data.length === 0) {
		unmountResizeObserver();
		return;
	}

	await document.fonts.ready;
	adjustPadding();
	adjustFontSize();

	if (!resizeObserver) {
		const container = labelContainer.value;
		if (!container) return;

		// Create a ResizeObserver to watch for changes in the container's dimensions
		resizeObserver = new ResizeObserver(() => {
			updateFit();
		});

		resizeObserver.observe(container);
	}

	adjustFontSize();
}

onMounted(() => {
	updateFit();
});

onUpdated(() => {
	updateFit();
});

onBeforeUnmount(() => {
	unmountResizeObserver();
});

const metric = computed<string | number | null>(() => {
	if (!props.data || props.data.length === 0) return null;

	const row = props.data[0]!;

	if (props.field) {
		if (props.function === 'first' || props.function === 'last') {
			if (typeof row[props.field] === 'string') {
				return row[props.field];
			} else {
				return Number(row[props.field]);
			}
		} else {
			return Number(row[props.function][props.field]);
		}
	} else {
		return Number(row[props.function]);
	}
});

function displayValue(value: string | number | null) {
	if (value === null || value === undefined) {
		return 0;
	}

	return formatNumber(Number(value), locale.value, {
		notation: props.notation,
		style: props.numberStyle,
		unit: props.unit,
		minimumFractionDigits: props.minimumFractionDigits,
		maximumFractionDigits: props.maximumFractionDigits,
		currency: props.numberStyle === 'currency' ? String(props.unit) : undefined,
	} as NumberFormatOptions);
}

const color = computed(() => {
	if (isNil(metric.value)) return null;

	let matchingFormat = null;

	for (const format of props.conditionalFormatting || []) {
		if (matchesOperator(format)) {
			matchingFormat = format;
		}
	}

	return matchingFormat?.['color'] || 'var(--color-brand-500)';

	function matchesOperator(format: Record<string, any>) {
		if (typeof metric.value === 'string') {
			const value = metric.value;
			const compareValue = format['value'] ?? '';

			switch (format['operator'] || '>=') {
				case '=':
					return value === compareValue;
				case '!=':
					return value !== compareValue;
			}
		} else {
			const value = Number(metric.value);
			const compareValue = Number(format['value'] ?? 0);

			switch (format['operator'] || '>=') {
				case '=':
					return value === compareValue;
				case '!=':
					return value !== compareValue;
				case '>':
					return value > compareValue;
				case '>=':
					return value >= compareValue;
				case '<':
					return value < compareValue;
				case '<=':
					// Backoffice (D-113, owner 2026-10-18): Directus compares `<=` with `<` (R-53).
					return value <= compareValue;
			}
		}

		return false;
	}
});
</script>

<template>
	<div
		ref="labelContainer"
		class="flex size-full items-center p-[0.6875rem] text-2xl leading-[1.2] font-extrabold whitespace-nowrap text-gray-800 dark:text-white/90"
		:class="[FONTS[font], { 'has-header': showHeader }]"
	>
		<p
			ref="labelText"
			class="min-h-min w-full min-w-min"
			:style="{ color, fontWeight, textAlign, fontStyle, fontSize: fontSize !== 'auto' ? fontSize : undefined }"
		>
			{{ prefix }}
			{{ displayValue(metric) }}
			{{ suffix }}
		</p>
	</div>
</template>
