import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createSdk } from '../api/sdk.ts';
import { useUserStore } from '../stores/user.ts';
import { mountLayout } from '../test-utils/layout.ts';
import type { AppUser } from '../types/user.ts';
import { getInternalModules, registeredModules } from './index.ts';
import ModulePlaceholder from './ModulePlaceholder.vue';

vi.mock('../router/index.ts', () => ({ router: {} }));
vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

enableAutoUnmount(afterEach);

describe('ModulePlaceholder (FR-023, D-40)', () => {
	test.each([
		['users', '/users/1', 'User Directory', 'people_alt'],
		['activity', '/activity', 'Activity', 'notifications'],
	])(
		'module %s: translated name in the page header h1 and the tab title, icon, empty state',
		async (id, path, name, icon) => {
			createSdk('http://api.test/');
			registeredModules.value = getInternalModules();

			const { head } = await mountLayout(ModulePlaceholder, {
				path,
				routes: [{ path: '/:p(.*)*', component: { render: () => null }, meta: { module: id } }],
				beforeMount: () => {
					useUserStore().currentUser = { id: 'u1', admin_access: true, app_access: true } as AppUser;
				},
			});

			expect(document.body.querySelector('main h1')!.textContent).toBe(name);
			expect(document.body.querySelector('main')!.textContent).toContain(icon);
			expect(document.body.querySelector('main')!.textContent).toContain(
				'The content of this module will be available in a later version.',
			);

			const tags = await head.resolveTags();
			expect(tags.find((tag) => tag.tag === 'title')?.textContent).toBe(name);
		},
	);
});
