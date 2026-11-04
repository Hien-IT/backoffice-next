// DR has no test for its Settings > Extensions page (spec 020 T090, recipe Q-41): groups by schema.type in API
// order with missing rows last, bundle entries nested, the partial state, the menu by source, no confirmation.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetNotices } from '../../../../composables/use-notices.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import ExtensionsRoute from './ExtensionsRoute.vue';

const request = vi.fn();

vi.mock('../../../../api/sdk.ts', async (importOriginal) => ({
	...(await importOriginal<object>()),
	sdk: { request: (command: () => unknown) => request(command()) },
	requestEndpoint: (path: string, options: object) => () => ({ path, ...options }),
}));

// Backoffice (spec 031): the Upload button follows the probe of useExtensionUpload (DR 404 → no button).
const upload = vi.hoisted(() => ({ available: { value: false } }));
vi.mock('../../../../composables/use-extension-upload.ts', async () => {
	const { ref } = await import('vue');
	const available = ref(false);
	upload.available = available;
	return {
		useExtensionUpload: () => ({ available, maxUploadSize: ref(null), ready: Promise.resolve(true), upload: vi.fn() }),
	};
});

enableAutoUnmount(afterEach);

// DR locks the state of app extensions in dev mode (vite serves them); the tests run as a build.
beforeEach(() => {
	vi.stubEnv('DEV', false);
});

afterEach(() => {
	vi.unstubAllEnvs();
	request.mockReset();
	resetNotices();
});

const ext = (
	id: string,
	type: string | null,
	extra: Record<string, unknown> = {},
	meta: Record<string, unknown> = {},
) => ({
	id,
	bundle: null,
	schema: type ? { type, name: id, ...extra } : null,
	meta: { enabled: true, folder: id, source: 'local', bundle: null, ...meta },
});

const LIST = [
	ext('color', 'interface', { version: '1.0.0' }),
	ext('gone', null, {}, { source: 'registry' }),
	ext('audit', 'hook', {}, { enabled: false }),
	ext('tools', 'bundle', { partial: true }),
	{ ...ext('tools-iface', 'interface'), bundle: 'tools' },
	{ ...ext('tools-hook', 'hook', {}, { enabled: false }), bundle: 'tools' },
];

async function mountRoute(list: unknown[] = LIST) {
	request.mockResolvedValue(list);
	const { wrapper } = await mountLayout(ExtensionsRoute, { path: '/settings/extensions' });
	await flushPromises();
	return wrapper;
}

test('groups in API order with missing last, bundle entries nested, states as text', async () => {
	const wrapper = await mountRoute();

	expect(wrapper.findAll('h2').map((h) => h.text())).toEqual([
		'design_services Interfaces',
		'webhook Hooks',
		'hub Bundles',
		'warning Missing',
	]);

	const row = (name: string) => wrapper.get(`[data-extension="${name}"]`);
	expect(row('color').text()).toContain('1.0.0');
	expect(row('color').text()).toContain('Enabled');
	expect(row('audit').text()).toContain('Disabled');
	expect(row('tools').text()).toContain('Partially Enabled');
	expect(row('gone').text()).not.toMatch(/Enabled|Disabled/);

	// entries under their bundle, with their own menu (partial bundle)
	const nested = wrapper.get('[data-extension="tools"]').element.parentElement!.querySelector('ul')!;
	expect(nested.querySelectorAll('[data-extension]')).toHaveLength(2);
	expect(nested.querySelectorAll('button[aria-haspopup]')).toHaveLength(2);
});

test('the entries of a bundle that is not partial have no menu', async () => {
	const wrapper = await mountRoute([
		ext('tools', 'bundle', { partial: false }),
		{ ...ext('tools-iface', 'interface'), bundle: 'tools' },
	]);

	const nested = wrapper.get('[data-extension="tools"]').element.parentElement!.querySelector('ul')!;
	expect(nested.querySelectorAll('button[aria-haspopup]')).toHaveLength(0);
});

test('the menu: disable then refresh, without confirmation; missing rows offer reinstall (registry) and remove', async () => {
	const wrapper = await mountRoute();

	await wrapper.get('[data-extension="color"] button[aria-haspopup]').trigger('click');
	await flushPromises();
	let items = [...document.body.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent?.trim());
	expect(items).toEqual([
		'mode_off_onDisable',
		"deleteUninstall (Cannot uninstall extensions that weren't installed through the Marketplace)",
	]);

	const item = document.body.querySelector('[role="menuitem"]')!;
	item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	await flushPromises();

	expect(request).toHaveBeenCalledWith({
		path: '/extensions/color',
		method: 'PATCH',
		body: { meta: { enabled: false } },
	});
	expect(request).toHaveBeenLastCalledWith({ path: '/extensions', method: 'GET' });
	expect(document.body.querySelector('[role="dialog"]')).toBeNull();

	await wrapper.get('[data-extension="gone"] button[aria-haspopup]').trigger('click');
	await flushPromises();
	items = [...document.body.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent?.trim());
	expect(items).toEqual(['downloadReinstall', 'deleteRemove']);
});

test('empty list: the no_extensions info', async () => {
	const wrapper = await mountRoute([]);

	expect(wrapper.text()).toContain('No Extensions');
});

// Backoffice (spec 031, D-212, D-212.3): the Upload extension button, the Uploaded chip and the menu of an upload.
test('the Upload extension button only when the API is Backoffice; it opens the dialog', async () => {
	upload.available.value = false;
	let wrapper = await mountRoute();
	expect(wrapper.text()).not.toContain('Upload extension');
	wrapper.unmount();

	upload.available.value = true;
	wrapper = await mountRoute();
	const button = wrapper.findAll('button').find((b) => b.text().includes('Upload extension'))!;
	await button.trigger('click');
	await flushPromises();

	expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('npm pack');
	upload.available.value = false;
});

test('an uploaded package: an Uploaded chip, Uninstall enabled, no Reinstall; a local one stays locked', async () => {
	const wrapper = await mountRoute([
		ext('up', 'endpoint', { version: '1.0.0' }, { source: 'upload' }),
		ext('loc', 'endpoint', {}, { source: 'local' }),
		ext('gone-up', null, {}, { source: 'upload' }),
	]);

	expect(wrapper.get('[data-extension="up"]').text()).toContain('Uploaded');
	expect(wrapper.get('[data-extension="loc"]').text()).not.toContain('Uploaded');

	await wrapper.get('[data-extension="up"] button[aria-haspopup]').trigger('click');
	await flushPromises();
	let items = [...document.body.querySelectorAll('[role="menuitem"]')];
	const uninstall = items.find((el) => el.textContent?.includes('Uninstall'))!;
	expect(uninstall.textContent?.trim()).toBe('deleteUninstall');
	expect(uninstall.getAttribute('data-disabled')).toBeNull();

	uninstall.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	await flushPromises();
	expect(request).toHaveBeenCalledWith({ path: '/extensions/registry/uninstall/up', method: 'DELETE' });

	await wrapper.get('[data-extension="gone-up"] button[aria-haspopup]').trigger('click');
	await flushPromises();
	items = [...document.body.querySelectorAll('[role="menuitem"]')];
	expect(items.map((el) => el.textContent?.trim())).toEqual(['deleteRemove']);
});
