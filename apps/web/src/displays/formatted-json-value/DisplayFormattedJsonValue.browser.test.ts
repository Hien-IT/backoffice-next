// Keyboard and popover of the "N items" menu need a real browser (happy-dom closes the Reka popover on open).
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import FormattedJsonValue from './DisplayFormattedJsonValue.vue';

enableAutoUnmount(afterEach);

test('"N items" opens with Enter, lists each rendered item and closes with Escape', async () => {
	const wrapper = mount(FormattedJsonValue, {
		props: { value: [{ title: 'Row A' }, { title: 'Row B' }], format: '{{title}}' },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	const trigger = wrapper.get('button').element;

	trigger.focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));

	expect([...document.querySelectorAll('[role="dialog"] li')].map((li) => li.textContent?.trim())).toEqual([
		'Row A',
		'Row B',
	]);

	await userEvent.keyboard('{Escape}');
	await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
	expect(document.activeElement).toBe(trigger);
});
