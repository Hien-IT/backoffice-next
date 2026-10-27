// Spec 018 FR-014 (T031): the import block of the Insights overview, port of basic-import-sidebar-detail.vue.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetNotices, useNotices } from '../../composables/use-notices.ts';
import { i18n } from '../../lang/index.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useUserStore } from '../../stores/user.ts';
import { uploadWithProgress } from '../../utils/upload-with-progress.ts';
import BasicImportSidebarDetail from './BasicImportSidebarDetail.vue';
import ImportErrorDialog from './ImportErrorDialog.vue';

vi.mock('../../utils/upload-with-progress.ts', () => ({ uploadWithProgress: vi.fn() }));

enableAutoUnmount(afterEach);

beforeEach(() => {
	vi.clearAllMocks();
	setActivePinia(createPinia());
	resetNotices();
	useUserStore().currentUser = { id: 'u1', admin_access: true } as never;
	useSidebarStore().activeAccordionItem = 'import';
});

const mountComponent = () =>
	mount(BasicImportSidebarDetail, {
		props: { collection: 'directus_dashboards' },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

type Wrapper = ReturnType<typeof mountComponent>;

async function chooseFile(wrapper: Wrapper, file = new File(['[]'], 'dashboards.json', { type: 'application/json' })) {
	const input = wrapper.get<HTMLInputElement>('input[type="file"]');
	expect(input.attributes('accept')).toBe('text/csv, application/json');
	Object.defineProperty(input.element, 'files', { value: { length: 1, item: () => file }, configurable: true });
	await input.trigger('change');
}

const startButton = (wrapper: Wrapper) => wrapper.findAll('button').find((b) => b.text() === 'Start Import')!;

test('uploads to /utils/import/<collection>, then refresh and the success notice', async () => {
	vi.mocked(uploadWithProgress).mockResolvedValue(undefined);
	const wrapper = mountComponent();
	expect(startButton(wrapper).attributes('disabled')).toBeDefined();

	await chooseFile(wrapper);
	await startButton(wrapper).trigger('click');
	await flushPromises();

	const [path, form] = vi.mocked(uploadWithProgress).mock.calls[0]!;
	expect(path).toBe('/utils/import/directus_dashboards');
	expect((form.get('file') as File).name).toBe('dashboards.json');
	expect(wrapper.emitted('refresh')).toHaveLength(1);
	expect(useNotices().queue.value.map((n) => n.title)).toEqual(['Data successfully imported from dashboards.json']);
});

test('FAILED_VALIDATION opens the import error dialog; other errors the error dialog', async () => {
	const errors = [{ message: 'x', extensions: { code: 'FAILED_VALIDATION', field: 'name', type: 'nnull' } }];
	vi.mocked(uploadWithProgress).mockRejectedValueOnce({ errors, response: { status: 400 } });
	const wrapper = mountComponent();
	await chooseFile(wrapper);
	await startButton(wrapper).trigger('click');
	await flushPromises();

	expect(wrapper.findComponent(ImportErrorDialog).props()).toMatchObject({ modelValue: true, errors });

	vi.mocked(uploadWithProgress).mockRejectedValueOnce(new TypeError('Network request failed'));
	await chooseFile(wrapper);
	await startButton(wrapper).trigger('click');
	await flushPromises();
	expect(useNotices().dialogs.value).toHaveLength(1);
});

// Backoffice (spec 025, FR-028, analyze I1): directus_dashboards is a system collection, so import is admin-only, as
// the DR ImportService, whatever the policies allow.
test('hidden for a non-admin, also with create, update and import on the collection', async () => {
	useUserStore().currentUser = { id: 'u1', admin_access: false } as never;

	for (const extra of [{}, { import: { access: 'full' }, export: { access: 'full' } }]) {
		usePermissionsStore().permissions = {
			directus_dashboards: {
				read: { access: 'full' },
				create: { access: 'full' },
				update: { access: 'full' },
				...extra,
			},
		} as never;

		const wrapper = mountComponent();
		await flushPromises();

		expect(wrapper.find('input[type="file"]').exists()).toBe(false);
		wrapper.unmount();
	}
});
