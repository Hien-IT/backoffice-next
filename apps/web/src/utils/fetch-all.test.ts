import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { useServerStore } from '../stores/server.ts';
import { fetchAll } from './fetch-all.ts';

const request = vi.fn();

vi.mock('../api/sdk.ts', () => ({
	sdk: { request: (command: () => unknown) => request(command()) },
	requestEndpoint: (path: string, options: object) => () => ({ path, ...options }),
}));

beforeEach(() => {
	setActivePinia(createPinia());
	request.mockReset();
});

test('one request with limit -1 when the server has no query limit', async () => {
	request.mockResolvedValue([{ id: 1 }]);

	expect(await fetchAll('/translations', { params: { fields: ['key'] } })).toEqual([{ id: 1 }]);

	expect(request).toHaveBeenCalledTimes(1);
	expect(request).toHaveBeenCalledWith({
		path: '/translations',
		method: 'GET',
		params: { fields: ['key'], limit: -1 },
	});
});

test('one request with limit -1 when QUERY_LIMIT_MAX is -1', async () => {
	useServerStore().info.queryLimit = { default: 100, max: -1 };
	request.mockResolvedValue([]);

	await fetchAll('/presets');

	expect(request).toHaveBeenCalledWith({ path: '/presets', method: 'GET', params: { limit: -1 } });
});

test('pages of queryLimit.max until an empty page, cut to limit', async () => {
	useServerStore().info.queryLimit = { default: 100, max: 2 };
	request.mockResolvedValueOnce([1, 2]).mockResolvedValueOnce([3]).mockResolvedValueOnce([]);

	expect(await fetchAll('/presets', { params: { sort: 'id' } })).toEqual([1, 2, 3]);

	expect(request.mock.calls.map(([c]) => c.params)).toEqual([
		{ sort: 'id', page: 1, limit: 2 },
		{ sort: 'id', page: 2, limit: 2 },
		{ sort: 'id', page: 3, limit: 2 },
	]);

	request.mockReset();
	request.mockResolvedValueOnce([1, 2]).mockResolvedValueOnce([3, 4]);

	expect(await fetchAll('/presets', {}, 3)).toEqual([1, 2, 3]);
	expect(request).toHaveBeenCalledTimes(2);
});
