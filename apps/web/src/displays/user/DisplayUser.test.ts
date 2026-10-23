// DR has no test for the user display: `display`, `circle`, avatar URL, handler.
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../lang/index.ts';
import { mockApi } from '../../test-utils/fetch.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import DisplayUser from './DisplayUser.vue';
import display from './index.ts';

const field = fieldsOf('bo_rel').find((f) => f.field === 'owner')!;
const owner = itemOf('bo_rel', 1)['owner'];
const withAvatar = { ...owner, avatar: { id: 'bo-4', modified_on: '2024-01-01' } };

beforeEach(() => {
	vi.unstubAllGlobals();
	mockApi({});
});

function mountDisplay(props: Record<string, unknown>) {
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
	return mount(DisplayUser, { props: props as never, global: { plugins: [i18n, router] } });
}

describe('user display', () => {
	test('fields needed from the related user', () => {
		expect(display.fields).toEqual(['id', 'avatar.id', 'avatar.modified_on', 'email', 'first_name', 'last_name']);
	});

	test('fixture field: avatar placeholder and name inside the popover trigger', () => {
		const wrapper = mountDisplay({ ...field.meta!.display_options, value: owner });
		const trigger = wrapper.get('button');

		expect(trigger.text()).toContain('Edith Editor');
		expect(trigger.find('.placeholder').text()).toBe('account_circle');
	});

	test('option:user.display defaults to both', () => {
		const wrapper = mountDisplay({ value: withAvatar });

		expect(wrapper.find('img').exists()).toBe(true);
		expect(wrapper.text()).toContain('Edith Editor');
	});

	test('option:user.display avatar and name', () => {
		const avatar = mountDisplay({ value: withAvatar, display: 'avatar' });
		expect(avatar.find('img').exists()).toBe(true);
		expect(avatar.text()).not.toContain('Edith Editor');

		const placeholder = mountDisplay({ value: owner, display: 'avatar' });
		expect(placeholder.get('.placeholder').attributes('aria-label')).toBe('Edith Editor');

		const name = mountDisplay({ value: withAvatar, display: 'name' });
		expect(name.find('img').exists()).toBe(false);
		expect(name.find('.placeholder').exists()).toBe(false);
		expect(name.text()).toBe('Edith Editor');
	});

	test('avatar: system-small-cover with the avatar modified_on', () => {
		const url = new URL(mountDisplay({ value: withAvatar }).get('img').attributes('src')!);

		expect(url.pathname).toBe('/assets/bo-4');
		expect(url.searchParams.get('key')).toBe('system-small-cover');
		expect(url.searchParams.get('v')).toBe('2024-01-01');
	});

	test('option:user.circle', () => {
		expect(mountDisplay({ value: withAvatar, circle: true }).get('img').classes()).toContain('rounded-full');
		expect(mountDisplay({ value: withAvatar }).get('img').classes()).not.toContain('rounded-full');
	});

	test('null value renders nothing', () => {
		expect(mountDisplay({ value: null }).html()).toBe('<!--v-if-->');
	});

	test('handler returns the user name', () => {
		expect(display.handler!(owner, {}, {} as never)).toBe('Edith Editor');
		expect(display.handler!({ email: 'a@example.com' }, {}, {} as never)).toBe('a@example.com');
		expect(display.handler!(null, {}, {} as never)).toBe('Unknown User');
	});
});
