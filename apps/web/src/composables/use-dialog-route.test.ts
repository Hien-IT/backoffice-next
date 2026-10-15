// Feature 015 (FR-020): the add-file dialog opens with its route and closes when the route is left.
import { flushPromises, mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { useDialogRoute } from './use-dialog-route.ts';

let isOpen: ReturnType<typeof useDialogRoute> | null = null;

const Dialog = defineComponent({
	setup() {
		isOpen = useDialogRoute();
		return () => h('div', isOpen!.value ? 'open' : 'closed');
	},
});

test('open after mount, closed before leaving, and the route change is not held', async () => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/files', component: { render: () => h('p', 'library') } },
			{ path: '/files/+', component: Dialog },
		],
	});

	await router.push('/files/+');
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router] } });
	await flushPromises();

	expect(isOpen?.value).toBe(true);

	const open = isOpen!;
	await router.push('/files');
	await flushPromises();

	expect(open.value).toBe(false);
	expect(router.currentRoute.value.path).toBe('/files');
	expect(wrapper.text()).toBe('library');
});
