// Directus has no test for the datetime display (spec FR-074, FR-075): every option, the 60 s refresh, the time zone
// tooltip and the handler, in en-US and vi-VN.
import { mount } from '@vue/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import BoTooltip from '../../components/BoTooltip.vue';
import { i18n } from '../../lang/index.ts';
import viVN from '../../lang/translations/vi-VN.json';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import { loadDateFNSLocale } from '../../utils/get-date-fns-locale.ts';
import DisplayDatetime from './DisplayDatetime.vue';
import config from './index.ts';

const NOW = new Date('2024-03-15T09:30:00.000Z');

beforeAll(async () => {
	i18n.global.mergeLocaleMessage('vi-VN', viVN);
	await loadDateFNSLocale('en-US');
	await loadDateFNSLocale('vi-VN');
	vi.useFakeTimers({ now: NOW });
});

afterAll(() => {
	vi.useRealTimers();
});

afterEach(() => {
	i18n.global.locale.value = 'en-US';
});

const field = (name: string) => fieldsOf('bo_std').find((f) => f.field === name)!;

function render(name: string, extra: Record<string, unknown> = {}) {
	const f = field(name);
	return mount(DisplayDatetime, {
		props: { ...f.meta!.display_options, type: f.type, value: itemOf('bo_std', 1)[name], ...extra } as never,
	});
}

const text = (props: Record<string, unknown>) => mount(DisplayDatetime, { props: props as never }).text();

describe('options (en-US)', () => {
	test('option:datetime.format long by default, short, custom', () => {
		expect(text({ type: 'date', value: '2024-03-15' })).toBe('March 15th, 2024');
		expect(text({ type: 'dateTime', value: '2024-03-15T14:30:00' })).toBe('March 15th, 2024 2:30 PM');
		expect(render('date').text()).toBe('Mar 15, 2024');
		expect(render('date_time').text()).toBe('Mar 15, 2024 14:30');
	});

	test('option:datetime.includeSeconds', () => {
		expect(render('time').text()).toBe('2:30:45 PM');
		expect(text({ type: 'time', value: '14:30:45' })).toBe('2:30 PM');
	});

	test('option:datetime.use24 is false by default (unlike the interface)', () => {
		expect(text({ type: 'time', value: '14:30:45', use24: true })).toBe('14:30');
		expect(text({ type: 'time', value: '14:30:45', use24: true, includeSeconds: true })).toBe('14:30:45');
	});

	test('option:datetime.relative, option:datetime.strict, option:datetime.round, option:datetime.suffix', () => {
		expect(render('timestamp').text()).toBe('2 hours ago');
		expect(render('timestamp_relative').text()).toBe('about 2 hours');
		const value = '2024-03-15T07:59:00.000Z';
		expect(text({ type: 'timestamp', value, relative: true, strict: true, round: 'floor' })).toBe('1 hour ago');
		expect(text({ type: 'timestamp', value, relative: true, strict: true })).toBe('2 hours ago');
		expect(text({ type: 'timestamp', value, relative: true, strict: true, round: 'ceil', suffix: false })).toBe(
			'2 hours',
		);
	});

	test('option:datetime.tz formats a timestamp in the zone and shows it as a tooltip', () => {
		const wrapper = text({ type: 'timestamp', value: '2024-03-15T07:30:00.000Z', tz: 'Asia/Tokyo', format: 'HH:mm' });
		expect(wrapper).toBe('16:30');

		const relative = render('timestamp_relative');
		expect(relative.getComponent(BoTooltip).props('text')).toBe('America/New_York (GMT-4)');
		expect(render('timestamp').findComponent(BoTooltip).exists()).toBe(false);
	});

	test('relative values refresh every 60 seconds', async () => {
		const wrapper = mount(DisplayDatetime, {
			props: { type: 'timestamp', value: NOW.toISOString(), relative: true, strict: true },
		});
		expect(wrapper.text()).toBe('0 seconds ago');

		await vi.advanceTimersByTimeAsync(60_000);
		expect(wrapper.text()).toBe('1 minute ago');

		wrapper.unmount();
	});

	test('handler formats with the field type and the options; empty values pass through', () => {
		expect(config.handler!('2024-03-15', { format: 'short' }, { field: field('date') as never })).toBe('Mar 15, 2024');
		expect(config.handler!(null, {}, { field: field('date') as never })).toBeNull();
	});
});

describe('vi-VN', () => {
	test('long, short and relative formats use the vi-VN strings and the date-fns vi locale', () => {
		i18n.global.locale.value = 'vi-VN';

		expect(text({ type: 'date', value: '2024-03-15' })).toBe('ngày 15 tháng 03 năm 2024');
		expect(render('date').text()).toBe('thg 3 15, bạn');
		expect(render('time').text()).toBe('2:30:45 PM');
		expect(render('timestamp').text()).toBe('2 giờ trước');
		expect(render('timestamp_relative').text()).toBe('khoảng 2 giờ');
	});
});
