import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { createI18n } from 'vue-i18n';
import BoSkipMenu from './BoSkipMenu.vue';

const i18n = createI18n({
	legacy: false,
	locale: 'en-US',
	messages: { 'en-US': { skip_to_content: 'Skip to content', skip_to_navigation: 'Skip to navigation' } },
});

describe('BoSkipMenu', () => {
	test('links to the main content and the navigation', () => {
		const links = mount(BoSkipMenu, { global: { plugins: [i18n] } }).findAll('a');

		expect(links.map((link) => [link.attributes('href'), link.text()])).toEqual([
			['#main-content', 'Skip to content'],
			['#navigation', 'Skip to navigation'],
		]);
	});
});
