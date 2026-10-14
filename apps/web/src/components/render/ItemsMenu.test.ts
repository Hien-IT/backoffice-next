// "N items" menu shell (opening and focus in a real browser: DisplayRelatedValues.browser.test.ts,
// DisplayFormattedJsonValue.browser.test.ts).
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import ItemsMenu from './ItemsMenu.vue';

function mountMenu(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
	return mount(ItemsMenu, {
		props,
		attrs,
		slots: { trigger: '<span class="label">2 Items</span>', default: '<ul><li>Row</li></ul>' },
	});
}

describe('ItemsMenu', () => {
	test('renders the trigger slot in a closed popover trigger with the recipe classes', () => {
		const trigger = mountMenu().get('button');

		expect(trigger.text()).toBe('2 Items');
		expect(trigger.attributes('aria-haspopup')).toBe('dialog');
		expect(trigger.attributes('aria-expanded')).toBe('false');
		expect(trigger.classes()).toEqual(expect.arrayContaining(['underline', 'decoration-dotted']));
	});

	test('attributes go to the trigger; triggerClass replaces the recipe classes', () => {
		const trigger = mountMenu({ triggerClass: 'icon-only' }, { 'aria-label': 'Translations', class: 'extra' }).get(
			'button',
		);

		expect(trigger.attributes('aria-label')).toBe('Translations');
		expect(trigger.classes()).toEqual(expect.arrayContaining(['icon-only', 'extra']));
		expect(trigger.classes()).not.toContain('underline');
	});

	test('disabled disables the trigger', () => {
		expect(mountMenu({ disabled: true }).get('button').attributes('disabled')).toBeDefined();
	});

	test('the trigger click does not reach a parent', async () => {
		let clicks = 0;
		const host = document.createElement('div');
		host.addEventListener('click', () => clicks++);
		document.body.append(host);

		await mount(ItemsMenu, { slots: { trigger: 'x' }, attachTo: host })
			.get('button')
			.trigger('click');
		expect(clicks).toBe(0);
		host.remove();
	});
});
