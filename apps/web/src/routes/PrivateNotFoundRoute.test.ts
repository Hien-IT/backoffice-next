import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { createSdk } from '../api/sdk.ts';
import { useUserStore } from '../stores/user.ts';
import { mountLayout } from '../test-utils/layout.ts';
import type { AppUser } from '../types/user.ts';
import PrivateNotFoundRoute from './PrivateNotFoundRoute.vue';

vi.mock('../router/index.ts', () => ({ router: {} }));
vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

enableAutoUnmount(afterEach);

test('PrivateNotFoundRoute (FR-025): private layout with the Directus page-not-found strings and title', async () => {
	createSdk('http://api.test/');

	const { head } = await mountLayout(PrivateNotFoundRoute, {
		path: '/khong-co',
		beforeMount: () => {
			useUserStore().currentUser = { id: 'u1', admin_access: true, app_access: true } as AppUser;
		},
	});

	expect(document.body.querySelector('header h1')!.textContent).toBe('Page Not Found');
	expect(document.body.querySelector('main')!.textContent).toContain(
		"The page you are looking for doesn't seem to exist.",
	);
	expect(document.body.querySelector('[data-testid="module-bar"]')).not.toBeNull();

	const tags = await head.resolveTags();
	expect(tags.find((tag) => tag.tag === 'title')?.textContent).toBe('Page Not Found');
});
