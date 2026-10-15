// T069 (FR-072, FR-073, FR-081, recipe Q-10): the comparison modal on the fixture API (bo_content item 1, its
// versions and revisions) in a real browser: differing fields with checkboxes, "show differences only", promote with
// and without deleting the version, update permission, revision restore, focus back on the opener.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import type { Revision } from '../../types/revisions.ts';
import type { ContentVersionWithType } from '../../types/versions.ts';
import ComparisonModal from './ComparisonModal.vue';

enableAutoUnmount(afterEach);

const snapshot = loadSnapshot();
let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(snapshot);
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
	fetch.mockClear();
});

afterEach(() => {
	// MapLibre (location field) fetches its tiles with Request objects, outside the API.
	const api = fetch.mock.calls.filter(([input]) => !(input instanceof Request));
	assertOnlyKnownRequests(calls({ mock: { calls: api } } as typeof fetch));
});

const version = {
	...snapshot.versions.find((v) => v['id'] === 'bo-19'),
	type: 'local',
} as unknown as ContentVersionWithType;

const user = { id: 'bo-1', email: 'admin@example.com', first_name: 'Admin', last_name: 'User' };

const revisions = (snapshot.revisions['bo_content'] as unknown as Revision[])
	.filter((r) => r.activity.action !== 'version_save')
	.map((r, index) => ({
		...r,
		activity: { ...r.activity, timestamp: new Date(2026, 9, 1 + index, 9).toISOString(), user },
	})) as Revision[];

function setup(props: Record<string, unknown>) {
	const active = ref(false);
	const currentRevision = ref<Revision | null>((props['currentRevision'] as Revision | undefined) ?? null);
	const events = { cancel: vi.fn(), promote: vi.fn(), confirm: vi.fn() };

	const Harness = defineComponent({
		setup: () => () => [
			h('button', { type: 'button', 'data-opener': '', onClick: () => (active.value = true) }, 'Open'),
			h(ComparisonModal, {
				collection: 'bo_content',
				primaryKey: '1',
				deleteVersionsAllowed: false,
				currentVersion: null,
				...props,
				modelValue: active.value,
				'onUpdate:modelValue': (value: boolean | undefined) => (active.value = !!value),
				currentRevision: currentRevision.value,
				'onUpdate:currentRevision': (value: Revision | null | undefined) => (currentRevision.value = value ?? null),
				onCancel: () => {
					events.cancel();
					active.value = false;
				},
				onPromote: events.promote,
				onConfirm: events.confirm,
			} as never),
		],
	});

	mount(Harness, { global: { plugins: [i18n] }, attachTo: document.body });

	return { events, currentRevision };
}

async function open() {
	const opener = document.querySelector<HTMLButtonElement>('[data-opener]')!;
	await userEvent.click(opener);
	await vi.waitFor(() => expect(document.querySelector('[data-comparison-side="incoming"]')).not.toBeNull(), 5000);
	await flushPromises();
	return opener;
}

const modal = () => document.querySelector<HTMLElement>('[data-comparison-modal]')!;
const fieldsOf = (side: string) =>
	[...document.querySelectorAll(`[data-comparison-side="${side}"] [data-field]`)].map((el) =>
		el.getAttribute('data-field'),
	);
const button = (text: string) =>
	[...modal().querySelectorAll('button')].find((b) => b.textContent?.trim().endsWith(text))!;

test('version: the differing field is checked, others are not selectable; Esc closes and focus returns', async () => {
	const { events } = setup({ mode: 'version', currentVersion: version });
	const opener = await open();

	expect(modal().textContent).toContain('1 Difference');
	expect(document.querySelectorAll('[data-comparison-side="base"] [data-comparison-checkbox]')).toHaveLength(0);
	const boxes = document.querySelectorAll('[data-comparison-side="incoming"] [data-comparison-checkbox]');
	expect(boxes).toHaveLength(1);
	expect(boxes[0]!.closest('[data-field]')!.getAttribute('data-field')).toBe('status');
	expect(boxes[0]!.getAttribute('data-state')).toBe('checked');
	expect(fieldsOf('incoming')).toContain('title');

	await userEvent.click(modal().querySelector('[role="switch"]')!);
	await vi.waitFor(() => expect(fieldsOf('incoming')).toEqual(['status']));
	expect(fieldsOf('base')).toEqual(['status']);

	await userEvent.keyboard('{Escape}');
	await vi.waitFor(() => expect(document.querySelector('[data-comparison-modal]')).toBeNull());
	expect(events.cancel).toHaveBeenCalledOnce();
	expect(document.activeElement).toBe(opener);
});

test('version: promote sends mainHash and the selected fields; the delete checkbox is passed on', async () => {
	const { events } = setup({ mode: 'version', currentVersion: version, deleteVersionsAllowed: true });
	await open();

	const deleteBox = [...modal().querySelectorAll('label')].find((l) => l.textContent?.includes('after promotion'))!;
	await userEvent.click(deleteBox);
	fetch.mockClear();
	await userEvent.click(button('Apply'));

	await vi.waitFor(() => expect(events.promote).toHaveBeenCalled());
	const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
	expect(String(post[0])).toContain('/versions/bo-19/promote');
	expect(JSON.parse(String(post[1]!.body))).toEqual({ mainHash: 'bo-hash', fields: ['status'] });
	expect(events.promote).toHaveBeenCalledWith(true);
});

test('version: Apply is disabled without update permission on the main item', async () => {
	setup({ mode: 'version', currentVersion: version, updateAllowed: false });
	await open();

	expect(button('Apply').disabled).toBe(true);
});

test('revision: compared to the previous revision, Apply is disabled with its hint; Latest restores', async () => {
	const { events } = setup({ mode: 'revision', revisions, currentRevision: revisions[2] });
	await open();

	expect(modal().textContent).toContain(String(i18n.global.t('previous_revision')));
	expect(button('Apply').disabled).toBe(true);
	expect(modal().textContent).toContain(String(i18n.global.t('compare_to_latest_to_restore')));
	expect(document.querySelectorAll('[data-comparison-checkbox]')).toHaveLength(0);

	await userEvent.click(modal().querySelector('[data-comparison-toggle]')!);
	const latest = await vi.waitFor(() => {
		const item = [...document.querySelectorAll('[role="menuitem"]')].find((el) =>
			el.textContent?.includes(String(i18n.global.t('latest_revision'))),
		);
		expect(item).toBeDefined();
		return item as HTMLElement;
	});
	await userEvent.click(latest);
	await vi.waitFor(() =>
		expect(modal().textContent).toContain(String(i18n.global.t('select_earlier_revision_to_restore'))),
	);

	// The latest revision equals the main item: nothing to restore.
	expect(button('Apply').disabled).toBe(true);
	expect(events.confirm).not.toHaveBeenCalled();
});

test('revision: the first revision is compared to the latest; Apply emits the raw values of the selected fields', async () => {
	const { events } = setup({ mode: 'revision', revisions, currentRevision: revisions[0] });
	await open();

	expect(modal().textContent).toContain(String(i18n.global.t('latest')));
	expect(button('Apply').disabled).toBe(false);

	await userEvent.click(button('Apply'));

	expect(events.confirm).toHaveBeenCalledOnce();
	const values = events.confirm.mock.calls[0]![0];
	expect(values).toMatchObject({ title: 'Content 01', body: 'Body of content 1' });
	expect(values).not.toHaveProperty('id');
	expect(events.cancel).toHaveBeenCalledOnce();
});
