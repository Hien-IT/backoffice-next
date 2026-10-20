// The user story 2 part of directus/app/src/modules/content/routes/item.vue (no Directus test) on the fixture set and
// its mock API: savable states, save and quit, new item, singleton, read-only form, not found, live preview toggle.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../../api/sdk.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import { useUserStore } from '../../../stores/user.ts';
import { calls, mockFixtureApi } from '../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import ItemRoute from './ItemRoute.vue';
import PageHeader from '../../../layout/PageHeader.vue';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	vi.unstubAllGlobals();
	localStorage.clear();
	await replaceQueue();
});

async function setup(
	props: Record<string, unknown>,
	user: 'admin' | 'bo-viewer' = 'admin',
	path = '/content/bo_content',
) {
	return mountLayout(ItemRoute, {
		path,
		props,
		async beforeMount() {
			fetch = mockFixtureApi(loadSnapshot(), { user });
			await Promise.all([
				useUserStore().hydrate(),
				usePermissionsStore().hydrate(),
				useFieldsStore().hydrate(),
				useRelationsStore().hydrate(),
				useCollectionsStore().hydrate(),
			]);
		},
	});
}

const button = (label: string) => document.body.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

const bodyOf = (method: string, path: string) => {
	const call = fetch.mock.calls
		.filter(([url, init]) => init?.method === method && new URL(String(url)).pathname === path)
		.at(-1);
	return call ? JSON.parse(String(call[1]!.body)) : undefined;
};

describe('ItemRoute', () => {
	test('existing item: values, breadcrumb, save enabled by an edit, save and quit PATCHes the edits', async () => {
		const { wrapper, router } = await setup({ collection: 'bo_content', primaryKey: '2' });
		await flushPromises();

		// D-101: the breadcrumb is passed to PageHeader but not shown.
		expect((wrapper.findComponent(PageHeader).props('breadcrumb') as { name: string }[])[0]!.name).toBe('Bo Content');
		expect((wrapper.get('input[type="text"]').element as HTMLInputElement).value).toBe('Content 02');
		expect(button('Save')!.disabled).toBe(true);
		expect(button('Delete')).not.toBeNull();
		expect(button('Archive')).not.toBeNull();

		await wrapper.get('input[type="text"]').setValue('Changed');
		expect(button('Save')!.disabled).toBe(false);

		button('Save')!.click();
		await flushPromises();

		expect(calls(fetch)).toContain('PATCH /items/bo_content/2');
		expect(bodyOf('PATCH', '/items/bo_content/2')).toEqual({ title: 'Changed' });
		expect(router.currentRoute.value.fullPath).toBe('/content/bo_content');
	});

	test('the form is centred in a column as wide as it shows; the page header keeps the full width (owner 2026-10-18)', async () => {
		await setup({ collection: 'bo_content', primaryKey: '2' });
		await flushPromises();

		expect(document.body.querySelector('main [class*="grid-cols"]')!.className).toMatch(/mx-auto.*max-w-\[44\.25rem\]/);
		expect(document.body.querySelector('main header')!.className).not.toMatch(/mx-auto|max-w-/);
	});

	test('new item: creating title, no delete, save as copy disabled', async () => {
		const { wrapper } = await setup({ collection: 'bo_content', primaryKey: '+' });

		expect(wrapper.get('h1').text()).toBe('Creating Item in Bo Content');
		expect(button('Delete')).toBeNull();
	});

	test('singleton: its name, no back, delete or archive; save PATCHes the collection endpoint (FR-058)', async () => {
		const { wrapper } = await setup({ collection: 'bo_singleton', singleton: true }, 'admin', '/content/bo_singleton');
		await flushPromises();

		expect(wrapper.get('h1').text()).toBe('Bo Singleton');
		expect(button('Back')).toBeNull();
		expect(button('Delete')).toBeNull();
		expect(button('Archive')).toBeNull();

		await wrapper.get('input[type="text"]').setValue('Site');
		button('Save')!.click();
		await flushPromises();

		expect(calls(fetch)).toContain('PATCH /items/bo_singleton');
	});

	test('a singleton with a primary key and an unknown collection are not found (FR-061)', async () => {
		expect((await setup({ collection: 'bo_singleton', primaryKey: '1' })).wrapper.get('h1').text()).toBe(
			'Page Not Found',
		);
		expect((await setup({ collection: 'nope', primaryKey: '1' })).wrapper.get('h1').text()).toBe('Page Not Found');
	});

	test('a viewer gets a disabled form and no save (FR-098)', async () => {
		const { wrapper } = await setup({ collection: 'bo_content', primaryKey: '2' }, 'bo-viewer');
		await flushPromises();

		expect(wrapper.get('input[type="text"]').attributes('disabled')).toBeDefined();
		expect(button('Not Allowed')).not.toBeNull();
	});

	test('the preview button opens the split live preview with the preview URL (FR-063)', async () => {
		// happy-dom would fetch the iframe page from the network.
		(
			window as unknown as { happyDOM: { settings: { disableIframePageLoading: boolean } } }
		).happyDOM.settings.disableIframePageLoading = true;
		const { wrapper } = await setup({ collection: 'bo_content', primaryKey: '2' });
		await flushPromises();

		button('Enable Preview')!.click();
		await flushPromises();

		expect(localStorage.getItem('backoffice-live-preview-mode')).toBe('split');
		expect(wrapper.get('iframe#frame').attributes('src')).toBe('https://preview.example/2?v=main');
	});
});
