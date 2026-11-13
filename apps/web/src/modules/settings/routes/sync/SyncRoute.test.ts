// Backoffice (spec 032, T047, T055, contracts/web.md): the Environment Sync page: hidden at DR, connect and compare,
// errors in words, the rows per group, the confirm dialog and the result.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { apiFetch } from '../../../../api/sdk.ts';
import { resetNotices } from '../../../../composables/use-notices.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import SyncRoute from './SyncRoute.vue';
import type { SyncDiff, SyncRow } from './types.ts';

vi.mock('../../../../api/sdk.ts', async (importOriginal) => ({
	...(await importOriginal<object>()),
	apiFetch: vi.fn(),
}));

const probe = vi.hoisted(() => ({ available: { value: true } }));
vi.mock('../../../../composables/use-environment-sync.ts', async () => {
	const { ref } = await import('vue');
	const available = ref(true);
	probe.available = available;
	return { useEnvironmentSync: () => ({ available, ready: Promise.resolve(available.value) }) };
});

enableAutoUnmount(afterEach);

afterEach(() => {
	vi.mocked(apiFetch).mockReset();
	probe.available.value = true;
	resetNotices();
});

const answer = (status: number, body: unknown) =>
	({ ok: status < 400, status, statusText: 'x', json: async () => body }) as unknown as Response;

const row = (id: string, over: Partial<SyncRow> = {}): SyncRow => ({
	id,
	group: id.split('/')[0] as SyncRow['group'],
	kind: id.split('/')[1]!.split(':')[0]!,
	key: id.split(':')[1]!,
	label: id.split(':')[1]!,
	state: 'source_only',
	depends: [],
	cascade: [],
	selectable: true,
	...over,
});

const DIFF: SyncDiff = {
	hash: 'h1',
	source: { backoffice: '1.0.0', directus: '11.17.4', vendor: 'postgres' },
	groups: ['flows', 'access'],
	rows: [
		row('flows/flow:Nightly', { impact: { active: true }, source: { id: 'f', name: 'Nightly', status: 'active' } }),
		row('flows/flow:Old', { state: 'target_only', target: { id: 'o', name: 'Old' } }),
		row('access/policy:Editors', {
			state: 'changed',
			changes: [{ path: 'name', source: 'Editors', target: 'Editor' }],
		}),
		row('access/policy:Admins', { state: 'target_only', selectable: false, reason: 'sync_admin_protected' }),
	],
};

async function mountPage() {
	const { wrapper } = await mountLayout(SyncRoute, { path: '/settings/sync' });
	await flushPromises();
	return wrapper;
}

/** Buttons anywhere in the document (the page header actions and the dialogs are teleported). */
const bodyButton = (match: (text: string) => boolean) =>
	[...document.body.querySelectorAll('button')]
		.filter((b) => match(b.textContent?.trim() ?? ''))
		.pop() as HTMLButtonElement;

async function connect(wrapper: Awaited<ReturnType<typeof mountPage>>) {
	await wrapper.get('input[type="url"]').setValue('https://stg.example.com');
	await wrapper.get('input[type="password"]').setValue('stg-token');
	await wrapper.get('form').trigger('submit');
	await flushPromises();
}

test('at DR (probe 404) the page is the Settings not-found page', async () => {
	probe.available.value = false;
	const wrapper = await mountPage();
	expect(wrapper.find('input[type="password"]').exists()).toBe(false);
});

test('the token field is a password field the browser is asked not to keep (FR-034)', async () => {
	const wrapper = await mountPage();
	const token = wrapper.get('input[type="password"]');
	expect(token.attributes('autocomplete')).toBe('off');
});

test('compare: rows per group with their state in words; a row detail shows source and target', async () => {
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: DIFF }));
	const wrapper = await mountPage();
	await connect(wrapper);

	expect(vi.mocked(apiFetch).mock.calls[0]![0]).toBe('/backoffice/sync/diff');
	const text = wrapper.text();
	expect(text).toContain('Source: Backoffice 1.0.0 on postgres');
	expect(text).toContain('Nightly');
	expect(text).toContain('Only at source');
	expect(text).toContain('Admin access, cannot be deleted');

	const detail = wrapper.findAll('button').find((b) => b.text() === 'Editors')!;
	await detail.trigger('click');
	await flushPromises();
	expect(document.body.textContent).toContain('Editor');
});

test('errors read in words: a wrong token, another version with both versions', async () => {
	vi.mocked(apiFetch).mockResolvedValueOnce(
		answer(400, { errors: [{ extensions: { code: 'INVALID_PAYLOAD', reason: 'The source rejected the token' } }] }),
	);

	const wrapper = await mountPage();
	await connect(wrapper);
	expect(wrapper.text()).toContain('The source rejected the token.');

	vi.mocked(apiFetch).mockResolvedValueOnce(
		answer(400, {
			errors: [
				{ extensions: { code: 'INVALID_PAYLOAD', reason: 'Version mismatch: source Backoffice 1.0.0, target 1.2.0' } },
			],
		}),
	);

	await wrapper.get('form').trigger('submit');
	await flushPromises();
	expect(wrapper.text()).toContain('Versions differ: source Backoffice 1.0.0, here 1.2.0.');
});

test('apply: the confirm dialog lists deletes and flows that start; confirm sends the selection; result shown', async () => {
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: DIFF }));
	const wrapper = await mountPage();
	await connect(wrapper);

	const tick = (name: string) => wrapper.get(`[aria-label="Select ${name}"]`);
	await tick('Nightly').trigger('click');
	await tick('Old').trigger('click');
	await flushPromises();

	const applyButton = bodyButton((text) => text.includes('Apply ('));
	expect(applyButton.textContent).toContain('Apply (2)');
	applyButton.click();
	await flushPromises();

	const dialog = document.body.textContent ?? '';
	expect(dialog).toContain('Apply environment sync?');
	expect(dialog).toContain('Deleted here');
	expect(dialog).toContain('Flow: Old');
	expect(dialog).toContain('These flows are active and start running here at once');
	expect(dialog).toContain('Deletes cannot be undone.');

	vi.mocked(apiFetch).mockResolvedValueOnce(
		answer(200, {
			data: {
				created: { flows: 1 },
				updated: {},
				deleted: { flows: 1 },
				deletedLabels: ['Old'],
				indexes: [],
				warnings: [],
			},
		}),
	);

	bodyButton((text) => text === 'Apply').click();
	await flushPromises();

	const [path, init] = vi.mocked(apiFetch).mock.calls[1]!;
	expect(path).toBe('/backoffice/sync/apply');
	expect(JSON.parse(init!.body as string)).toMatchObject({
		hash: 'h1',
		selected: expect.arrayContaining(['flows/flow:Nightly', 'flows/flow:Old']),
	});
	expect(wrapper.text()).toContain('Applied');
	expect(wrapper.text()).toContain('Deleted: Old');
});

test('a stale comparison shows the reason and a Compare again button', async () => {
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: DIFF }));
	const wrapper = await mountPage();
	await connect(wrapper);

	await wrapper.get('[aria-label="Select Nightly"]').trigger('click');
	bodyButton((text) => text.includes('Apply (')).click();
	await flushPromises();

	vi.mocked(apiFetch).mockResolvedValueOnce(
		answer(400, {
			errors: [{ extensions: { code: 'INVALID_PAYLOAD', reason: 'The comparison is out of date, compare again' } }],
		}),
	);
	bodyButton((text) => text === 'Apply').click();
	await flushPromises();

	expect(wrapper.text()).toContain('One of the environments changed after the comparison. Compare again.');
	expect(bodyButton((text) => text === 'Compare again')).toBeTruthy();
});
