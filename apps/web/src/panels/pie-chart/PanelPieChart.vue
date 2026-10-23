<!-- Ported from directus/app/src/panels/pie-chart/panel-pie-chart.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-047..FR-050, recipe Q-35): ApexCharts loaded lazily (loadApexCharts) with an unmount/race
// guard; DR theme variables replaced by the chart theme tokens (THEME; default color cssVar('--color-brand-500'),
// D-108); animations follow prefers-reduced-motion; the chart is aria-hidden with an sr-only ChartTable of the labels and
// raw values (FR-106); the global tooltip styles live in styles/apexcharts.css. Labels, series (×100 only with decimals)
// and conditional fill are DR' unchanged.
import type ApexCharts from 'apexcharts';
import { isNil, snakeCase } from 'lodash-es';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFieldsStore } from '../../stores/fields.ts';
import { cssVar } from '../../utils/css-var.ts';
import ChartTable from '../shared/ChartTable.vue';
import { loadApexCharts, THEME, prefersReducedMotion } from '../shared/apex-charts.ts';
import { monoThemeGenerator } from '../shared/color-generator.ts';

type PanelFunction = 'count' | 'countDistinct' | 'avg' | 'avgDistinct' | 'sum' | 'sumDistinct' | 'min' | 'max';

type StringConditionalFillOperators =
	| '='
	| '!='
	| '>'
	| '>='
	| '<'
	| '<='
	| 'contains'
	| 'ncontains'
	| 'starts_with'
	| 'nstarts_with'
	| 'istarts_with'
	| 'nistarts_with'
	| 'ends_with'
	| 'nends_with'
	| 'iends_with'
	| 'niends_with';

type ConditionalFillFormat = {
	operator: StringConditionalFillOperators;
	color: string;
	value: number | string;
};

const props = withDefaults(
	defineProps<{
		showHeader?: boolean;
		collection: string;
		column: string;
		data?: Record<string, any>[];
		donut?: boolean;
		decimals?: number;
		function?: PanelFunction;
		legend?: 'none' | 'right' | 'bottom';
		showLabels?: boolean;
		color?: string | null;
		height: number;
		width: number;
		conditionalFill?: ConditionalFillFormat[] | null;
		gridSize: number;
	}>(),
	{
		showHeader: false,
		data: () => [],
		donut: false,
		decimals: 0,
		function: 'count',
		legend: 'none',
		showLabels: false,
		color: cssVar('--color-brand-500'),
		conditionalFill: () => [],
	},
);

const { t, n } = useI18n();

const fieldsStore = useFieldsStore();

const chartEl = ref<HTMLElement>();
const chart = ref<ApexCharts>();
const tableRows = ref<(string | number | null)[][]>([]);
let unmounted = false;

const tableColumns = computed(() => [
	fieldsStore.getField(props.collection, props.column)?.name ?? props.column,
	t(snakeCase(props.function)),
]);

const isNumberColumn = computed(() => {
	if (!props.collection || !props.column) return false;
	const field = fieldsStore.getField(props.collection, props.column);
	if (!field?.type) return false;
	return ['integer', 'bigInteger', 'float', 'decimal'].includes(field.type);
});

watch(
	[
		() => props.data,
		() => props.color,
		() => props.donut,
		() => props.decimals,
		() => props.legend,
		() => props.showHeader,
		() => props.showLabels,
		() => props.conditionalFill,
		() => props.height,
		() => props.width,
	],
	() => {
		// Backoffice: setupChart destroys the previous chart after the lazy load
		setupChart();
	},
	{ deep: true },
);

onMounted(fetchData);

onUnmounted(() => {
	unmounted = true;
	chart.value?.destroy();
});

async function fetchData() {
	setupChart();
}

async function setupChart() {
	const labels: (string | number)[] = props.data.map((item) => {
		const label = item['group'][props.column];

		if (props.decimals === 0 || isNaN(Number(label))) {
			return props.legend === 'right' ? String(label).substring(0, 8) : String(label);
		}

		const translatedLabel = String(Number(label).toFixed(props.decimals));
		return props.legend === 'right' ? translatedLabel.substring(0, 5) : translatedLabel;
	});

	const series: number[] = props.data.map((item) => {
		const value = item[props.function][props.column];
		const currentValue = Number(value * 100);
		if (props.decimals === 0 || isNaN(currentValue)) return value;
		return Number(currentValue.toFixed(props.decimals));
	});

	tableRows.value = props.data.map((item, index) => [labels[index] ?? null, item[props.function][props.column]]);

	const total = series.reduce((acc, val) => acc + val, 0);

	const baseColors: string[] = monoThemeGenerator(props.color || cssVar('--color-brand-500'), labels.length);

	const colors = baseColors.map((baseColor, index) => {
		const rawValue = props.data[index]?.['group']?.[props.column];
		return formatColor(baseColor, isNumberColumn.value ? series[index] : rawValue);
	});

	const size = props.height < props.width ? props.height * props.gridSize : props.width * props.gridSize;

	let left = props.gridSize;
	let right = props.gridSize;
	let top = props.showHeader ? props.gridSize / 2 : 0;
	let bottom = props.showHeader ? props.gridSize * 4 : props.gridSize * 3;
	let offsetY = props.showHeader ? props.gridSize * -0.75 : 0;

	if (props.legend === 'right') {
		left = 0;
		right = -right;
	} else if (props.legend === 'bottom') {
		top = props.showHeader ? props.gridSize / 2 : -props.gridSize / 4;
		bottom = props.showHeader ? props.gridSize : props.gridSize / 2;
		offsetY = props.showHeader ? -props.gridSize : -props.gridSize / 2;
	}

	const ApexChartsClass = await loadApexCharts();
	if (unmounted) return;
	chart.value?.destroy();

	chart.value = new ApexChartsClass(chartEl.value, {
		chart: {
			// Backoffice: DR sets the unknown key `animation` (so ApexCharts animates); reduced motion turns it off
			animations: {
				enabled: !prefersReducedMotion(),
			},
			type: props.donut ? 'donut' : 'pie',
			height: size,
			fontFamily: THEME.fontFamily,
			foreColor: THEME.foregroundSubdued,
			selection: {
				enabled: false,
			},
		},
		states: {
			active: { filter: { type: 'none', value: 0 } },
		},
		series,
		labels,
		colors,
		grid: {
			borderColor: THEME.borderColorSubdued,
			padding: {
				top,
				bottom,
				left,
				right,
			},
		},
		stroke: {
			show: false,
		},
		plotOptions: {
			pie: {
				offsetY: props.showHeader ? -15 : 20,
				dataLabels: {
					enabled: false,
				},
			},
		},
		tooltip: {
			followCursor: false,
			fillSeriesColor: false,
			theme: 'light',
			marker: {
				show: false,
			},
			x: {
				formatter: (value: number) => n(value / 100),
			},
			y: {
				title: {
					formatter: (seriesName: string) => `${seriesName}: `,
				},
				formatter: function (outOfOneHundred: number) {
					return `${getPercentage((outOfOneHundred / total) * 100)}% (${n(outOfOneHundred / 100)})`;
				},
			},
		},
		dataLabels: {
			enabled: props.showLabels,
			style: {
				fontSize: '0.5625rem',
			},
			formatter: function (val: number) {
				return `${getPercentage(val)}%`;
			},
		},
		legend: {
			show: props.legend !== 'none',
			position: props.legend !== 'none' ? props.legend : undefined,
			customLegendItems: labels,
			offsetX: props.legend === 'right' ? -25 : 0,
			offsetY,
			markers: {
				width: 8,
				height: 8,
			},
		},
	});

	chart.value.render();
}

function getPercentage(value: number) {
	return typeof props.decimals === 'number' && props.decimals >= 0
		? n(Number(value.toFixed(props.decimals)))
		: n(value);
}

function formatColor(color: string | number, value?: string | number) {
	if (isNil(value) || !props.conditionalFill?.length) return color;
	let formattedColor = color;

	for (const format of props.conditionalFill) {
		const shouldChangeColor = checkMatchingConditionalFill(value, format);
		if (shouldChangeColor) formattedColor = format.color;
	}

	return formattedColor;
}

function checkMatchingConditionalFill(value: string | number, format: ConditionalFillFormat): boolean {
	let baseValue: string | number = value;
	let compareValue: string | number = format.value;
	const operator = format.operator || '>=';
	const isNumericComparison = ['>', '>=', '<', '<='].includes(operator);

	if (isNumericComparison) {
		if (isNaN(Number(value)) || isNaN(Number(format.value))) return false;

		baseValue = Number(value);
		compareValue = Number(format.value);

		switch (operator) {
			case '>':
				return baseValue > compareValue;
			case '>=':
				return baseValue >= compareValue;
			case '<':
				return baseValue < compareValue;
			case '<=':
				return baseValue <= compareValue;
		}
	}

	switch (operator) {
		case '=':
			return baseValue === compareValue;
		case '!=':
			return baseValue !== compareValue;
		case 'contains':
			return typeof baseValue === 'string' && typeof compareValue === 'string'
				? baseValue.includes(compareValue)
				: false;
		case 'ncontains':
			return typeof baseValue === 'string' && typeof compareValue === 'string'
				? !baseValue.includes(compareValue)
				: false;
		default:
			return false;
	}
}
</script>

<template>
	<div class="h-full w-full">
		<div ref="chartEl" aria-hidden="true" />
		<ChartTable :columns="tableColumns" :rows="tableRows" />
	</div>
</template>
