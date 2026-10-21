// Directus has no test for its Settings > Extensions page (spec 020 T090, recipe Q-41): groups by schema.type in API
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

enableAutoUnmount(afterEach);

// Directus locks the state of app extensions in dev mode (vite serves them); the tests run as a build.
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
