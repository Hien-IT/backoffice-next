<!-- Ported from directus/app/src/panels/time-series/panel-time-series.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-047..FR-050, recipe Q-35): ApexCharts loaded lazily (loadApexCharts) with an unmount/race
// guard; Directus theme variables replaced by the chart theme tokens (THEME, D-108 default color); animations stay off
// like Directus; the chart is aria-hidden with an sr-only ChartTable of the plotted points (ISO date, value; FR-106);
// the global tooltip styles live in styles/apexcharts.css. Date parsing, fillGaps (at most 2 points per gap), the `now`
// range and the nested yaxis options are Directus' unchanged.
import type { Filter } from '@directus/types';
import { abbreviateNumber, adjustDate } from '@directus/utils';
import type ApexCharts from 'apexcharts';
import { addWeeks } from 'date-fns';
import { isNil, orderBy, snakeCase } from 'lodash-es';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFieldsStore } from '../../stores/fields.ts';
import ChartTable from '../shared/ChartTable.vue';
import { loadApexCharts, THEME } from '../shared/apex-charts.ts';

type PanelFunction = 'count' | 'countDistinct' | 'avg' | 'avgDistinct' | 'sum' | 'sumDistinct' | 'min' | 'max';

const props = withDefaults(
	defineProps<{
		height: number;
		showHeader?: boolean;
		data?: {
			group: Record<string, number | string>;
			count: Record<string, number>;
			countDistinct: Record<string, number>;
			avg: Record<string, number>;
			avgDistinct: Record<string, number>;
			sum: Record<string, number>;
			sumDistinct: Record<string, number>;
			min: Record<string, number>;
			max: Record<string, number>;
		}[];
		id: string;
		now: Date;
		collection: string;
		dateField: string;
		valueField: string;
		function: PanelFunction;
		precision?: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
		range?: string;
		color?: string | null;
		fillType?: string;
		curveType?: string;
		decimals?: number;
		min?: number | undefined; // Backoffice: `| undefined` for the explicit undefined defaults (exactOptionalPropertyTypes)
		max?: number | undefined;
		filter?: Filter;
		showXAxis?: boolean;
		showYAxis?: boolean;
		missingData?: 'null' | 'ignore' | string;
	}>(),
	{
		showHeader: false,
		data: () => [],
		precision: 'hour',
		color: THEME.primary,
		range: '1 week',
		fillType: 'gradient',
		curveType: 'smooth',
		decimals: 0,
		min: undefined,
		max: undefined,
		filter: () => ({}),
		showXAxis: true,
		showYAxis: true,
		missingData: 'null',
	},
);

const { d, t, n } = useI18n();

const fieldsStore = useFieldsStore();

type DateMetric = { x: number; y: number | null };
const metrics = ref<DateMetric[]>([]);
const chartEl = ref<HTMLElement>();
const chart = ref<ApexCharts>();
let unmounted = false;

const valueLabel = computed(() => {
	// Backoffice: optional chaining, the label is also the table header (rendered eagerly, Directus reads it in the tooltip)
	const field = fieldsStore.getField(props.collection, props.valueField);
	const operation = t(snakeCase(props.function));
	return `${field?.name} (${operation})`;
});

const tableColumns = computed(() => [
	fieldsStore.getField(props.collection, props.dateField)?.name ?? props.dateField,
	valueLabel.value,
]);

const tableRows = computed(() => metrics.value.map((metric) => [new Date(metric.x).toISOString(), metric.y]));

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

watch(
	[
		() => props.data,
		() => props.color,
		() => props.fillType,
		() => props.curveType,
		() => props.decimals,
		() => props.min,
		() => props.max,
		() => props.showXAxis,
		() => props.showYAxis,
		() => props.missingData,
	],
	() => {
		// Backoffice: setupChart destroys the previous chart after the lazy load
		setupChart();
	},
	{ deep: true },
);

onMounted(setupChart);

onUnmounted(() => {
	unmounted = true;
	chart.value?.destroy();
});

function fillGaps(data: DateMetric[], precision: typeof props.precision): DateMetric[] {
	if (props.missingData === 'ignore') return data;
	if (data.length === 0 || !data[0]) return [];

	const result = [data[0]];

	for (const [index, current] of data.entries()) {
		if (index === 0) continue;
		const prev = data[index - 1];
		if (!prev || !current) continue;

		const prevDate = new Date(prev.x);
		const currentDate = new Date(current.x);

		const expectedNextDate = adjustDate(prevDate, '1 ' + precision);
		const expectedPrevDate = adjustDate(currentDate, '-1 ' + precision);

		let filler;

		if (props.missingData === 'null') {
			filler = null;
		} else if (props.missingData === '0') {
			filler = 0;
		} else {
			const parsedNumber = Number(props.missingData);
			filler = isNaN(parsedNumber) ? null : parsedNumber;
		}

		if (expectedNextDate && expectedPrevDate && expectedNextDate.getTime() < current.x) {
			result.push({ x: expectedNextDate.getTime(), y: filler });

			if (
				expectedNextDate.getTime() !== expectedPrevDate.getTime() &&
				expectedNextDate.getTime() < expectedPrevDate.getTime()
			) {
				result.push({ x: expectedPrevDate.getTime(), y: filler });
			}
		}

		result.push(current);
	}

	return result;
}

async function setupChart() {
	metrics.value = [];

	const isFieldTimestamp = fieldsStore.getField(props.collection, props.dateField)?.type === 'timestamp';

	const allDates = props.data.map((metric) => {
		return toIncludeTimezoneOffset(metric.group, isFieldTimestamp);
	});

	const minDate = Math.min(...allDates);
	const maxDate = Math.max(...allDates);

	let series = orderBy(
		props.data.map((metric) => ({
			x: toIncludeTimezoneOffset(metric.group, isFieldTimestamp),
			y: Number(Number(metric[props.function][props.valueField]).toFixed(props.decimals ?? 0)),
		})),
		'x',
	) as DateMetric[];

	if (series.length > 0 && props.precision) {
		series = fillGaps(series, props.precision);
	}

	metrics.value = series;

	// Backoffice (D-108): the Directus option default `var(--theme--primary)` maps to the chart theme token.
	const color = props.color === 'var(--theme--primary)' ? THEME.primary : props.color;

	const ApexChartsClass = await loadApexCharts();
	if (unmounted) return;
	chart.value?.destroy();

	chart.value = new ApexChartsClass(chartEl.value, {
		colors: [color ? color : THEME.primary],
		chart: {
			type: props.fillType === 'disabled' ? 'line' : 'area',
			height: '100%',
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
			animations: {
				// Directus value (off); reduced motion is therefore already honoured
				enabled: false,
			},
		},
		series: [
			{
				name: props.collection,
				data: metrics.value,
			},
		],
		stroke: {
			curve: props.curveType,
			width: 2,
			lineCap: 'round',
		},
		markers: {
			hover: {
				size: undefined,
				sizeOffset: 4,
			},
		},
		fill: {
			type: props.fillType === 'disabled' ? 'solid' : props.fillType,
			gradient: {
				colorStops: [
					[
						{
							offset: 0,
							color: color ? color : THEME.primary,
							opacity: 0.25,
						},
						{
							offset: 100,
							color: color ? color : THEME.primary,
							opacity: 0,
						},
					],
				],
			},
		},
		grid: {
			borderColor: THEME.borderColorSubdued,
			padding: {
				top: props.showHeader ? -20 : -4,
				bottom: 0,
				left: 8,
			},
		},
		dataLabels: {
			enabled: false,
		},
		tooltip: {
			marker: {
				show: false,
			},
			x: {
				show: true,
				formatter(date: number) {
					return d(new Date(date), 'long');
				},
			},
			y: {
				title: {
					formatter: () => valueLabel.value + ': ',
				},
				formatter(value: number) {
					return n(value);
				},
			},
		},
		xaxis: {
			type: 'datetime',
			tooltip: {
				enabled: false,
			},
			axisTicks: {
				show: false,
			},
			axisBorder: {
				show: false,
			},
			range:
				props.range === 'auto'
					? maxDate - minDate
					: props.now.getTime() - adjustDate(props.now, `-${props.range}`)!.getTime(),
			max: props.range === 'auto' ? maxDate : props.now.getTime(),
			labels: {
				show: props.showXAxis ?? true,
				offsetY: -4,
				style: {
					fontFamily: THEME.fontFamily,
					foreColor: THEME.foregroundSubdued,
					fontWeight: 600,
					fontSize: '0.5625rem',
				},
				datetimeUTC: false,
			},
			crosshairs: {
				stroke: {
					// Backoffice: --theme--form--field--input--border-color → border token
					color: THEME.borderColor,
				},
			},
		},
		yaxis: {
			show: props.showYAxis ?? true,
			forceNiceScale: true,
			min: isNil(props.min) ? undefined : Number(props.min),
			max: isNil(props.max) ? undefined : Number(props.max),
			tickAmount: props.height - 4,
			labels: {
				offsetY: 1,
				offsetX: -4,
				formatter: (value: number) => {
					return value > 10000
						? abbreviateNumber(value, 1)
						: n(value, 'decimal', {
								minimumFractionDigits: props.decimals ?? 0,
								maximumFractionDigits: props.decimals ?? 0,
							} as any);
				},
				yaxis: {
					show: props.showYAxis ?? true,
					forceNiceScale: true,
					min: yAxisRange.value.min,
					max: yAxisRange.value.max,
					tickAmount: props.height - 4,
					labels: {
						offsetY: 1,
						offsetX: -4,
						formatter: (value: number) => {
							return value > 10000
								? abbreviateNumber(value, 1)
								: n(value, 'decimal', {
										minimumFractionDigits: props.decimals ?? 0,
										maximumFractionDigits: props.decimals ?? 0,
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
			},
		},
	});

	chart.value.render();

	function toIncludeTimezoneOffset(time: Record<string, any>, isFieldTimestamp: boolean): number {
		return new Date(toISO(time)).getTime() - (isFieldTimestamp ? new Date().getTimezoneOffset() * 60 * 1000 : 0);
	}

	function toISO(metric: Record<string, any>) {
		const year = metric[`${props.dateField}_year`];
		const month = padZero(metric[`${props.dateField}_month`] ?? 1);
		const week = metric[`${props.dateField}_week`];
		const day = week ? padZero(getFirstDayOfNWeeksForYear(week, year)) : padZero(metric[`${props.dateField}_day`] ?? 1);
		const hour = padZero(metric[`${props.dateField}_hour`] ?? 0);
		const minute = padZero(metric[`${props.dateField}_minute`] ?? 0);
		const second = padZero(metric[`${props.dateField}_second`] ?? 0);

		return `${year}-${month}-${day}T${hour}:${minute}:${second}`;

		function padZero(value: number) {
			return String(value).padStart(2, '0');
		}

		function getFirstDayOfNWeeksForYear(numberOfWeeks: number, year: number) {
			return addWeeks(new Date(year, 0, 1), numberOfWeeks).getDate();
		}
	}
}
</script>

<template>
	<div class="h-full w-full">
		<div ref="chartEl" aria-hidden="true" />
		<ChartTable :columns="tableColumns" :rows="tableRows" />
	</div>
</template>
