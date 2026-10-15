import type { Preset } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { json, mockApi } from '../test-utils/fetch.ts';
import type { AppUser } from '../types/user.ts';
import { usePresetsStore } from './presets.ts';
import { useUserStore } from './user.ts';

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());

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

/** Body sent with the last request to `method path` (parsed JSON). */
function bodyOf(fetch: ReturnType<typeof mockApi>, method: string, path: string) {
	const call = fetch.mock.calls.filter(([url, init]) => init?.method === method && new URL(String(url)).pathname === path).at(-1);
	return call ? JSON.parse(String(call[1]!.body)) : undefined;
}

test('bookmarks lists global, then role, then user bookmarks, by name', () => {
	const store = usePresetsStore();
	const b = (id: number, values: Partial<Preset>) => preset(id, { bookmark: `b${id}`, ...values });

	store.collectionPresets = [b(1, { user: 'u1', bookmark: 'z' }), b(2, { role: 'r1' }), b(3, {}), user, b(4, { user: 'u1', bookmark: 'a' })];

	expect(store.bookmarks.map((p) => p.id)).toEqual([4, 1, 2, 3]);
	expect(store.getBookmark(2)?.id).toBe(2);
	expect(store.getBookmark(99)).toBeNull();
});

test('savePreset creates a preset of the user when it has no id, with the whole local preset as body', async () => {
	useUserStore().currentUser = { id: 'u1', role: { id: 'r1' } } as AppUser;
	const fetch = mockApi({ 'POST /presets': ({ init }: { init: RequestInit }) => json({ data: { id: 10, ...JSON.parse(String(init.body)) } }) });
	const store = usePresetsStore();

	const local = { collection: 'a', layout: 'tabular', layout_query: { tabular: { page: 2 } }, layout_options: null, filter: null, search: null, refresh_interval: null };
	const saved = await store.savePreset(local);

	expect(bodyOf(fetch, 'POST', '/presets')).toEqual({ ...local, user: 'u1' });
	expect(saved?.id).toBe(10);
	expect(store.collectionPresets.map((p) => p.id)).toEqual([10]);
});

test('savePreset copies a role or global preset as a new preset of the user', async () => {
	useUserStore().currentUser = { id: 'u1', role: { id: 'r1' } } as AppUser;
	const fetch = mockApi({ 'POST /presets': ({ init }: { init: RequestInit }) => json({ data: { id: 11, ...JSON.parse(String(init.body)) } }) });
	const store = usePresetsStore();

	await store.savePreset({ ...role, layout: 'cards' });

	const body = bodyOf(fetch, 'POST', '/presets');
	expect(body.id).toBeUndefined();
	expect(body).toMatchObject({ collection: 'a', role: 'r1', user: 'u1', layout: 'cards' });
});

test('savePreset updates a preset of the user without its id in the body', async () => {
	useUserStore().currentUser = { id: 'u1', role: { id: 'r1' } } as AppUser;
	const fetch = mockApi({ 'PATCH /presets/3': ({ init }: { init: RequestInit }) => json({ data: { id: 3, ...JSON.parse(String(init.body)) } }) });
	const store = usePresetsStore();
	store.collectionPresets = [user];

	await store.savePreset({ ...user, search: 'x' });

	expect(bodyOf(fetch, 'PATCH', '/presets/3')).toEqual({ collection: 'a', bookmark: null, user: 'u1', role: null, search: 'x' });
	expect(store.collectionPresets[0]).toMatchObject({ id: 3, search: 'x' });
});

test('savePreset does nothing in a share session', async () => {
	useUserStore().currentUser = { share: 's1', app_access: false, admin_access: false };
	const fetch = mockApi({});

	expect(await usePresetsStore().savePreset({ collection: 'a' })).toBeNull();
	expect(fetch).not.toHaveBeenCalled();
});

test('delete sends the ids as body and removes the presets from the store', async () => {
	const fetch = mockApi({ 'DELETE /presets': () => new Response(null, { status: 204 }) });
	const store = usePresetsStore();
	store.collectionPresets = [global, role, user];

	await store.delete([1, 3]);

	expect(bodyOf(fetch, 'DELETE', '/presets')).toEqual([1, 3]);
	expect(store.collectionPresets.map((p) => p.id)).toEqual([2]);
});

test('clearLocalSave reloads the stored bookmark', async () => {
	mockApi({ 'GET /presets/4': { ...bookmark, bookmark: 'Server' } });
	const store = usePresetsStore();
	store.collectionPresets = [{ ...bookmark, bookmark: 'Local' }];

	await store.clearLocalSave(bookmark);

	expect(store.collectionPresets[0]!.bookmark).toBe('Server');
});
