// Chart panels of spec 018 (FR-047..FR-050, FR-106): the ApexCharts options and the sr-only data table built from the
// Directus GraphQL aggregate results, with the Directus quirks kept (panel-bar-chart.vue, panel-line-chart.vue,
// panel-pie-chart.vue, panel-time-series.vue).
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Component } from 'vue';
import { i18n } from '../lang/index.ts';
import { useFieldsStore } from '../stores/fields.ts';
import '../styles/index.css';
import PanelBarChart from './bar-chart/PanelBarChart.vue';
import PanelLineChart from './line-chart/PanelLineChart.vue';
import PanelPieChart from './pie-chart/PanelPieChart.vue';
import PanelTimeSeries from './time-series/PanelTimeSeries.vue';

enableAutoUnmount(afterEach);

beforeEach(() => {
	setActivePinia(createPinia());
	useFieldsStore().fields = [
		{ collection: 'orders', field: 'status', name: 'Status', type: 'string' },
		{ collection: 'orders', field: 'amount', name: 'Amount', type: 'float' },
		{ collection: 'orders', field: 'month', name: 'Month', type: 'integer' },
		{ collection: 'orders', field: 'created', name: 'Created', type: 'dateTime' },
	] as never;
});

async function mountChart(component: Component, props: Record<string, unknown>) {
	const host = document.createElement('div');
	host.style.cssText = 'width: 480px; height: 320px';
	document.body.append(host);

	const wrapper = mount(component, { props, global: { plugins: [i18n] }, attachTo: host });
	await vi.waitFor(() => expect(wrapper.find('.apexcharts-canvas').exists()).toBe(true));
	return wrapper;
}

function table(wrapper: Awaited<ReturnType<typeof mountChart>>) {
	return {
		columns: wrapper.findAll('[data-chart-table] th').map((th) => th.text()),
		rows: wrapper
			.findAll('[data-chart-table] tbody tr')
			.map((tr) => tr.findAll('td').map((td) => td.attributes('data-value'))),
	};
}

/** The ApexCharts options the panel built (script-setup state exposed by test-utils). */
function config(wrapper: Awaited<ReturnType<typeof mountChart>>): Record<string, any> {
	return (wrapper.vm as any).chart.w.config;
}

describe('bar-chart', () => {
	const base = { height: 10, collection: 'orders', xAxis: 'status', yAxis: 'amount', function: 'sum' };

	test('table lists the label and the rounded value; falsy groups are dropped; chart is aria-hidden', async () => {
		const wrapper = await mountChart(PanelBarChart, {
			...base,
			data: [
				{ group: { status: 'published' }, sum: { amount: 30.5 } },
				{ group: { status: 'draft' }, sum: { amount: null } },
				{ group: { status: null }, sum: { amount: 99 } },
			],
		});

		expect(table(wrapper)).toEqual({
			columns: ['Status', 'Amount (Sum)'],
			rows: [
				['published', '30.5'],
				['draft', '0'],
			],
		});

		expect(wrapper.find('[aria-hidden="true"] .apexcharts-canvas').exists()).toBe(true);
		expect(config(wrapper)['series'][0].data.map((point: any) => point.y)).toEqual(['30.50', '0.00']);
	});

	test('color null falls back to the chart theme token; `<=` includes the value (D-113)', async () => {
		const wrapper = await mountChart(PanelBarChart, {
			...base,
			color: null,
			conditionalFill: [{ axis: 'Y', operator: '<=', value: 10, color: 'rgb(1, 2, 3)' }],
			data: [
				{ group: { status: 'ten' }, sum: { amount: 10 } },
				{ group: { status: 'five' }, sum: { amount: 5 } },
			],
		});

		expect(config(wrapper)['series'][0].data.map((point: any) => point.fillColor)).toEqual([
			'rgb(1, 2, 3)',
			'rgb(1, 2, 3)',
		]);
	});

	test('X-axis contains: the label contains the rule value (D-113; Directus compares the other way round)', async () => {
		const wrapper = await mountChart(PanelBarChart, {
			...base,
			conditionalFill: [{ axis: 'X', operator: 'contains', value: 'published-and-more', color: 'rgb(4, 5, 6)' }],
			data: [
				{ group: { status: 'published' }, sum: { amount: 1 } },
				{ group: { status: 'published-and-more-x' }, sum: { amount: 2 } },
			],
		});

		expect(config(wrapper)['series'][0].data.map((point: any) => point.fillColor)).toEqual([
			'var(--chart-primary)',
			'rgb(4, 5, 6)',
		]);
	});

	test('two-query result: the label is the display field of the related item', async () => {
		const wrapper = await mountChart(PanelBarChart, {
			...base,
			xAxisDisplayField: 'title',
			data: [[{ group: { status: 7 }, sum: { amount: 3 } }], [{ id: 7, title: 'Seven' }]],
		});

		expect(table(wrapper).rows).toEqual([['Seven', '3']]);
	});
});

describe('line-chart', () => {
	const data = [
		{ group: { month: 1, status: 'a' }, sum: { amount: 10 } },
		{ group: { month: 1, status: 'b' }, sum: { amount: 20 } },
		{ group: { month: 2, status: 'a' }, sum: { amount: 15 } },
		{ group: { month: 2, status: 'b' }, sum: { amount: 25 } },
	];
	const base = { height: 20, width: 20, collection: 'orders', aggregation: 'sum', xAxis: 'month', yAxis: 'amount' };

	test('grouping makes one series per group with the raw values', async () => {
		const wrapper = await mountChart(PanelLineChart, { ...base, function: 'sum', grouping: 'status', data });

		expect(table(wrapper)).toEqual({
			columns: ['Month', 'a', 'b'],
			rows: [
				['1', '10', '20'],
				['2', '15', '25'],
			],
		});

		expect(config(wrapper)['series']).toMatchObject([
			{ name: 'a', data: [10, 15] },
			{ name: 'b', data: [20, 25] },
		]);

		expect(config(wrapper)['colors']).toHaveLength(2);
	});

	test('without grouping one series named after the y field; default color resolved from the theme token', async () => {
		const wrapper = await mountChart(PanelLineChart, {
			...base,
			function: 'sum',
			data: [
				{ group: { month: 1 }, sum: { amount: 3 } },
				{ group: { month: 2 }, sum: { amount: 4 } },
			],
		});

		expect(table(wrapper)).toEqual({
			columns: ['Month', 'amount'],
			rows: [
				['1', '3'],
				['2', '4'],
			],
		});
		expect(config(wrapper)['colors'][0]).toBe(
			getComputedStyle(document.body).getPropertyValue('--chart-primary').trim(),
		);
	});
});

describe('pie-chart', () => {
	const base = { height: 20, width: 20, gridSize: 20, collection: 'orders', column: 'status', function: 'count' };
	const data = [
		{ group: { status: 'published' }, count: { status: 3 } },
		{ group: { status: 'draft' }, count: { status: 1 } },
	];

	test('decimals 0: series are the raw values; table lists label and raw value', async () => {
		const wrapper = await mountChart(PanelPieChart, { ...base, data });

		expect(config(wrapper)['series']).toEqual([3, 1]);
		expect(table(wrapper)).toEqual({
			columns: ['Status', 'Count'],
			rows: [
				['published', '3'],
				['draft', '1'],
			],
		});
	});

	test('decimals > 0: series are ×100 but the table keeps the raw values', async () => {
		const wrapper = await mountChart(PanelPieChart, { ...base, decimals: 2, data });

		expect(config(wrapper)['series']).toEqual([300, 100]);
		expect(table(wrapper).rows).toEqual([
			['published', '3'],
			['draft', '1'],
		]);
	});
});

describe('time-series', () => {
	const now = new Date('2026-01-10T00:00:00');
	const base = {
		height: 20,
		id: 'p1',
		now,
		collection: 'orders',
		dateField: 'created',
		valueField: 'amount',
		function: 'sum',
		precision: 'hour',
	};
	const point = (hour: number, amount: number) => ({
		group: { created_year: 2026, created_month: 1, created_day: 1, created_hour: hour },
		sum: { amount },
	});
	const iso = (hour: number) => new Date(`2026-01-01T${String(hour).padStart(2, '0')}:00:00`).toISOString();

	test('missingData null fills at most two points per gap; range follows `now`', async () => {
		const wrapper = await mountChart(PanelTimeSeries, { ...base, data: [point(5, 2), point(0, 1)] });

		expect(table(wrapper)).toEqual({
			columns: ['Created', 'Amount (Sum)'],
			rows: [
				[iso(0), '1'],
				[iso(1), ''],
				[iso(4), ''],
				[iso(5), '2'],
			],
		});

		expect(config(wrapper)['xaxis'].max).toBe(now.getTime());
		expect(config(wrapper)['xaxis'].range).toBe(7 * 24 * 3600 * 1000);
	});

	test('missingData as a number fills with that value; ignore keeps the gaps', async () => {
		const filled = await mountChart(PanelTimeSeries, { ...base, missingData: '7', data: [point(0, 1), point(2, 3)] });
		expect(table(filled).rows).toEqual([
			[iso(0), '1'],
			[iso(1), '7'],
			[iso(2), '3'],
		]);

		const ignored = await mountChart(PanelTimeSeries, {
			...base,
			missingData: 'ignore',
			data: [point(0, 1), point(2, 3)],
		});
		expect(table(ignored).rows).toEqual([
			[iso(0), '1'],
			[iso(2), '3'],
		]);
	});

	test('range auto spans the data', async () => {
		const wrapper = await mountChart(PanelTimeSeries, { ...base, range: 'auto', data: [point(0, 1), point(3, 2)] });

		const first = new Date(iso(0)).getTime();
		const last = new Date(iso(3)).getTime();
		expect(config(wrapper)['xaxis'].range).toBe(last - first);
		expect(config(wrapper)['xaxis'].max).toBe(last);
	});
});
