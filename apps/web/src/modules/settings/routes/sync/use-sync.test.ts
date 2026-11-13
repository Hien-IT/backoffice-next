// Backoffice (spec 032, T046, T054): the page state of Environment Sync: phases, what is sent, nothing kept, and how
// ticks follow dependencies and cascades.
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { apiFetch } from '../../../../api/sdk.ts';
import type { SyncDiff, SyncRow } from './types.ts';
import { reasonMessage, useSync } from './use-sync.ts';

vi.mock('../../../../api/sdk.ts', () => ({ apiFetch: vi.fn() }));

const answer = (status: number, body: unknown) =>
	({ ok: status < 400, status, statusText: 'x', json: async () => body }) as unknown as Response;

const row = (id: string, over: Partial<SyncRow> = {}): SyncRow => ({
	id,
	group: (id.split('/')[0] as SyncRow['group']) ?? 'flows',
	kind: id.split('/')[1]!.split(':')[0]!,
	key: id.split(':')[1]!,
	label: id,
	state: 'source_only',
	depends: [],
	cascade: [],
	selectable: true,
	...over,
});

const DIFF: SyncDiff = {
	hash: 'h1',
	source: { backoffice: '1.0.0', directus: '11.17.4', vendor: 'postgres' },
	groups: ['schema', 'access', 'presets'],
	rows: [
		row('schema/collection:a'),
		row('access/policy:p'),
		row('access/permission:p:a:read', { depends: ['access/policy:p', 'schema/collection:a'] }),
		row('access/policy:old', { state: 'target_only', cascade: ['access/permission:old:a:read'] }),
		row('access/permission:old:a:read', { state: 'target_only' }),
		row('access/policy:admin', { state: 'target_only', selectable: false, reason: 'sync_admin_protected' }),
		row('access/role:same', { state: 'same', selectable: false }),
		row('presets/preset:a:x', { state: 'changed', depends: ['schema/collection:a'] }),
	],
};

let storageSet: ReturnType<typeof vi.spyOn>;

function setup() {
	let api!: ReturnType<typeof useSync>;
	const wrapper = mount(defineComponent({ setup: () => ((api = useSync()), () => h('div')) }));
	return { api, wrapper };
}

beforeEach(() => {
	storageSet = vi.spyOn(Storage.prototype, 'setItem');
});

afterEach(() => {
	vi.clearAllMocks();
	storageSet.mockRestore();
});

test('compare sends url, token and groups in the body; the phase moves; an error goes back to idle', async () => {
	const { api } = setup();
	api.url.value = 'https://stg.example.com';
	api.token.value = 'secret';
	api.groups.value = ['flows'];

	vi.mocked(apiFetch).mockResolvedValueOnce(
		answer(400, { errors: [{ extensions: { reason: 'The source rejected the token' } }] }),
	);
	await api.compare();
	expect(api.phase.value).toBe('idle');
	expect(api.error.value?.errors?.[0]?.extensions?.reason).toBe('The source rejected the token');

	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: DIFF }));
	await api.compare();
	expect(api.phase.value).toBe('compared');
	expect(api.error.value).toBeNull();

	const [path, init] = vi.mocked(apiFetch).mock.calls[1]!;
	expect(path).toBe('/backoffice/sync/diff');
	expect(JSON.parse(init!.body as string)).toEqual({
		url: 'https://stg.example.com',
		token: 'secret',
		groups: ['flows'],
	});
});

test('apply sends the hash, groups and ticked ids; "out of date" keeps the comparison; nothing is stored', async () => {
	const { api, wrapper } = setup();
	api.url.value = 'https://stg';
	api.token.value = 'secret';
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: DIFF }));
	await api.compare();

	api.toggle(DIFF.rows[0]!, true);
	vi.mocked(apiFetch).mockResolvedValueOnce(
		answer(400, { errors: [{ extensions: { reason: 'The comparison is out of date, compare again' } }] }),
	);
	await api.apply();
	expect(api.phase.value).toBe('compared');

	vi.mocked(apiFetch).mockResolvedValueOnce(
		answer(200, { data: { created: {}, updated: {}, deleted: {}, deletedLabels: [], indexes: [], warnings: [] } }),
	);
	await api.apply();
	expect(api.phase.value).toBe('done');
	expect(JSON.parse(vi.mocked(apiFetch).mock.calls[2]![1]!.body as string)).toEqual({
		url: 'https://stg',
		token: 'secret',
		hash: 'h1',
		groups: ['schema', 'access', 'presets'],
		selected: ['schema/collection:a'],
	});

	expect(storageSet).not.toHaveBeenCalled();
	wrapper.unmount();
	expect(api.url.value).toBe('');
	expect(api.token.value).toBe('');
});

test('a tick takes its dependencies; an untick drops the rows that need it', async () => {
	const { api } = setup();
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: DIFF }));
	await api.compare();

	api.toggle(DIFF.rows[2]!, true);
	expect([...api.selected.value].sort()).toEqual([
		'access/permission:p:a:read',
		'access/policy:p',
		'schema/collection:a',
	]);

	api.toggle(DIFF.rows[0]!, false);
	expect([...api.selected.value]).toEqual(['access/policy:p']);
});

test('the group tick selects creates and updates only, never a delete; partial state; blocked rows stay out', async () => {
	const { api } = setup();
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: DIFF }));
	await api.compare();

	api.toggleGroup('access', true);
	expect(api.selected.value.has('access/policy:old')).toBe(false);
	expect(api.selected.value.has('access/policy:admin')).toBe(false);
	expect(api.selected.value.has('access/permission:p:a:read')).toBe(true);
	expect(api.groupState('access')).toBe('all');
	expect(api.groupState('presets')).toBe('none');

	api.toggle(DIFF.rows[1]!, false);
	expect(api.groupState('access')).toBe('none');
});

test('a delete ticks and locks its cascade until the delete is unticked', async () => {
	const { api } = setup();
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: DIFF }));
	await api.compare();

	const root = DIFF.rows[3]!;
	const child = DIFF.rows[4]!;
	api.toggle(root, true);
	expect(api.selected.value.has(child.id)).toBe(true);
	expect(api.isLocked(child)).toBe(true);

	api.toggle(child, false);
	expect(api.selected.value.has(child.id)).toBe(true);

	api.toggle(root, false);
	expect(api.selected.value.size).toBe(0);
});

test('the state filter and the reason messages', async () => {
	const { api } = setup();
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: DIFF }));
	await api.compare();

	expect(api.rows.value.filter(api.visible)).toHaveLength(7);
	api.filter.value = 'target_only';
	expect(api.rows.value.filter(api.visible)).toHaveLength(3);

	expect(reasonMessage('Version mismatch: source Backoffice 1.0.0, target 1.2.0')).toEqual({
		key: 'sync_error_version',
		params: { app: 'Backoffice', source: '1.0.0', target: '1.2.0' },
	});
	expect(reasonMessage('Migration mismatch: 3 differ')).toEqual({
		key: 'sync_error_migrations',
		params: { count: '3' },
	});
	expect(reasonMessage('The source timed out')).toEqual({ key: 'sync_error_timeout' });
	expect(reasonMessage('something else')).toBeUndefined();
});
