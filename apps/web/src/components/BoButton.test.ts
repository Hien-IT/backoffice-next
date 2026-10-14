import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import BoButton from './BoButton.vue';

afterEach(() => vi.restoreAllMocks());

describe('BoButton', () => {
	test('renders a button of type button with the variant classes', async () => {
		const wrapper = mount(BoButton, { slots: { default: 'Save' } });
		const button = wrapper.get('button');

		expect(button.text()).toBe('Save');
		expect(button.attributes('type')).toBe('button');
		expect(button.classes()).toContain('bg-eh-action-primary');

		await wrapper.setProps({ variant: 'danger', type: 'submit', fullWidth: true });
		expect(button.attributes('type')).toBe('submit');
		expect(button.classes()).toContain('border-eh-status-danger');
		expect(button.classes()).toContain('text-eh-text-primary');
		expect(button.classes()).toContain('w-full');
	});

	test('icon-only button carries its aria-label; warns without one', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const button = mount(BoButton, { props: { icon: 'close', ariaLabel: 'Close' } }).get('button');

		expect(button.attributes('aria-label')).toBe('Close');
		expect(button.get('.material-symbols-rounded').text()).toBe('close');
		expect(warn).not.toHaveBeenCalled();

		mount(BoButton, { props: { icon: 'close' } });
		expect(String(warn.mock.calls[0]?.[0])).toContain('needs an ariaLabel');
	});

	test('loading shows a spinner, sets aria-busy and disables', async () => {
		const wrapper = mount(BoButton, { props: { loading: true, icon: 'save' }, slots: { default: 'Save' } });
		const button = wrapper.get('button');

		expect(button.attributes('aria-busy')).toBe('true');
		expect(button.attributes('disabled')).toBeDefined();
		expect(button.find('[role="progressbar"]').exists()).toBe(true);
		expect(button.find('.material-symbols-rounded').exists()).toBe(false);

		await button.trigger('click');
		expect(wrapper.emitted('click')).toBeUndefined();
	});

	test('href renders a link, to renders a RouterLink, disabled renders a disabled button', async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
		});

		expect(
			mount(BoButton, { props: { href: 'https://example.org' } })
				.get('a')
				.attributes('href'),
		).toBe('https://example.org');

		const link = mount(BoButton, { props: { to: '/content' }, global: { plugins: [router] } });
		expect(link.get('a').attributes('href')).toBe('/content');
		expect(link.find('a').attributes('type')).toBeUndefined();

		const disabled = mount(BoButton, { props: { href: '/x', disabled: true } });
		expect(disabled.find('a').exists()).toBe(false);
		expect(disabled.get('button').attributes('disabled')).toBeDefined();
	});
});
