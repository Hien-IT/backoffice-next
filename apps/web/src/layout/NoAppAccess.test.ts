import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { mountLayout } from '../test-utils/layout.ts';
import NoAppAccess from './NoAppAccess.vue';

enableAutoUnmount(afterEach);

test('NoAppAccess: Directus message and a sign out link to /logout', async () => {
	const { wrapper } = await mountLayout(NoAppAccess);

	expect(wrapper.get('h1').text()).toBe('No App Access');
	expect(wrapper.text()).toContain("This user isn't allowed to use the admin app.");
	expect(wrapper.get('a').attributes('href')).toBe('/logout');
	expect(wrapper.get('a').text()).toBe('Sign Out');
});
