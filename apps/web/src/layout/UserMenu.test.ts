import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createSdk } from '../api/sdk.ts';
import { useUserStore } from '../stores/user.ts';
import { mountLayout, press } from '../test-utils/layout.ts';
import type { AppUser, ShareUser } from '../types/user.ts';
import UserMenu from './UserMenu.vue';

vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

enableAutoUnmount(afterEach);

async function render(user: Partial<AppUser> | ShareUser) {
	createSdk('http://api.test/');

	const { wrapper } = await mountLayout(UserMenu, {
		beforeMount: () => {
			useUserStore().currentUser = user as AppUser;
		},
	});

	return { wrapper, trigger: wrapper.get('button').element };
}

async function openMenu(trigger: HTMLElement) {
	trigger.focus();
	await press(trigger, 'Enter');
	return [...document.body.querySelectorAll('[role="menuitem"]')];
}

describe('UserMenu (FR-024)', () => {
	test('trigger named after the user, avatar thumbnail like Directus', async () => {
		const { wrapper, trigger } = await render({
			id: 'u1',
			first_name: 'Ada',
			last_name: 'Lovelace',
			avatar: { id: 'a1' },
		});

		expect(trigger.getAttribute('aria-label')).toBe('Ada Lovelace');
		expect(wrapper.get('img').attributes('src')).toBe('http://api.test/assets/a1?key=system-medium-cover');
	});

	test('menu: profile (/users/<id>, feature 015) and sign out (/logout); Esc returns focus to the avatar', async () => {
		const { trigger } = await render({ id: 'u1', email: 'ada@example.test', avatar: null });

		const items = await openMenu(trigger);
		expect(items.map((item) => [item.textContent?.replace(/\s+/g, ' ').trim(), item.getAttribute('href')])).toEqual([
			['account_circle Profile', '/users/u1'],
			['Sign Out', '/logout'],
		]);

		await press(document.activeElement!, 'Escape');
		await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
	});

	test('share user: sign out only', async () => {
		const { trigger } = await render({ share: 's1', admin_access: false, app_access: false });

		expect(trigger.getAttribute('aria-label')).toBe('Unknown User');
		expect((await openMenu(trigger)).map((item) => item.getAttribute('href'))).toEqual(['/logout']);
	});

	test('top bar (D-157): the visible name from lg, no bell badge on the avatar (the bell is next to it)', async () => {
		const { wrapper } = await render({ id: 'u1', first_name: 'Ada', avatar: null });

		expect(wrapper.get('button').attributes('aria-label')).toBe('Ada');
		expect(wrapper.get('button span.lg\\:block').text()).toBe('Ada');
		expect(wrapper.find('[data-testid="notifications-badge"]').exists()).toBe(false);
	});
});
