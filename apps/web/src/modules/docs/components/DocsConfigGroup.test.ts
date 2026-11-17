// Spec 033 T038 (FR-030..FR-033, FR-046, Q-50).
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import type { ConfigTable } from '../../../docs/types.ts';
import { i18n } from '../../../lang/index.ts';
import DocsConfigGroup from './DocsConfigGroup.vue';

enableAutoUnmount(afterEach);

const TABLES: ConfigTable[] = [
	{
		title: 'Chung',
		note: 'Đọc khi khởi động; xem `CONFIG_PATH`.',
		rows: [
			{ name: 'PORT', pattern: 'PORT', description: 'Cổng API lắng nghe. Số nguyên.' },
			{
				name: 'SECRET',
				pattern: 'SECRET',
				description: 'Chuỗi bí mật <script>alert(1)</script>.',
				note: 'Phải trùng ở mọi instance.',
			},
		],
	},
	{ title: 'Kết nối', rows: [{ name: 'DB_*', pattern: 'DB_.+', description: 'Kết nối: `DB_CLIENT`, `DB_HOST`.' }] },
];

const HEADINGS = [
	{ id: 'chung', text: 'Chung', level: 2 as const },
	{ id: 'ket-noi', text: 'Kết nối', level: 2 as const },
];

const group = () =>
	mount(DocsConfigGroup, {
		props: { tables: TABLES, headings: HEADINGS, defaults: { PORT: '8055', SECRET: undefined, 'DB_.+': undefined } },
		global: { plugins: [i18n] },
	});

test('each table is a second-level heading with its anchor, in a labelled scrollable region', () => {
	const wrapper = group();

	expect(wrapper.findAll('h2').map((h2) => [h2.attributes('id'), h2.text(), h2.attributes('tabindex')])).toEqual([
		['chung', 'Chung', '-1'],
		['ket-noi', 'Kết nối', '-1'],
	]);

	const region = wrapper.find('.docs-table');
	expect(region.attributes('role')).toBe('region');
	expect(region.attributes('tabindex')).toBe('0');
	expect(region.attributes('aria-label')).toBe('Chung');
	expect(wrapper.find('caption').text()).toBe('Chung');
});

test('three columns with scoped header cells; the default comes from the generated list', () => {
	const wrapper = group();

	expect(
		wrapper
			.findAll('thead')[0]!
			.findAll('th')
			.map((th) => [th.text(), th.attributes('scope')]),
	).toEqual([
		['Variable', 'col'],
		['Description', 'col'],
		['Default', 'col'],
	]);

	const [port, secret] = wrapper.findAll('tbody')[0]!.findAll('tr');
	expect(port!.findAll('td').map((td) => td.text())).toEqual(['PORT', 'Cổng API lắng nghe. Số nguyên.', '8055']);
	expect(port!.find('td code').classes()).toContain('docs-inline-code');
	// No default: an empty cell, not a dash or "undefined".
	expect(secret!.findAll('td')[2]!.text()).toBe('');
	expect(secret!.find('[data-note]').text()).toBe('Phải trùng ở mọi instance.');
});

test('descriptions are text: backticks become code, markup never becomes an element (FR-046)', () => {
	const wrapper = group();

	expect(wrapper.find('script').exists()).toBe(false);
	expect(wrapper.findAll('tbody')[0]!.findAll('tr')[1]!.findAll('td')[1]!.text()).toContain(
		'<script>alert(1)</script>',
	);
	expect(
		wrapper
			.findAll('tbody')[1]!
			.findAll('td')[1]!
			.findAll('code')
			.map((code) => code.text()),
	).toEqual(['DB_CLIENT', 'DB_HOST']);
	expect(wrapper.findAll('tbody')[1]!.find('td code').text()).toBe('DB_*');
});

test('the note of a table is a notice; the parts are marked with the docs language (vi-VN here)', () => {
	i18n.global.locale.value = 'vi-VN';
	const wrapper = group();
	i18n.global.locale.value = 'en-US';

	expect(wrapper.find('[role="status"], [role="alert"], .mt-4').text()).toContain('Đọc khi khởi động');
	expect(wrapper.find('h2').attributes('lang')).toBe('vi');
	expect(wrapper.findAll('tbody')[0]!.findAll('td')[1]!.attributes('lang')).toBe('vi');
});
