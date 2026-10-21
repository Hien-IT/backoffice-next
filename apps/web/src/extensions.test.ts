import { describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createApp, defineComponent, h } from 'vue';

vi.mock('./api/sdk.ts', () => ({ getApiUrl: () => 'https://api.example.com/' }));

const component = defineComponent({ render: () => null });
const bundle = (extra: Record<string, unknown[]> = {}) => ({
	interfaces: [],
	displays: [],
	layouts: [],
	modules: [],
	panels: [],
	operations: [],
	themes: [],
	...extra,
});

// One module instance for the file, the cases in order (vi.resetModules hangs the registry imports).
const fresh = () => import('./extensions.ts');

describe('extensions (spec 020, FR-060..FR-069)', () => {
	test('loads the bundle of the API URL; a failure warns and leaves the app without extensions', async () => {
		const { loadExtensions, hasAppExtensions } = await fresh();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const load = vi.fn().mockRejectedValue(new Error('404'));

		await loadExtensions(load);

		expect(load).toHaveBeenCalledWith('https://api.example.com/extensions/sources/index.js');
		expect(warn).toHaveBeenCalledWith("Couldn't load extensions");
		expect(hasAppExtensions()).toBe(false);
		warn.mockRestore();
	});

	test('an empty bundle registers nothing', async () => {
		const { loadExtensions, hasAppExtensions, registerExtensions, useExtensions } = await fresh();
		await loadExtensions(async () => bundle());

		expect(hasAppExtensions()).toBe(false);
		await registerExtensions();
		expect(useExtensions().interfaces.value).toEqual([]);
	});

	test('app extensions join the internal configs of each registry; themes stay empty (D-135)', async () => {
		const { loadExtensions, hasAppExtensions, registerExtensions, useExtensions } = await fresh();
		const ext = (id: string) => ({ id, name: id, icon: 'box', component });
		await loadExtensions(async () =>
			bundle({
				interfaces: [ext('parity-interface')],
				displays: [ext('parity-display')],
				panels: [ext('parity-panel')],
				operations: [ext('parity-operation')],
				modules: [{ ...ext('parity-module'), routes: [] }],
				themes: [{ id: 'theme' }],
			}),
		);

		// Imported one by one first: concurrent first imports of these registries deadlock in Vitest (not in a browser).
		const { getInterface } = await import('./interfaces/index.ts');
		const { getDisplay } = await import('./displays/index.ts');
		const { getPanel } = await import('./panels/index.ts');
		const { getOperation } = await import('./operations/index.ts');
		const { getModules } = await import('./modules/index.ts');
		await import('./layouts/index.ts');

		expect(hasAppExtensions()).toBe(true);
		const app = createApp({ render: () => null });
		await registerExtensions(app);

		expect(getInterface('parity-interface')?.id).toBe('parity-interface');
		expect(getInterface('input')?.id).toBe('input');
		expect(getDisplay('parity-display')?.id).toBe('parity-display');
		expect(getPanel('parity-panel')?.id).toBe('parity-panel');
		expect(getOperation('parity-operation')?.id).toBe('parity-operation');
		expect(getModules().map(({ id }) => id)).toContain('parity-module');

		const extensions = useExtensions();
		expect(extensions.interfaces.value.map(({ id }) => id)).toContain('parity-interface');
		expect(extensions.themes.value).toEqual([]);

		// Global components as the Directus app registers them (extensions render e.g. `interface-input-code`).
		for (const name of [
			'interface-input',
			'interface-parity-interface',
			'display-parity-display',
			'layout-tabular',
			'layout-sidebar-tabular',
			'display-raw',
			'display-filesize',
			'panel-parity-panel',
		])
			expect(app.component(name), name).toBeTruthy();

		// The DOM of an extension component sits in the data-bo-extension box (styles/base.css `.hidden` rule).
		const wrapper = mount(defineComponent({ render: () => h(getInterface('parity-interface')!.component as never) }));
		expect(wrapper.find('[data-bo-extension]').exists()).toBe(true);
		expect((getInterface('input')!.component as { name?: string }).name).not.toBe('BoExtension');
	}, 60_000);
});
