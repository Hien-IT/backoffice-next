// Behaviour of directus/app/src/composables/use-preset.ts (no Directus test) on the Backoffice presets store, with the
// first write measured on the Directus app (fixtures/interfaces/snapshot/expected.content.json, CHK001, FR-011).
import type { Preset } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { replaceQueue } from '../api/sdk.ts';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import { usePresetsStore } from '../stores/presets.ts';
import { useUserStore } from '../stores/user.ts';
import type { AppUser } from '../types/user.ts';
import expected from '../../fixtures/interfaces/snapshot/expected.content.json';
import { usePreset } from './use-preset.ts';

const bookmark = { id: 4, collection: 'bo_std', user: 'u1', role: null, bookmark: 'Mine', layout: 'cards' } as Preset;

function api() {
	let id = 100;
	const echo = ({ init }: { init: RequestInit }) => json({ data: { id: id++, ...JSON.parse(String(init.body)) } });
	return mockApi({ 'POST /presets': echo, 'PATCH /presets/100': echo, 'PATCH /presets/4': echo });
}

function body(fetch: ReturnType<typeof mockApi>, index: number) {
	return JSON.parse(String(fetch.mock.calls[index]![1]!.body));
}

beforeEach(async () => {
	// A queue without the 500 ms interval of the app, whose timer would be lost when switching fake/real timers.
	await replaceQueue();
	setActivePinia(createPinia());
	vi.useFakeTimers();
	useUserStore().currentUser = { id: 'u1', role: null } as AppUser;
	usePresetsStore().collectionPresets = [bookmark];
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('collection preset (no bookmark)', () => {
	test('first change: POST of the whole default preset after 450 ms, as the Directus app (CHK001)', async () => {
		const fetch = api();
		const { layoutQuery, localPreset } = usePreset(ref('bo_std'));

		layoutQuery.value = { sort: ['-input_default'], page: 1 };
		await vi.advanceTimersByTimeAsync(449);
		expect(calls(fetch)).toEqual([]);

		await vi.advanceTimersByTimeAsync(1);
		expect(calls(fetch)).toEqual(['POST /presets']);
		expect(body(fetch, 0)).toEqual({ ...expected.presetFirstWrite.body, user: 'u1' });
		expect(localPreset.value).toMatchObject({ id: 100, user: 'u1' });
	});

	test('later changes PATCH the whole local preset, debounced', async () => {
		const fetch = api();
		const { layout, search } = usePreset(ref('bo_std'));

		search.value = 'a';
		await vi.advanceTimersByTimeAsync(450);
		search.value = 'ab';
		layout.value = 'cards';
		await vi.advanceTimersByTimeAsync(450);

		expect(calls(fetch)).toEqual(['POST /presets', 'PATCH /presets/100']);
		expect(body(fetch, 1)).toMatchObject({ search: 'ab', layout: 'cards', collection: 'bo_std', user: 'u1' });
		expect(body(fetch, 1)).not.toHaveProperty('id');
	});

	test('resetPreset saves at once with the tabular defaults', async () => {
		const fetch = api();
		const { resetPreset, layout } = usePreset(ref('bo_std'));

		await resetPreset();
		await vi.advanceTimersByTimeAsync(0);

		expect(calls(fetch)).toEqual(['POST /presets']);
		expect(body(fetch, 0)).toMatchObject({ layout: 'tabular', layout_query: null, filter: null, search: null });
		expect(layout.value).toBe('tabular');
	});

	test('temporary presets and share sessions never write (FR-084)', async () => {
		const fetch = api();
		usePreset(ref('bo_std'), ref(null), true).search.value = 'x';
		await vi.advanceTimersByTimeAsync(450);

		useUserStore().currentUser = { share: 's1', app_access: false, admin_access: false };
		const shared = usePreset(ref('bo_std'));
		shared.search.value = 'y';
		await vi.advanceTimersByTimeAsync(450);

		expect(calls(fetch)).toEqual([]);
		expect(shared.bookmarkIsMine.value).toBe(false);
	});
});

describe('bookmark', () => {
	test('changes are not saved; bookmarkSaved compares deeply; clearLocalSave restores', async () => {
		const fetch = api();
		const { layout, bookmarkSaved, bookmarkExists, bookmarkIsMine, bookmarkTitle, clearLocalSave } = usePreset(
			ref('bo_std'),
			ref(4),
		);

		expect([bookmarkExists.value, bookmarkIsMine.value, bookmarkTitle.value, layout.value]).toEqual([
			true,
			true,
			'Mine',
			'cards',
		]);

		layout.value = 'tabular';
		await vi.advanceTimersByTimeAsync(450);
		expect(bookmarkSaved.value).toBe(false);
		expect(calls(fetch)).toEqual([]);

		layout.value = 'cards';
		expect(bookmarkSaved.value).toBe(true);

		layout.value = 'map';
		clearLocalSave();
		expect([layout.value, bookmarkSaved.value]).toEqual(['cards', true]);
	});

	test('renaming saves at once; saveCurrentAsBookmark creates a bookmark of the user without id', async () => {
		const fetch = api();
		const { bookmarkTitle, saveCurrentAsBookmark } = usePreset(ref('bo_std'), ref(4));

		bookmarkTitle.value = 'Renamed';
		await vi.advanceTimersByTimeAsync(0);
		await saveCurrentAsBookmark({ bookmark: 'Copy' });

		expect(calls(fetch)).toEqual(['PATCH /presets/4', 'POST /presets']);
		expect(body(fetch, 0)).toMatchObject({ bookmark: 'Renamed' });
		expect(body(fetch, 1)).toMatchObject({ bookmark: 'Copy', user: 'u1', layout: 'cards' });
		expect(body(fetch, 1)).not.toHaveProperty('id');
	});
});
