import { createHead } from '@unhead/vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { Component } from 'vue';
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';
import { i18n } from '../lang/index.ts';

/**
 * Mounts a layout component with i18n, a fresh pinia, unhead and a memory router (every path matches, or `routes`)
 * at `path`, attached to document.body (Reka portals render there). `beforeMount` runs (and is awaited) with the new
 * pinia active, to fill stores before the component reads them.
 */
export async function mountLayout(
	component: Component,
	{
		path = '/',
		routes,
		props,
		slots,
		beforeMount,
	}: {
		path?: string;
		routes?: RouteRecordRaw[];
		props?: Record<string, unknown>;
		slots?: Record<string, string>;
		beforeMount?: () => void | Promise<void>;
	} = {},
) {
	const pinia = createPinia();
	setActivePinia(pinia);
	await beforeMount?.();

	const router = createRouter({
		history: createMemoryHistory(),
		routes: routes ?? [{ path: '/:p(.*)*', component: { render: () => null } }],
	});

	await router.push(path);

	const head = createHead();

	const wrapper = mount(component, {
		props: props ?? {},
		slots: slots ?? {},
		attachTo: document.body,
		global: { plugins: [router, pinia, i18n, head] },
	});

	await flushPromises();

	return { wrapper, router, head };
}

/** Sends a keydown to an element, like a key press. */
export async function press(el: Element, key: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	await flushPromises();
}
