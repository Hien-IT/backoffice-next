// Value panels of spec 018 (FR-042..FR-046): metric, metric-list, meter, label and list, fed with data shaped like the
// DR panel queries (aggregate `[{ count: { id: 12 } }]`, first/last `[{ amount: '12.50' }]`, grouped
// `[{ group: { country }, sum: { amount } }]`). Expected values follow directus/app/src/panels/*/panel-*.vue, quirks
// included: metric(-list) takes the last matching rule, meter the first; `<=` includes the value (D-113, DR
// compares it with `<`).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { type Component, defineComponent, h } from 'vue';
import { replaceQueue } from '../api/sdk.ts';
import { i18n } from '../lang/index.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useInsightsStore } from '../stores/insights.ts';
import '../styles/index.css';
import { calls, mockApi } from '../test-utils/fetch.ts';
import PanelLabel from './label/PanelLabel.vue';
import PanelList from './list/PanelList.vue';
import PanelMeter from './meter/PanelMeter.vue';
import PanelMetricList from './metric-list/PanelMetricList.vue';
import PanelMetric from './metric/PanelMetric.vue';

enableAutoUnmount(afterEach);

const A = 'rgb(1, 2, 3)';
const B = 'rgb(4, 5, 6)';
const C = 'rgb(7, 8, 9)';

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	useFieldsStore().fields = [
		{ collection: 'bo_list', field: 'id', type: 'integer', schema: { is_primary_key: true } },
		{ collection: 'bo_list', field: 'name', type: 'string', schema: {} },
		{ collection: 'bo_orders', field: 'country', type: 'string', schema: {} },
	] as never;
});

function mountPanel(component: Component, props: Record<string, unknown>, stubs: Record<string, Component> = {}) {
	return mount(component, {
		props: { dashboard: 'd1', width: 12, height: 12, showHeader: false, ...props },
		global: { plugins: [i18n], stubs },
		attachTo: document.body,
	});
}

/* ---------------------------------------------------------------------------------------------------------- metric */

const metric = (props: Record<string, unknown>) =>
	mountPanel(PanelMetric, { collection: 'bo_orders', field: 'id', function: 'count', ...props });

test('metric formats the aggregate with prefix, suffix and notation (en-US)', () => {
	const wrapper = metric({
		data: [{ count: { id: 1234567 } }],
		prefix: '$',
		suffix: 'items',
		notation: 'compact',
		maximumFractionDigits: 1,
	});

	expect(wrapper.get('p').text()).toBe('$ 1.2M items');
	expect(wrapper.get('p').attributes('style')).toContain('color: var(--color-brand-500)');
});

test('metric reads first/last raw values and the count without a field', () => {
	expect(
		metric({
			function: 'first',
			field: 'amount',
			data: [{ amount: '12.50' }],
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})
			.get('p')
			.text(),
	).toBe('12.50');
	expect(
		metric({ function: 'count', field: '', data: [{ count: 3 }] })
			.get('p')
			.text(),
	).toBe('3');
});

test('metric conditional color: the last matching rule wins, `<=` includes the value (D-113)', () => {
	const rules = [
		{ operator: '>', value: 1, color: A },
		{ operator: '>=', value: 5, color: B },
		{ operator: '<=', value: 10, color: C },
	];
	const wrapper = metric({ data: [{ count: { id: 10 } }], conditionalFormatting: rules });

	expect((wrapper.get('p').element as HTMLElement).style.color).toBe(C);
});

test('metric string values only match = and !=', () => {
	const wrapper = metric({
		function: 'last',
		field: 'status',
		data: [{ status: 'open' }],
		conditionalFormatting: [
			{ operator: '=', value: 'open', color: A },
			{ operator: '>=', value: 0, color: B },
		],
	});

	expect((wrapper.get('p').element as HTMLElement).style.color).toBe(A);
});

/* ----------------------------------------------------------------------------------------------------- metric list */

const metricList = (props: Record<string, unknown>) =>
	mountPanel(PanelMetricList, {
		collection: 'bo_orders',
		groupByField: 'country',
		aggregateFunction: 'sum',
		aggregateField: 'amount',
		prefix: '$',
		data: [
			{ group: { country: 'VN' }, sum: { amount: 50 } },
			{ group: { country: 'US' }, sum: { amount: 200 } },
			{ group: { country: 'JP' }, sum: { amount: 100 } },
			{ group: { country: 'FR' }, sum: { amount: 0 } },
		],
		...props,
	});

test('metric list sorts rows, formats values and sizes bars to the largest value', () => {
	const rows = metricList({}).findAll('[data-metric-row]');

	expect(rows.map((row) => row.text())).toEqual(['US$200', 'JP$100', 'VN$50', 'FR$0']);
	expect(
		rows.map((row) =>
			row.find<HTMLElement>('[data-metric-bar]').exists()
				? row.get<HTMLElement>('[data-metric-bar]').element.style.inlineSize
				: undefined,
		),
	).toEqual(['100%', '50%', '25%', undefined]);
});

test('metric list ascending sort', () => {
	const rows = metricList({ sortDirection: 'asc' }).findAll('[data-metric-row]');
	expect(rows.map((row) => row.text().slice(0, 2))).toEqual(['FR', 'VN', 'JP', 'US']);
});

test('metric list colors: last matching rule, `<=` inclusive (D-113), else the brand color', () => {
	const rows = metricList({
		conditionalFormatting: [
			{ operator: '>=', value: 100, color: A },
			{ operator: '<=', value: 100, color: B },
		],
	}).findAll('[data-metric-row]');
	const bar = (index: number) => (rows[index]!.get('[data-metric-bar]').element as HTMLElement).style.backgroundColor;

	expect(bar(0)).toBe(A);
	expect(bar(1)).toBe(B);
	expect(bar(2)).toBe(B);
});

test('metric list without rules uses the computed brand color', () => {
	const bar = metricList({}).get('[data-metric-bar]').element as HTMLElement;
	expect(bar.style.backgroundColor).not.toBe('');
});

/* ----------------------------------------------------------------------------------------------------------- meter */

const meter = (props: Record<string, unknown>) =>
	mountPanel(PanelMeter, {
		collection: 'bo_orders',
		field: 'amount',
		fn: 'sum',
		data: [{ sum: { amount: 45 } }],
		max: 60,
		...props,
	});

test('meter shows the percentage of max', () => {
	expect(meter({}).get('output').text()).toBe('75%');
	expect(meter({ showPercentage: false }).get('output').text()).toBe('');
	expect(
		meter({ data: [{ sum: { amount: 1 } }], max: 3 })
			.get('output')
			.text(),
	).toBe('33.3%');
});

test('meter conditional fill: the first matching rule wins', () => {
	const wrapper = meter({
		conditionalFill: [
			{ operator: '>=', value: 50, color: A },
			{ operator: '>=', value: 70, color: B },
		],
	});
	expect(wrapper.get('[data-meter-value]').attributes('stroke')).toBe(A);
});

test('meter `<=` includes the value (D-113), with or without the panel color', () => {
	expect(
		meter({ conditionalFill: [{ operator: '<=', value: 75, color: A }] })
			.get('[data-meter-value]')
			.attributes('stroke'),
	).toBe(A);
	expect(
		meter({ color: C, conditionalFill: [{ operator: '<=', value: 75, color: A }] })
			.get('[data-meter-value]')
			.attributes('stroke'),
	).toBe(A);
});

test('meter dash offset follows the percentage (full size)', () => {
	const circle = meter({}).get('[data-meter-value]').element as SVGCircleElement;
	// radius = (12 * 20 - 28) / 2 - 10 = 96 (DR counts 20 px per cell)
	expect(circle.getAttribute('r')).toBe('96');
	const circumference = 96 * 2 * Math.PI;
	expect(parseFloat(circle.style.strokeDashoffset)).toBeCloseTo(circumference * 0.25, 3);
});

/* ----------------------------------------------------------------------------------------------------------- label */

test('label renders the text as plain text with the user color', () => {
	const wrapper = mountPanel(PanelLabel, { text: '<b>Hello</b>', color: A, fontSize: 'lg' });

	expect(wrapper.get('p').text()).toBe('<b>Hello</b>');
	expect(wrapper.find('b').exists()).toBe(false);
	expect((wrapper.element as HTMLElement).style.color).toBe(A);
	// inheritAttrs: false, the tile context does not reach the DOM
	expect(wrapper.attributes('dashboard')).toBeUndefined();
});

/* ------------------------------------------------------------------------------------------------------------ list */

const DrawerStub = defineComponent({
	name: 'DrawerItem',
	props: { active: { type: Boolean, default: false }, primaryKey: { type: [String, Number], default: null } },
	emits: ['input', 'update:active'],
	setup: (props) => () => h('div', { 'data-drawer': props.active ? `open:${props.primaryKey}` : 'closed' }),
});

const ROWS = [
	{ id: 1, name: 'One' },
	{ id: 2, name: 'Two' },
];

const list = (props: Record<string, unknown>) =>
	mountPanel(
		PanelList,
		{ collection: 'bo_list', displayTemplate: '{{ name }}', data: ROWS, ...props },
		{ DrawerItem: DrawerStub },
	);

test('list renders rows through the display template; without linkToItem rows are not buttons', async () => {
	const wrapper = list({});
	const rows = wrapper.findAll('[data-list-row]');

	expect(rows.map((row) => row.text())).toEqual(['One', 'Two']);
	expect(wrapper.find('button').exists()).toBe(false);

	await rows[1]!.trigger('click');
	expect(wrapper.get('[data-drawer]').attributes('data-drawer')).toBe('closed');
});

test('list with linkToItem opens the item drawer, PATCHes the edits and refreshes the dashboard', async () => {
	const fetch = mockApi({ 'PATCH /items/bo_list/2': { id: 2, name: 'Deux' } });
	const refresh = vi.spyOn(useInsightsStore(), 'refresh').mockResolvedValue();
	const wrapper = list({ linkToItem: true });

	await wrapper.findAll('button[data-list-row]')[1]!.trigger('click');
	expect(wrapper.get('[data-drawer]').attributes('data-drawer')).toBe('open:2');

	wrapper.findComponent(DrawerStub).vm.$emit('input', { name: 'Deux' });
	await vi.waitFor(() => expect(refresh).toHaveBeenCalledWith('d1'));
	expect(calls(fetch)).toEqual(['PATCH /items/bo_list/2']);
	expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({ name: 'Deux' });

	wrapper.findComponent(DrawerStub).vm.$emit('update:active', false);
	await flushPromises();
	expect(wrapper.get('[data-drawer]').attributes('data-drawer')).toBe('closed');
});
