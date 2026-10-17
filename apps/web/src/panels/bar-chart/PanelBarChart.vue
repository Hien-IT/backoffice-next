<!-- Ported from directus/app/src/panels/bar-chart/panel-bar-chart.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-047..FR-050, recipe Q-35): ApexCharts loaded lazily (loadApexCharts) with an unmount/race
// guard; Directus theme variables replaced by the chart theme tokens (THEME, D-108 default color); animations stay off
// like Directus; the chart is aria-hidden with an sr-only ChartTable of the plotted values (FR-106); the global tooltip
// styles live in styles/apexcharts.css. Data transforms and conditional-fill quirks are Directus' unchanged.
import type { Filter } from '@directus/types';
import type ApexCharts from 'apexcharts';
import { isNil, snakeCase } from 'lodash-es';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFieldsStore } from '../../stores/fields.ts';
import ChartTable from '../shared/ChartTable.vue';
import { loadApexCharts, THEME } from '../shared/apex-charts.ts';

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
	axis: 'X' | 'Y';
	operator: StringConditionalFillOperators;
	color: string;
	value: number;
};

/* eslint-disable vue/require-default-prop -- the optional props have no default in Directus either */
const props = withDefaults(
	defineProps<{
		showHeader?: boolean;
		height: number;
		data?: Record<string, any>[] | [Record<string, any>[], Record<string, any>[]];
		collection: string;
		horizontal?: boolean;
		xAxis: string;
		function?: PanelFunction;
		yAxis: string;
		xAxisDisplayField?: string;
		decimals?: number;
		color?: string | null;
		filter?: Filter;
		showAxisLabels?: string;
		showDataLabel?: boolean;
		conditionalFill?: ConditionalFillFormat[] | null;
	}>(),
	{
		showHeader: false,
		data: () => [],
		horizontal: false,
		decimals: 2,
		color: THEME.primary,
		function: 'max',
		filter: () => ({}),
		showAxisLabels: 'both',
		showDataLabel: true,
		conditionalFill: () => [],
	},
);
/* eslint-enable vue/require-default-prop */

const { t, n } = useI18n();

const fieldsStore = useFieldsStore();

const chartEl = ref<HTMLElement>();
const chart = ref<ApexCharts>();
const tableRows = ref<(string | number | null)[][]>([]);
let unmounted = false;

const yAxisLabel = computed(() => {
	// Backoffice: optional chaining, the label is also the table header (rendered eagerly, Directus reads it in the tooltip)
	const field = fieldsStore.getField(props.collection, props.yAxis);

	if (!props.function) return `${field?.name}`;

	const operation = t(snakeCase(props.function));
	return `${field?.name} (${operation})`;
});

const tableColumns = computed(() => [
	fieldsStore.getField(props.collection, props.xAxis)?.name ?? props.xAxis,
	yAxisLabel.value,
]);

watch(
	[
		() => props.data,
		() => props.horizontal,
		() => props.decimals,
		() => props.color,
		() => props.showAxisLabels,
		() => props.conditionalFill,
		() => props.xAxisDisplayField,
	],
	() => {
		// Backoffice: setUpChart destroys the previous chart after the lazy load
		setUpChart();
	},
	{ deep: true },
);

onMounted(setUpChart);

onUnmounted(() => {
	unmounted = true;
	chart.value?.destroy();
});

const formatNumericValue = (val: any) => {
	if (typeof val === 'number') return n(val);
	return val;
};

// Backoffice (D-108): the Directus option default `var(--theme--primary)` maps to the chart theme token.
const themeColor = (color: string) => (color === 'var(--theme--primary)' ? THEME.primary : color);

const isTwoQueryResult = computed(() => {
	return (
		Array.isArray(props.data) && props.data.length === 2 && Array.isArray(props.data[0]) && Array.isArray(props.data[1])
	);
});

const aggregatedData = computed(() => {
	if (isTwoQueryResult.value) {
		return (props.data as [Record<string, any>[], Record<string, any>[]])[0];
	}

	return props.data as Record<string, any>[];
});

const displayValueMap = computed(() => {
	if (!isTwoQueryResult.value || !props.xAxisDisplayField) return null;

	const displayData = (props.data as [Record<string, any>[], Record<string, any>[]])[1];
	const map = new Map<string, string>();

	if (!displayData || displayData.length === 0) return null;

	// Infer the primary key field - it's the field that isn't the display field
	const firstItem = displayData[0];
	const fields = Object.keys(firstItem ?? {});
	const pkField = fields.find((f) => f !== props.xAxisDisplayField);
	if (!pkField) return null;

	for (const item of displayData) {
		const pk = item[pkField];
		const displayValue = item[props.xAxisDisplayField];

		if (pk !== null && pk !== undefined && displayValue !== null && displayValue !== undefined) {
			map.set(String(pk), String(displayValue));
		}
	}

	return map;
});

const getDisplayValue = (rawValue: any) => {
	if (!displayValueMap.value || rawValue === null || rawValue === undefined) {
		return rawValue;
	}

	return displayValueMap.value.get(String(rawValue)) ?? rawValue;
};

async function setUpChart() {
	const rows: (string | number | null)[][] = [];

	const metrics = aggregatedData.value
		.map((metric) => {
			const rawX = metric['group']?.[props.xAxis];
			if (!rawX) return null;

			// Use display value if available, otherwise fall back to raw value
			const x = getDisplayValue(rawX);

			const yValue = props.function ? Number(metric?.[props.function]?.[props.yAxis]) : Number(metric?.[props.yAxis]);
			const y = props.decimals >= 0 ? yValue.toFixed(props.decimals) : yValue;
			if (isNaN(yValue)) return null;

			rows.push([x, Number(y)]);

			return {
				fillColor: getFillColor(x, y),
				x: formatNumericValue(x),
				y,
			};
		})
		.filter((metric) => metric) as Record<string, any>[];

	tableRows.value = rows;

	const ApexChartsClass = await loadApexCharts();
	if (unmounted) return;
	chart.value?.destroy();

	chart.value = new ApexChartsClass(chartEl.value, {
		chart: {
			animations: {
				// Directus value (off); reduced motion is therefore already honoured
				enabled: false,
			},
			type: 'bar',
			height: '100%',
			width: '100%',
			toolbar: { show: false },
			fontFamily: THEME.fontFamily,
			foreColor: THEME.foregroundSubdued,
			selection: { enabled: false },
			zoom: { enabled: false },
		},
		states: {
			normal: { filter: { type: 'none' } },
			hover: { filter: { type: 'none' } },
			active: { filter: { type: 'none' } },
		},
		series: [{ data: metrics }],
		fill: {
			type: 'solid',
			opacity: 1,
		},
		grid: {
			borderColor: THEME.borderColorSubdued,
			padding: {
				top: props.showHeader ? -20 : -5,
				bottom: 5,
				left: 10,
				right: 20,
			},
			xaxis: {
				lines: {
					show: props.horizontal,
				},
			},
			yaxis: {
				lines: {
					show: !props.horizontal,
				},
			},
		},
		plotOptions: {
			dataLabels: {
				enabled: false,
			},
			bar: {
				borderRadius: 4,
				horizontal: props.horizontal,
				columnWidth: '67%',
				barHeight: '67%',
			},
		},
		dataLabels: {
			enabled: props.showDataLabel,
			formatter: formatNumericValue,
		},
		tooltip: {
			marker: {
				show: false,
			},
			x: {
				formatter: (value: any) => formatNumericValue(value) + ': ',
			},
			y: {
				title: {
					formatter: () => yAxisLabel.value + ': ',
				},
				formatter: formatNumericValue,
			},
		},
		xaxis: {
			type: 'category',
			toolbar: false,
			axisBorder: {
				show: !props.horizontal,
				height: 0.5,
				width: '1px',
				color: THEME.borderColorSubdued,
			},
			axisTicks: {
				show: false,
			},
			labels: {
				show: ['both', 'xOnly'].includes(props.showAxisLabels),
				rotate: 0,
				showDuplicates: true,
				style: {
					fontFamily: THEME.fontFamily,
					foreColor: THEME.foregroundSubdued,
					fontWeight: 600,
					fontSize: '0.5625rem',
				},
				trim: true,
				hideOverlappingLabels: true,
			},
			dataLabels: {
				formatter: formatNumericValue,
				orientation: 'horizontal',
				hideOverflowingLabels: true,
			},
		},
		yaxis: {
			forceNiceScale: true,
			tickAmount: 0,
			axisBorder: {
				show: props.horizontal,
				height: 0.5,
				width: '1px',
				color: THEME.borderColorSubdued,
			},
			axisTicks: {
				show: false,
			},
			labels: {
				show: ['both', 'yOnly'].includes(props.showAxisLabels),
				formatter: formatNumericValue,
				style: {
					fontFamily: THEME.fontFamily,
					foreColor: THEME.foregroundSubdued,
					fontWeight: 600,
					fontSize: '0.5625rem',
				},
			},
		},
	});

	chart.value.render();

	function getFillColor(x: string | number, y: string | number) {
		let fillColor = themeColor(props.color || THEME.primary);
		if (isNil(x) || isNil(y) || !props.conditionalFill?.length) return fillColor;

		for (const format of props.conditionalFill) {
			const shouldChangeFillColor = checkMatchingConditionalFill(format);
			if (shouldChangeFillColor) fillColor = themeColor(format.color);
		}

		return fillColor;

		function checkMatchingConditionalFill(format: ConditionalFillFormat): boolean {
			let value: string | number;
			let compareValue: string | number;

			if (format.axis === 'X') {
				value = x.toString();
				compareValue = format.value;
			} else {
				value = y;
				const formatValue = Number(format.value ?? 0);
				if (isNaN(formatValue)) return false;
				compareValue = formatValue;
			}

			switch (format.operator || '>=') {
				case '=':
					return value === compareValue;
				case '!=':
					return value !== compareValue;
				case '>':
					return Number(value) > compareValue;
				case '>=':
					return Number(value) >= compareValue;
				case '<':
					return Number(value) < compareValue;
				case '<=':
					// Backoffice (D-113, owner 2026-10-18): Directus compares `<=` with `<` and the string operators the
					// other way round (`compareValue.includes(value)`, R-53); here the bar's value is tested against the rule.
					return Number(value) <= compareValue;
				case 'contains':
					return typeof compareValue === 'string' && typeof value === 'string'
						? (value as string).includes(compareValue as string)
						: false;
				case 'ncontains':
					return typeof compareValue === 'string' && typeof value === 'string'
						? !(value as string).includes(compareValue as string)
						: false;
				case 'starts_with':
					return typeof compareValue === 'string' && typeof value === 'string'
						? (value as string).startsWith(compareValue as string)
						: false;
				case 'nstarts_with':
					return typeof compareValue === 'string' && typeof value === 'string'
						? !(value as string).startsWith(compareValue as string)
						: false;
				case 'istarts_with':
					return typeof compareValue === 'string' && typeof value === 'string'
						? (value as string).toLocaleLowerCase().startsWith((compareValue as string).toLocaleLowerCase())
						: false;
				case 'nistarts_with':
					return typeof compareValue === 'string' && typeof value === 'string'
						? !(value as string).toLocaleLowerCase().startsWith((compareValue as string).toLocaleLowerCase())
						: false;
				case 'ends_with':
					return typeof compareValue === 'string' && typeof value === 'string'
						? (value as string).endsWith(compareValue as string)
						: false;
				case 'nends_with':
					return typeof compareValue === 'string' && typeof value === 'string'
						? !(value as string).endsWith(compareValue as string)
						: false;
				case 'iends_with':
					return typeof compareValue === 'string' && typeof value === 'string'
						? (value as string).toLocaleLowerCase().endsWith((compareValue as string).toLocaleLowerCase())
						: false;
				case 'niends_with':
					return typeof compareValue === 'string' && typeof value === 'string'
						? !(value as string).toLocaleLowerCase().endsWith((compareValue as string).toLocaleLowerCase())
						: false;
				default:
					return false;
			}
		}
	}
}
</script>

<template>
	<div class="h-full w-full p-0">
		<div ref="chartEl" aria-hidden="true" />
		<ChartTable :columns="tableColumns" :rows="tableRows" />
	</div>
</template>
