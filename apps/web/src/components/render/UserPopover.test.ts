// Directus has no test for user-popover.vue: request (contracts/api-calls #49), loading, content, link, error, focus,
// hover.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../lang/index.ts';
import { assertOnlyKnownRequests, calls, json, mockApi } from '../../test-utils/fetch.ts';
import UserPopover from './UserPopover.vue';

enableAutoUnmount(afterEach);

const USER = {
	id: 'bo-9',
	first_name: 'Edith',
	last_name: 'Editor',
	email: 'bo-editor@example.com',
	status: 'active',
	avatar: null,
	role: { name: 'bo-editor' },
};

beforeEach(() => {
	vi.unstubAllGlobals();
	setActivePinia(createPinia());
	document.body.innerHTML = '';
});

afterEach(() => vi.useRealTimers());

function mountPopover() {
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

	return mount(UserPopover, {
		props: { user: 'bo-9' },
		slots: { default: '<span class="slot">Edith</span>' },
		global: { plugins: [i18n, router] },
		attachTo: document.body,
	});
}

const content = () => document.querySelector('[role="dialog"]') as HTMLElement | null;

describe('UserPopover', () => {
	test('renders the slot in a button and fetches nothing until opened', () => {
		const fetch = mockApi({ 'GET /users/bo-9': USER });
		const wrapper = mountPopover();

		expect(wrapper.get('button').find('.slot').exists()).toBe(true);
		expect(fetch).not.toHaveBeenCalled();
	});

	test('click opens it, fetches the user once and shows name, status, role, email and link', async () => {
		let answer!: () => void;
		const gate = new Promise<void>((resolve) => (answer = resolve));
		const fetch = mockApi({ 'GET /users/bo-9': async () => (await gate, json({ data: USER })) });
		const wrapper = mountPopover();

		await wrapper.get('button').trigger('click');
		await vi.waitFor(() => expect(content()?.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading...'));

		answer();
		await vi.waitFor(() => expect(content()?.querySelector('.name')?.textContent).toBe('Edith Editor'));

		expect(calls(fetch)).toEqual([
			'GET /users/bo-9?fields=id,first_name,last_name,avatar.id,avatar.modified_on,role.name,status,email',
		]);
		assertOnlyKnownRequests(calls(fetch));

		const box = content()!;
		expect(box.querySelector('.status')!.textContent!.trim()).toBe('Active');
		expect(box.querySelector('.status')!.className).toContain('text-success-700');
		expect(box.textContent).toContain('bo-editor');
		expect(box.querySelector('.email')!.textContent).toBe('bo-editor@example.com');
		expect(box.querySelector('a')!.getAttribute('href')).toBe('/users/bo-9');

		// Closing and opening again does not fetch again.
		await wrapper.get('button').trigger('click');
		await vi.waitFor(() => expect(content()).toBeNull());
		await wrapper.get('button').trigger('click');
		await vi.waitFor(() => expect(content()?.querySelector('.name')).not.toBeNull());
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	test('opening from the focused trigger moves focus into the popover', async () => {
		mockApi({ 'GET /users/bo-9': USER });
		const wrapper = mountPopover();
		const button = wrapper.get('button').element as HTMLButtonElement;

		button.focus();
		// A native button turns Enter and Space into click.
		button.click();
		await vi.waitFor(() => expect(content()?.querySelector('a')).not.toBeNull());
		await vi.waitFor(() => expect(content()!.contains(document.activeElement)).toBe(true));
	});

	test('a request error is shown', async () => {
		mockApi({
			'GET /users/bo-9': () => json({ errors: [{ message: "You don't have permission to access this." }] }, 403),
		});
		const wrapper = mountPopover();

		await wrapper.get('button').trigger('click');

		await vi.waitFor(() =>
			expect(content()?.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
				"You don't have permission to access this.",
			),
		);
	});
	test('hover opens after 300 ms and leaving closes it', async () => {
		vi.useFakeTimers();
		mockApi({ 'GET /users/bo-9': USER });
		const wrapper = mountPopover();
		const button = wrapper.get('button');

		await button.trigger('pointerenter', { pointerType: 'mouse' });
		vi.advanceTimersByTime(299);
		await flushPromises();
		expect(content()).toBeNull();

		vi.advanceTimersByTime(1);
		await flushPromises();
		expect(content()).not.toBeNull();
		// Opened by hover: focus stays on the page.
		expect(content()!.contains(document.activeElement)).toBe(false);

		await button.trigger('pointerleave', { pointerType: 'mouse' });
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(content()).toBeNull();
	});
});
