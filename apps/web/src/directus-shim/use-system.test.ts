// Spec 020 (T104): the four injects an app extension reads through @directus/extensions-sdk.
import { createPinia } from 'pinia';
import { expect, test } from 'vitest';
import { createApp, defineComponent, h, inject } from 'vue';
import api from '../api/axios.ts';
import { createSdk, sdk } from '../api/sdk.ts';
import { useExtensions } from '../extensions.ts';
import { API_INJECT, EXTENSIONS_INJECT, SDK_INJECT, STORES_INJECT, useSystem } from './use-system.ts';

test('stores, api, sdk and extensions are provided', () => {
	createSdk('http://localhost/');
	const seen: Record<string, unknown> = {};

	const app = createApp(
		defineComponent({
			setup() {
				for (const key of [STORES_INJECT, API_INJECT, SDK_INJECT, EXTENSIONS_INJECT]) seen[key] = inject(key);
				return () => h('div');
			},
		}),
	);

	app.use(createPinia());
	useSystem(app);
	app.mount(document.createElement('div'));

	expect(Object.keys(seen['stores'] as object)).toHaveLength(14);
	expect((seen['stores'] as Record<string, () => unknown>)['useUserStore']!()).toBeTruthy();
	expect(seen['api']).toBe(api);
	expect(seen['sdk']).toBe(sdk);
	expect(seen['extensions']).toBe(useExtensions());
	app.unmount();
});
