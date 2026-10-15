// Feature 015 (FR-052, CHK018): directus/app/src/modules/users/composables/use-navigation.ts (no Directus test).
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { replaceQueue } from '../../../api/sdk.ts';
import { resetNotices, useNotices } from '../../../composables/use-notices.ts';
import { calls, json, mockApi } from '../../../test-utils/fetch.ts';
import useNavigation, { resetNavigationForTests } from './use-navigation.ts';

const ROLES = [
	{ id: 'a', name: 'Admins', icon: 'verified', parent: null },
	{ id: 'b', name: 'Editors', icon: 'edit', parent: null },
	{ id: 'c', name: 'Juniors', icon: 'child_care', parent: 'b' },
	{ id: 'd', name: 'Interns', icon: 'school', parent: 'c' },
];

beforeEach(async () => {
	setActivePinia(createPinia());
	resetNavigationForTests();
	resetNotices();
	await replaceQueue();
});

afterEach(() => vi.unstubAllGlobals());

test('loads the roles once with the Directus query and builds the tree by parent', async () => {
	const fetch = mockApi({ 'GET /roles': ROLES });
	const { roleTree, loading } = useNavigation(ref(undefined));
	expect(loading.value).toBe(true);
	await vi.waitFor(() => expect(loading.value).toBe(false));

	expect(calls(fetch)).toEqual(['GET /roles?fields=id,name,icon,parent&sort=name']);
	expect(loading.value).toBe(false);
	expect(roleTree.value.map((role) => role.id)).toEqual(['a', 'b']);
	expect(roleTree.value[1]!.children!.map((role) => role.id)).toEqual(['c']);
	expect(roleTree.value[1]!.children![0]!.children!.map((role) => role.id)).toEqual(['d']);
});

test('the current role and its parents open, shared by every caller', async () => {
	mockApi({ 'GET /roles': ROLES });
	const { openRoles, loading } = useNavigation(ref('d'));
	await vi.waitFor(() => expect(loading.value).toBe(false));
	await flushPromises();

	expect(openRoles.value).toEqual(['d', 'c', 'b']);
	const again = useNavigation(ref(undefined));
	expect(again.openRoles).toBe(openRoles);
	await vi.waitFor(() => expect(again.loading.value).toBe(false));
	await flushPromises();
});

test('a refused read opens the error dialog and leaves the tree empty (CHK018)', async () => {
	mockApi({
		'GET /roles': () => json({ errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] }, 403),
	});
	const { roleTree, loading } = useNavigation(ref(undefined));
	await vi.waitFor(() => expect(loading.value).toBe(false));

	expect(roleTree.value).toEqual([]);
	expect(useNotices().dialogs.value.length).toBeGreaterThan(0);
});
