import type { Preset } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test } from 'vitest';
import type { AppUser } from '../types/user.ts';
import { usePresetsStore } from './presets.ts';
import { useUserStore } from './user.ts';

beforeEach(() => setActivePinia(createPinia()));

const preset = (id: number, values: Partial<Preset>) =>
	({ id, collection: 'a', bookmark: null, user: null, role: null, ...values }) as Preset;

const global = preset(1, {});
const role = preset(2, { role: 'r1' });
const user = preset(3, { user: 'u1' });
const bookmark = preset(4, { user: 'u1', bookmark: 'Mine' });
const otherRole = preset(5, { role: 'r2' });
const otherUser = preset(6, { user: 'u2' });

test('getPresetForCollection is null without a logged-in app user', () => {
	const store = usePresetsStore();

	expect(store.getPresetForCollection('a')).toBeNull();

	useUserStore().currentUser = { share: 's1', app_access: false, admin_access: false };
	expect(store.getPresetForCollection('a')).toBeNull();
});

test('getPresetForCollection prefers user, then role, then global presets and skips bookmarks', () => {
	useUserStore().currentUser = { id: 'u1', role: { id: 'r1' } } as AppUser;
	const store = usePresetsStore();

	store.collectionPresets = [global, role, user, bookmark, otherRole, otherUser];
	expect(store.getPresetForCollection('a')).toEqual(user);

	store.collectionPresets = [global, role, bookmark, otherUser];
	expect(store.getPresetForCollection('a')).toEqual(role);

	store.collectionPresets = [global, bookmark];
	expect(store.getPresetForCollection('a')).toEqual(global);

	store.collectionPresets = [preset(7, {}), preset(8, {})];
	expect(store.getPresetForCollection('a')?.id).toBe(8);
});

test('getPresetForCollection falls back to an empty preset of the user', () => {
	useUserStore().currentUser = { id: 'u1', role: null } as AppUser;
	const store = usePresetsStore();

	store.collectionPresets = [preset(9, { collection: 'b' }), bookmark];

	expect(store.getPresetForCollection('a')).toEqual({
		bookmark: null,
		role: null,
		user: 'u1',
		search: null,
		filter: null,
		layout: null,
		layout_query: null,
		layout_options: null,
		refresh_interval: null,
		icon: 'bookmark',
		color: null,
		collection: 'a',
	});
});
