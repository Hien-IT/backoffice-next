<!-- Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/components/extension-metadata-downloads-sparkline.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-43): ApexCharts loaded lazily as the 018 panels (loadApexCharts, unmount guard); the theme
// variables become the brand token (stroke brand-500, the same color at 15% for the area, readable in both modes,
// so no redraw on the color scheme); the chart is aria-hidden with an sr-only table of the weekly counts (ChartTable).
import type ApexCharts from 'apexcharts';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ChartTable from '../../../../../panels/shared/ChartTable.vue';
import { loadApexCharts } from '../../../../../panels/shared/apex-charts.ts';
import { cssVar } from '../../../../../utils/css-var.ts';

const props = defineProps<{
	downloads: {
		count: number;
		date: string;
	}[];
}>();

const { t } = useI18n();

const chartEl = ref<HTMLElement>();
const chart = ref<ApexCharts>();
let unmounted = false;

const initChart = async () => {
	const ApexChartsClass = await loadApexCharts();
	if (unmounted) return;
	chart.value?.destroy();

	const primary = cssVar('--color-brand-500');

	chart.value = new ApexChartsClass(chartEl.value, {
		colors: [primary],
		chart: {
			type: 'area',
			animations: {
				enabled: false,
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
			sparkline: {
				enabled: true,
			},
		},
		fill: {
			type: 'solid',
			colors: [primary],
			opacity: 0.15,
		},
		series: [
			{
				name: 'downloads',
				data: props.downloads.map(({ count }) => count),
			},
		],
		stroke: {
			curve: 'monotoneCubic',
			width: 1,
			lineCap: 'butt',
		},
		tooltip: {
			enabled: false,
		},
		dataLabels: {
			enabled: false,
		},
		grid: {
			padding: {
				top: 10,
				bottom: 4,
				left: 0,
				right: 0,
			},
		},
	});

	chart.value.render();
};

watch(
	() => props.downloads,
	() => {
		initChart();
	},
);

onMounted(() => {
	initChart();
});

onUnmounted(() => {
	unmounted = true;
	chart.value?.destroy();
});
</script>

<template>
	<div class="h-12">
		<div ref="chartEl" class="h-full" aria-hidden="true" />
		<ChartTable :columns="[t('date'), t('downloads')]" :rows="downloads.map(({ date, count }) => [date, count])" />
	</div>
</template>
