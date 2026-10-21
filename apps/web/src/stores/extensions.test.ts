// Directus has no test for its extensions store (spec 020 T090): refresh with the "reload required" notice when the
// enabled app or hybrid extensions change, toggleState and remove call the API then refresh.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { resetNotices, useNotices } from '../composables/use-notices.ts';
import { useExtensionsStore } from './extensions.ts';

const request = vi.fn();

vi.mock('../api/sdk.ts', () => ({
	sdk: { request: (command: () => unknown) => request(command()) },
	requestEndpoint: (path: string, options: object) => () => ({ path, ...options }),
}));

const ext = (id: string, type: string | null, enabled = true, bundle: string | null = null, partial?: boolean) => ({
	id,
	bundle,
	schema: type ? { type, name: id, ...(partial === undefined ? {} : { partial }) } : null,
	meta: { enabled, folder: id, source: 'local', bundle },
});

beforeEach(() => {
	setActivePinia(createPinia());
	request.mockReset();
	resetNotices();
});

const settle = () => new Promise((resolve) => setTimeout(resolve));

test('loads the list on creation without a notice', async () => {
	request.mockResolvedValue([ext('a', 'interface')]);

	const store = useExtensionsStore();
	await settle();

	expect(request).toHaveBeenCalledWith({ path: '/extensions', method: 'GET' });
	expect(store.extensionIds).toEqual(['a']);
	expect(useNotices().queue.value).toEqual([]);
});

test('a change of the enabled app extensions shows the persistent reload notice once', async () => {
	request.mockResolvedValueOnce([ext('a', 'interface'), ext('h', 'hook')]);
	const store = useExtensionsStore();
	await settle();

	// a hook only: no reload needed
	request.mockResolvedValueOnce([ext('a', 'interface'), ext('h', 'hook', false)]);
	await store.refresh();
	expect(useNotices().queue.value).toEqual([]);

	request.mockResolvedValueOnce([ext('a', 'interface', false), ext('h', 'hook', false)]);
	await store.refresh();

	expect(useNotices().queue.value).toMatchObject([
		{ id: 'reload-required', type: 'warning', persist: true, title: 'Reload Required', dismissIcon: 'refresh' },
	]);

	request.mockResolvedValueOnce([ext('a', 'interface')]);
	await store.refresh();
	expect(useNotices().queue.value).toHaveLength(1);
});

test('bundle entries count; a non partial bundle counts itself when an entry is enabled', async () => {
	request.mockResolvedValueOnce([ext('b', 'bundle', true, null, false), ext('e', 'interface', true, 'b')]);
	const store = useExtensionsStore();
	await settle();

	request.mockResolvedValueOnce([ext('b', 'bundle', true, null, false), ext('e', 'interface', false, 'b')]);
	await store.refresh();

	expect(useNotices().queue.value).toHaveLength(1);
});

test('toggleState patches the opposite state, remove deletes; both refresh', async () => {
	request.mockResolvedValue([ext('a', 'hook')]);
	const store = useExtensionsStore();
	await settle();
	request.mockClear();

	await store.toggleState('a');
	await store.remove('a');

	expect(request.mock.calls.map(([call]) => call)).toEqual([
		{ path: '/extensions/a', method: 'PATCH', body: { meta: { enabled: false } } },
		{ path: '/extensions', method: 'GET' },
		{ path: '/extensions/a', method: 'DELETE' },
		{ path: '/extensions', method: 'GET' },
	]);

	await expect(store.toggleState('nope')).rejects.toThrow('Extension with ID nope does not exist');
});
