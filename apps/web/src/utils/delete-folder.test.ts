// Ported from directus/app/src/utils/delete-folder.test.ts
// Backoffice: the requests go through the SDK, so the mock records { path, method, params, body } commands.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { moveAndDelete, moveSingleFolder, recursiveDelete } from './delete-folder.ts';

type Call = { path: string; method: string; params?: Record<string, unknown>; body?: unknown };

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/sdk.ts', () => ({
	sdk: { request: (command: () => unknown) => request(command()) },
	requestEndpoint: (path: string, options: object) => () => ({ path, ...options }),
}));

const folder = (id: string, parent: string | null = null) => ({ id, name: id, parent });
const calls = (method: string) => request.mock.calls.map(([call]) => call as Call).filter((c) => c.method === method);

/** GET answers in order, then an empty list; writes resolve to undefined. */
function answerGets(...lists: { id: string }[][]) {
	request.mockImplementation((call: Call) => Promise.resolve(call.method === 'GET' ? (lists.shift() ?? []) : undefined));
}

afterEach(() => {
	vi.resetAllMocks();
});

describe('moveSingleFolder', () => {
	it('moves child folders and files to parent', async () => {
		answerGets([{ id: 'child-folder' }], [{ id: 'child-file' }]);

		await moveSingleFolder(folder('f1', 'parent-1'));

		expect(calls('GET')).toEqual([
			{ path: '/folders', method: 'GET', params: { filter: { parent: { _eq: 'f1' } }, fields: ['id'], limit: -1 } },
			{ path: '/files', method: 'GET', params: { filter: { folder: { _eq: 'f1' } }, fields: ['id'], limit: -1 } },
		]);

		expect(calls('PATCH')).toEqual([
			{ path: '/folders', method: 'PATCH', body: { keys: ['child-folder'], data: { parent: 'parent-1' } } },
			{ path: '/files', method: 'PATCH', body: { keys: ['child-file'], data: { folder: 'parent-1' } } },
		]);
	});

	it('skips patch when no children', async () => {
		answerGets([], []);

		await moveSingleFolder(folder('f1', null));

		expect(calls('PATCH')).toEqual([]);
	});

	it('uses null parent for root folder', async () => {
		answerGets([{ id: 'child-folder' }], []);

		await moveSingleFolder(folder('f1', null));

		expect(calls('PATCH')).toEqual([
			{ path: '/folders', method: 'PATCH', body: { keys: ['child-folder'], data: { parent: null } } },
		]);
	});
});

describe('moveAndDelete', () => {
	it('moves contents of all folders then deletes them', async () => {
		answerGets();

		await moveAndDelete([folder('f1'), folder('f2')]);

		expect(calls('DELETE')).toEqual([{ path: '/folders', method: 'DELETE', body: ['f1', 'f2'] }]);
	});
});

describe('recursiveDelete', () => {
	it('deletes folder, its descendants, and all contained files', async () => {
		const all = [folder('root'), folder('child', 'root'), folder('grandchild', 'child')];

		answerGets([{ id: 'file-1' }, { id: 'file-2' }]);

		await recursiveDelete([folder('root')], all);

		const [files, folders] = calls('DELETE');

		expect(files).toEqual({ path: '/files', method: 'DELETE', body: ['file-1', 'file-2'] });
		expect(folders?.body).toEqual(expect.arrayContaining(['root', 'child', 'grandchild']));
		expect(calls('GET')[0]?.params).toEqual({
			filter: { folder: { _in: expect.arrayContaining(['root', 'child', 'grandchild']) } },
			fields: ['id'],
			limit: -1,
		});
	});

	it('nullifies parents of nested folders before delete to avoid FK issues', async () => {
		answerGets([]);

		await recursiveDelete([folder('root')], [folder('root'), folder('child', 'root')]);

		expect(calls('PATCH')).toEqual([
			{ path: '/folders', method: 'PATCH', body: { keys: ['child'], data: { parent: null } } },
		]);
	});

	it('deletes files before folders', async () => {
		answerGets([{ id: 'f1' }]);

		await recursiveDelete([folder('root')], [folder('root')]);

		expect(calls('DELETE').map((c) => c.path)).toEqual(['/files', '/folders']);
	});

	it('skips file delete when no files', async () => {
		answerGets([]);

		await recursiveDelete([folder('root')], [folder('root')]);

		expect(calls('DELETE')).toEqual([{ path: '/folders', method: 'DELETE', body: ['root'] }]);
	});
});
