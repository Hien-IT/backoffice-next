<!-- Ported from directus/app/src/panels/line-chart/panel-line-chart.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-047..FR-050, recipe Q-35): ApexCharts loaded lazily (loadApexCharts) with an unmount/race
// guard; Directus theme variables replaced by the chart theme tokens (THEME, D-108 default color, resolved with cssVar
// for the mono theme generator); animations follow prefers-reduced-motion; the chart is aria-hidden with an sr-only
// ChartTable of the plotted values (FR-106); the global tooltip styles live in styles/apexcharts.css. Series and
// categories are built like Directus (values passed raw).
import type { Filter } from '@directus/types';
import { abbreviateNumber } from '@directus/utils';
import type ApexCharts from 'apexcharts';
import { isNil } from 'lodash-es';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFieldsStore } from '../../stores/fields.ts';
import { cssVar } from '../../utils/css-var.ts';
import ChartTable from '../shared/ChartTable.vue';
import { loadApexCharts, THEME, prefersReducedMotion } from '../shared/apex-charts.ts';
import { monoThemeGenerator } from '../shared/color-generator.ts';

type PanelFunction = 'count' | 'countDistinct' | 'avg' | 'avgDistinct' | 'sum' | 'sumDistinct' | 'min' | 'max';

/* eslint-disable vue/require-default-prop -- the optional props have no default in Directus either */
const props = withDefaults(
	defineProps<{
		showHeader?: boolean;
		height: number;
		collection: string;
		data?: Record<string, any>[];
		aggregation?: string;
		grouping?: string;
		xAxis?: string;
		function: PanelFunction;
		yAxis: string;
		color?: string;
		filter?: Filter;
		decimals?: number;
		showAxisLabels?: string;
		showLegend?: boolean;
		showMarker?: boolean;
		curveType?: string;
		fillType?: string;
		width: number;
		min?: number;
		max?: number;
	}>(),
	{
		showHeader: false,
		data: () => [],
		showAxisLabels: 'both',
		showLegend: false,
		showMarker: true,
		curveType: 'smooth',
		decimals: 2,
		color: THEME.primary,
		fillType: 'gradient',
	},
);
/* eslint-enable vue/require-default-prop */

const { t, n } = useI18n();

const fieldsStore = useFieldsStore();

const chartEl = ref<HTMLElement>();
const chart = ref<ApexCharts>();
const tableColumns = ref<string[]>([]);
const tableRows = ref<(string | number | null)[][]>([]);
let unmounted = false;

onMounted(setUpChart);

watch(
	[
		() => props.data,
		() => props.color,
		() => props.fillType,
		() => props.curveType,
		() => props.decimals,
		() => props.min,
		() => props.max,
		() => props.width,
		() => props.height,
		() => props.showAxisLabels,
		() => props.showLegend,
		() => props.showMarker,
		() => props.min,
		() => props.max,
	],
	() => {
		// Backoffice: setUpChart destroys the previous chart after the lazy load
		setUpChart();
	},
	{ deep: true },
);

onUnmounted(() => {
	unmounted = true;
	chart.value?.destroy();
});

const yAxisRange = computed(() => {
	let min = isNil(props.min) ? undefined : Number(props.min);
	let max = isNil(props.max) ? undefined : Number(props.max);

	if (max !== undefined && !min) {
		min = 0;
	}

	if (max !== undefined && min !== undefined && max < min) {
		max = min;
		min = Number(props.max);
	}

	return { max, min };
});

async function setUpChart() {
	if (props.aggregation && !props.xAxis) return;

	const categories = [...new Set(props.data.map((d) => d['group'][props.xAxis!]))]; // get the unique categories

	let series: any = [];

	if (props.grouping) {
		const seriesDifferentiators = [...new Set(props.data.map((d) => d['group'][props.grouping!]))]; // get the unique category differentiators

		series = seriesDifferentiators.map((differentiator: string) => {
			const seriesData = props.data.filter((item) => item['group'][props.grouping!] == differentiator);

			return {
				name: differentiator,
				data: seriesData.map((item) => item[props.aggregation!][props.yAxis!]),
			};
		});
	} else {
		series = [
			{
				name: props.yAxis,
				data: props.data.map((item) => item[props.aggregation!][props.yAxis!]),
			},
		];
	}

	tableColumns.value = [
		props.xAxis ? (fieldsStore.getField(props.collection, props.xAxis)?.name ?? props.xAxis) : '',
		...series.map((serie: any) => String(serie.name)),
	];

	tableRows.value = categories.map((category, index) => [
		category,
		...series.map((serie: any) => serie.data[index] ?? null),
	]);

	// Backoffice (D-108): the Directus option default `var(--theme--primary)` maps to the chart theme token.
	const color = props.color === 'var(--theme--primary)' ? THEME.primary : props.color;

	// Generate monochrome color scheme
	const colors = monoThemeGenerator(
		color && color.startsWith('var(--')
			? cssVar(color.substring(4, color.length - 1))
			: (color ?? cssVar('--color-brand-500')),
		series.length,
	);

	const isSparkline = props.width < 12 || props.height < 10;

	const ApexChartsClass = await loadApexCharts();
	if (unmounted) return;
	chart.value?.destroy();

	chart.value = new ApexChartsClass(chartEl.value, {
		colors: colors,
		chart: {
			type: props.fillType === 'disabled' ? 'line' : 'area',
			// Backoffice: Directus sets the unknown key `animation` (so ApexCharts animates); reduced motion turns it off
			animations: {
				enabled: !prefersReducedMotion(),
			},
			height: '100%',
			width: '100%',
			dropShadow: {
				enabled: false,
			},
			toolbar: {
				show: false,
			},
			selection: {
				enabled: false,
			},
			zoom: {
				enabled: false,
			},
			fontFamily: THEME.fontFamily,
			foreColor: THEME.foregroundSubdued,
			sparkline: {
				enabled: isSparkline,
			},
		},
		series: series,
		stroke: {
			curve: props.curveType,
			width: 2,
			lineCap: 'round',
		},

		tooltip: {
			theme: 'light',
			marker: {
				show: props.showMarker,
			},
			x: {
				formatter: (index: number) => {
					if (!index) return;
					return `${categories[index - 1]}:`;
				},
			},
			y: {
				title: {
					formatter: (columnName: string | number) => {
						if (!columnName) return;

						const field = fieldsStore.getField(props.collection, String(columnName));
						if (field) return field.name;

						if (isNaN(Number(columnName))) return `${t(String(columnName))}:`;
						return `${n(Number(columnName))}:`;
					},
				},
				formatter(value: number) {
					if (!value) return;

					return n(value);
				},
			},
		},
		dataLabels: {
			enabled: false,
		},
		grid: {
			borderColor: THEME.borderColorSubdued,
			padding: isSparkline
				? {
						top: props.showHeader ? 0 : 5,
						bottom: 5,
						left: 0,
						right: 0,
					}
				: {
						top: props.showHeader ? -20 : -2,
						bottom: 0,
						left: 12,
						right: 12,
					},
		},
		markers: {
			colors: colors,
			strokeColors: colors,
		},
		fill: {
			type: props.fillType === 'disabled' ? 'solid' : props.fillType,
			gradient: {
				colorStops: colors.map((color) => {
					return [
						{
							offset: 0,
							color: color,
							opacity: 0.25,
						},
						{
							offset: 100,
							color: color,
							opacity: 0,
						},
					];
				}),
			},
		},
		xaxis: {
			categories,
			type: 'category',
			toolbar: false,
			tooltip: {
				enabled: false,
			},
			axisTicks: {
				show: false,
			},
			axisBorder: {
				show: false,
			},
			labels: {
				show: ['both', 'xAxis'].includes(props.showAxisLabels),
				offsetY: -4,
				style: {
					fontFamily: THEME.fontFamily,
					foreColor: THEME.foregroundSubdued,
					fontWeight: 600,
					fontSize: '0.5625rem',
				},
			},
			crosshairs: {
				stroke: {
					// Backoffice: --theme--form--field--input--border-color → border token
					color: THEME.borderColor,
				},
			},
		},
		yaxis: {
			show: ['both', 'yAxis'].includes(props.showAxisLabels),
			forceNiceScale: true,
			tickAmount: props.height - 4,
			axisBorder: {
				show: false,
			},
			axisTicks: {
				show: false,
			},
			min: yAxisRange.value.min,
			max: yAxisRange.value.max,
			labels: {
				show: ['both', 'yAxis'].includes(props.showAxisLabels),
				formatter: (value: number) => {
					return value > 10000
						? abbreviateNumber(value, 1)
						: n(value, 'decimal', {
								minimumFractionDigits: 0,
								maximumFractionDigits: props.decimals,
							} as any);
				},
				style: {
					fontFamily: THEME.fontFamily,
					foreColor: THEME.foregroundSubdued,
					fontWeight: 600,
					fontSize: '0.5625rem',
				},
			},
		},
		legend: {
			show: props.showLegend && !isSparkline,
			position: 'bottom',
			offsetY: -4,
			markers: {
				width: 8,
				height: 8,
			},
			fontFamily: THEME.fontFamily,
			foreColor: THEME.foreground,
			fontWeight: 600,
			fontSize: '0.5625rem',
		},
	});

	chart.value.render();
}
</script>

<template>
	<div class="h-full w-full p-0">
		<div ref="chartEl" aria-hidden="true" />
		<ChartTable :columns="tableColumns" :rows="tableRows" />
	</div>
</template>
