// Ported from directus/app/src/views/private/components/export-sidebar-detail.test.ts
// Backoffice: mounted on the fixture API (collection bo_content, 30 items) instead of mocked composables; the
// InterfaceSystemFields stub becomes the field chips and the FieldList of the popover. Added: import (progress,
// background, FAILED_VALIDATION dialog), download through fetch -> blob -> saveAs, save to the library, the lock to
// `files` when the export count is > queryLimit.max or >= 2500, the count debounce and "download current page".
import type { Field } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import fileSaver from 'file-saver';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../api/sdk.ts';
import { resetNotices, useNotices } from '../../composables/use-notices.ts';
import { i18n } from '../../lang/index.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useServerStore } from '../../stores/server.ts';
import { useUserStore } from '../../stores/user.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { uploadWithProgress } from '../../utils/upload-with-progress.ts';
import BoChip from '../BoChip.vue';
import BoInput from '../BoInput.vue';
import BoRadio from '../BoRadio.vue';
import FieldList from '../FieldList.vue';
import ExportSidebarDetail from './ExportSidebarDetail.vue';
import ImportErrorDialog from './ImportErrorDialog.vue';

vi.mock('../../interfaces/_system/system-filter/SystemFilter.vue', () => ({
	__esModule: true,
	default: { name: 'SystemFilter', props: ['value', 'collectionName'], template: '<div class="system-filter" />' },
}));

vi.mock('../../utils/upload-with-progress.ts', () => ({ uploadWithProgress: vi.fn() }));
vi.mock('file-saver', () => ({ default: { saveAs: vi.fn() } }));

let fetch: ReturnType<typeof mockFixtureApi>;

enableAutoUnmount(afterEach);

async function hydrate(answers: Parameters<typeof mockFixtureApi>[1] = {}) {
	fetch = mockFixtureApi(loadSnapshot(), answers);
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
	fetch.mockClear();
}

beforeEach(async () => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	await replaceQueue();
	setActivePinia(createPinia());
	resetNotices();
	useServerStore().info.queryLimit = { default: 100, max: 5000 };
	useSidebarStore().activeAccordionItem = 'export';
	await hydrate();
});

function mountComponent(props: Record<string, unknown> = {}) {
	return mount(ExportSidebarDetail, {
		props: { collection: 'bo_content', ...props },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

type Wrapper = ReturnType<typeof mountComponent>;

const button = (wrapper: Wrapper, text: string) => wrapper.findAll('button').find((b) => b.text() === text)!;
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const dialogButton = (text: string) =>
	[...dialog()!.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim().endsWith(text))!;
const chips = (wrapper: Wrapper) => wrapper.findAllComponents(BoChip).map((c) => c.props('text'));
const name = (field: string) => useFieldsStore().getField('bo_content', field)!.name;

async function openDialog(wrapper: Wrapper) {
	await button(wrapper, 'Export Items').trigger('click');
	await vi.waitFor(() => expect(dialog()).not.toBeNull(), 2000);
	await flushPromises();
}

describe('export-sidebar-detail default export fields', () => {
	beforeEach(() => {
		useFieldsStore().fields.push(
			{ collection: 'bo_content', field: '$thumbnail', type: 'string', name: 'Thumbnail', meta: null } as Field,
			{ collection: 'bo_content', field: 'notice', type: 'alias', name: 'Notice', meta: null } as Field,
		);
	});

	test('excludes synthetic and alias fields by default', async () => {
		const wrapper = mountComponent();
		await openDialog(wrapper);

		expect(chips(wrapper)).toEqual(
			['id', 'status', 'title', 'body', 'date_published', 'sort', 'author', 'cover', 'tags', 'location'].map(name),
		);
	});

	test('excludes synthetic fields from layout query defaults', async () => {
		const wrapper = mountComponent({ layoutQuery: { fields: ['id', '$thumbnail', 'author.first_name'] } });
		await openDialog(wrapper);

		expect(chips(wrapper)).toEqual(['ID', 'Author -> First Name']);
	});

	test('passes picker filter that excludes synthetic fields', async () => {
		const wrapper = mountComponent();
		await openDialog(wrapper);

		const trigger = [...dialog()!.querySelectorAll('button')].find((b) => b.textContent?.includes('Add Field'))!;
		trigger.click();
		await vi.waitFor(() => expect(wrapper.findComponent(FieldList).exists()).toBe(true), 2000);

		const fieldFilter = wrapper.findComponent(FieldList).props('fieldFilter')!;
		expect(fieldFilter({ field: '$thumbnail' } as Field)).toBe(false);
		expect(fieldFilter({ field: 'thumbnail' } as Field)).toBe(true);
		expect(fieldFilter({ field: 'id' } as Field)).toBe(true);
		expect(wrapper.findComponent(FieldList).props('allowSelectAll')).toBe(true);

		wrapper.findComponent(FieldList).vm.$emit('add', ['id', 'author.first_name']);
		await flushPromises();
		expect(chips(wrapper)).toContain('Author -> First Name');
		expect(chips(wrapper).filter((c) => c === 'ID')).toHaveLength(1);
	});
});

describe('export dialog', () => {
	test('counts the items with the screen filter and search, and lists the defaults', async () => {
		const filter = { id: { _lte: 20 } };
		const wrapper = mountComponent({ filter, layoutQuery: { limit: 10, sort: '-title' } });
		await openDialog(wrapper);

		expect(calls(fetch)[0]).toBe(
			`GET /items/bo_content?filter=${JSON.stringify(filter)}&aggregate={"countDistinct":["id"]}`,
		);
		expect(dialog()!.textContent).toContain('10 out of 20 items within Bo Content will be exported.');
		expect(wrapper.findComponent({ name: 'SystemFilter' }).props('value')).toEqual(filter);
		expect(dialog()!.textContent).toContain('it will be downloaded to your device');
		expect(wrapper.findComponent(BoRadio).props()).toMatchObject({ modelValue: 'download', disabled: false });
		expect(dialog()!.textContent).toContain('Not available for local downloads');
	});

	test('downloads through fetch -> blob -> saveAs with the export query', async () => {
		const wrapper = mountComponent({ layoutQuery: { fields: ['id', 'title'], sort: '-title', limit: 5 } });
		await openDialog(wrapper);
		fetch.mockClear();

		dialogButton('Download File').click();
		await vi.waitFor(() => expect(fileSaver.saveAs).toHaveBeenCalled(), 2000);

		expect(calls(fetch)).toEqual(['GET /items/bo_content?fields=id,title&sort=-title&limit=5&export=csv']);
		const [blob, filename] = vi.mocked(fileSaver.saveAs).mock.calls[0]! as [Blob, string];
		expect(filename).toBe('bo_content.csv');
		expect((await blob.text()).split('\n')).toHaveLength(6);
	});

	test('a failed download opens the error dialog', async () => {
		await hydrate({
			answers: {
				'GET /items/bo_content': ({ url }: { url: URL }) =>
					url.searchParams.has('export')
						? json({ errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }] }, 403)
						: json({ data: [{ countDistinct: { id: '30' } }] }),
			},
		});
		const wrapper = mountComponent();
		await openDialog(wrapper);

		dialogButton('Download File').click();
		await vi.waitFor(() => expect(useNotices().dialogs.value).toHaveLength(1), 2000);
		expect(useNotices().dialogs.value[0]!.code).toBe('FORBIDDEN');
		expect(fileSaver.saveAs).not.toHaveBeenCalled();
	});

	test('saves to the file library with the folder and notifies export_started', async () => {
		const wrapper = mountComponent({ layoutQuery: { fields: ['id'], sort: 'title', limit: 5 } });
		await openDialog(wrapper);
		wrapper.findComponent(BoRadio).vm.$emit('update:modelValue', 'files');
		await flushPromises();
		fetch.mockClear();

		dialogButton('Start Export').click();
		await vi.waitFor(() => expect(dialog()).toBeNull(), 2000);

		const [url, init] = fetch.mock.calls[0]!;
		expect(`${init!.method} ${new URL(String(url)).pathname}`).toBe('POST /utils/export/bo_content');
		expect(JSON.parse(String(init!.body))).toEqual({
			query: { limit: 5, fields: ['id'], sort: ['title'] },
			format: 'csv',
			file: { folder: null },
		});
		expect(useNotices().queue.value.map((n) => n.title)).toEqual(['Export Started']);
		assertOnlyKnownRequests(calls(fetch));
	});

	test('the export button is disabled without fields', async () => {
		const wrapper = mountComponent({ layoutQuery: { fields: ['id'] } });
		await openDialog(wrapper);

		wrapper.findAllComponents(BoChip)[0]!.vm.$emit('remove');
		await flushPromises();
		expect(dialogButton('Download File').disabled).toBe(true);
		expect(dialog()!.textContent).toContain('No fields');
	});

	test('the count follows the search after 250 ms', async () => {
		const wrapper = mountComponent();
		await openDialog(wrapper);
		fetch.mockClear();

		const search = wrapper.findAllComponents(BoInput).find((i) => i.props('label') === 'Full-Text Search')!;
		search.vm.$emit('update:modelValue', 'x');
		search.vm.$emit('update:modelValue', 'xy');
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(calls(fetch)).toEqual([]);

		await vi.waitFor(() => expect(calls(fetch)).toHaveLength(1), 1000);
		expect(calls(fetch)[0]).toBe('GET /items/bo_content?search=xy&aggregate={"countDistinct":["id"]}');
	});

	test('locked to files when the export count is > queryLimit.max; unlocked when it drops', async () => {
		useServerStore().info.queryLimit = { default: 100, max: 100 };
		const rows = fetch.db['bo_content']!;
		rows.push(...Array.from({ length: 120 }, (_, i) => ({ ...rows[0], id: 1000 + i })));

		const wrapper = mountComponent({ layoutQuery: { limit: -1 } });
		await openDialog(wrapper);

		expect(wrapper.findComponent(BoRadio).props()).toMatchObject({ modelValue: 'files', disabled: true });
		expect(dialog()!.textContent).toContain('Exporting all items (150) within Bo Content.');
		expect(dialog()!.textContent).toContain('This export must be processed in batches.');
		expect(dialog()!.querySelector('[role="status"]')).not.toBeNull();

		const limit = wrapper.findAllComponents(BoInput).find((i) => i.props('label') === 'Limit')!;
		limit.vm.$emit('update:modelValue', '100');
		await flushPromises();
		expect(wrapper.findComponent(BoRadio).props()).toMatchObject({ modelValue: 'download', disabled: false });
		expect(dialog()!.textContent).toContain('100 out of 150 items within Bo Content will be exported.');
	});

	test('locked to files when the export count is >= 2500, even without a query limit', async () => {
		useServerStore().info.queryLimit = { default: 100, max: -1 };
		await hydrate({
			answers: { 'GET /items/bo_content': json({ data: [{ countDistinct: { id: '3000' } }] }) },
		});

		const wrapper = mountComponent({ layoutQuery: { limit: -1 } });
		await openDialog(wrapper);
		expect(wrapper.findComponent(BoRadio).props()).toMatchObject({ modelValue: 'files', disabled: true });

		const limit = wrapper.findAllComponents(BoInput).find((i) => i.props('label') === 'Limit')!;
		limit.vm.$emit('update:modelValue', '2499');
		await flushPromises();
		expect(wrapper.findComponent(BoRadio).props()).toMatchObject({ modelValue: 'download', disabled: false });

		limit.vm.$emit('update:modelValue', '2500');
		await flushPromises();
		expect(wrapper.findComponent(BoRadio).props('modelValue')).toBe('files');
	});
});

describe('import', () => {
	async function chooseFile(wrapper: Wrapper, file = new File(['id\n1'], 'items.csv', { type: 'text/csv' })) {
		const input = wrapper.get<HTMLInputElement>('input[type="file"]');
		expect(input.attributes('accept')).toBe('.csv,.json');
		Object.defineProperty(input.element, 'files', { value: { length: 1, item: () => file }, configurable: true });
		await input.trigger('change');
		return file;
	}

	test('uploads with progress, then importing, then refresh and the success notice', async () => {
		let progress: (percent: number) => void = () => {};
		let finish: () => void = () => {};
		vi.mocked(uploadWithProgress).mockImplementation((_path, _form, onProgress) => {
			progress = onProgress!;
			return new Promise((resolve) => (finish = () => resolve(undefined)));
		});

		const wrapper = mountComponent();
		await chooseFile(wrapper);
		expect(wrapper.text()).toContain('items.csv');
		expect(wrapper.text()).toContain('csv');

		await button(wrapper, 'Start Import').trigger('click');
		const [path, form] = vi.mocked(uploadWithProgress).mock.calls[0]!;
		expect(path).toBe('/utils/import/bo_content');
		expect((form.get('file') as File).name).toBe('items.csv');

		progress(42);
		await flushPromises();
		expect(wrapper.text()).toContain('Uploading File...42%');
		expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('42');

		progress(100);
		await flushPromises();
		expect(wrapper.text()).toContain('Importing Data...');
		expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBeUndefined();

		finish();
		await flushPromises();
		expect(wrapper.emitted('refresh')).toHaveLength(1);
		expect(useNotices().queue.value.map((n) => n.title)).toEqual(['Data successfully imported from items.csv']);
		expect(wrapper.text()).toContain('CSV or JSON...');
	});

	test('background import sends ?background=true, no refresh, the upload notice', async () => {
		vi.mocked(uploadWithProgress).mockResolvedValue(undefined);
		const wrapper = mountComponent();
		await chooseFile(wrapper);
		await wrapper.get('[role="checkbox"]').trigger('click');

		await button(wrapper, 'Start Import').trigger('click');
		await flushPromises();

		expect(vi.mocked(uploadWithProgress).mock.calls[0]![0]).toBe('/utils/import/bo_content?background=true');
		expect(wrapper.emitted('refresh')).toBeUndefined();
		expect(useNotices().queue.value.map((n) => n.title)).toEqual([
			'items.csv successfully uploaded. Importing data in background.',
		]);
	});

	test('FAILED_VALIDATION opens the import error dialog; other errors the error dialog', async () => {
		const errors = [
			{
				message: 'x',
				extensions: { code: 'FAILED_VALIDATION', field: 'title', type: 'nnull', rows: [{ type: 'lines', rows: [2] }] },
			},
		];
		vi.mocked(uploadWithProgress).mockRejectedValueOnce({ errors, response: { status: 400 } });
		const wrapper = mountComponent();
		await chooseFile(wrapper);
		await button(wrapper, 'Start Import').trigger('click');
		await flushPromises();

		expect(wrapper.findComponent(ImportErrorDialog).props()).toMatchObject({
			modelValue: true,
			errors,
			collection: 'bo_content',
		});
		expect(useNotices().dialogs.value).toEqual([]);

		vi.mocked(uploadWithProgress).mockRejectedValueOnce(new TypeError('Network request failed'));
		await button(wrapper, 'Start Import').trigger('click');
		await flushPromises();
		expect(useNotices().dialogs.value).toHaveLength(1);
	});

	test('hidden without create permission', async () => {
		useUserStore().currentUser = { ...useUserStore().currentUser!, admin_access: false } as never;
		usePermissionsStore().permissions = { bo_content: { read: { access: 'full' } } } as never;

		const wrapper = mountComponent();
		await flushPromises();
		expect(wrapper.find('input[type="file"]').exists()).toBe(false);
		expect(button(wrapper, 'Export Items').exists()).toBe(true);
	});
});

test('download page as CSV calls onDownload, disabled without it', async () => {
	const onDownload = vi.fn(async () => {});
	const wrapper = mountComponent({ onDownload });

	await button(wrapper, 'Download Page as CSV').trigger('click');
	expect(onDownload).toHaveBeenCalledTimes(1);

	expect(button(mountComponent(), 'Download Page as CSV').attributes('disabled')).toBeDefined();
});
