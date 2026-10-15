/* eslint-disable vue/one-component-per-file -- router test components (editor, empty route, root view) */
import { mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { useEditsGuard } from './use-edits-guard.ts';

const Empty = defineComponent({ render: () => null });

let unmount: (() => void) | null = null;

afterEach(() => {
	unmount?.();
	unmount = null;
});

async function setup(hasEditsValue: boolean, opts?: Parameters<typeof useEditsGuard>[1]) {
	const hasEdits = ref(hasEditsValue);
	let guard!: ReturnType<typeof useEditsGuard>;

	const Editor = defineComponent({
		setup() {
			guard = useEditsGuard(hasEdits, opts);
			return () => h(RouterView);
		},
	});

	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/content/:collection/:pk', component: Editor, children: [{ path: 'sub', component: Empty }] },
			{ path: '/content/:collection/+', component: Empty },
			{ path: '/other', component: Empty },
		],
	});

	await router.push('/content/articles/1');
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router] } });
	await router.isReady();
	unmount = () => wrapper.unmount();

	return { router, hasEdits, guard };
}

test('a subpath of the current item does not ask', async () => {
	const { router, guard } = await setup(true);

	await router.push('/content/articles/1/sub');

	expect(router.currentRoute.value.path).toBe('/content/articles/1/sub');
	expect(guard.confirmLeave.value).toBe(false);
});

test('changing ?version= asks when compareQuery has version', async () => {
	const { router, guard } = await setup(true, { compareQuery: ['version'] });

	await router.push('/content/articles/1?version=draft');

	expect(router.currentRoute.value.fullPath).toBe('/content/articles/1');
	expect(guard.confirmLeave.value).toBe(true);
	expect(guard.leaveTo.value).toBe('/content/articles/1?version=draft');
});

test('changing a query not in compareQuery does not ask', async () => {
	const { router, guard } = await setup(true, { compareQuery: ['version'] });

	await router.push('/content/articles/1?bookmark=2');

	expect(router.currentRoute.value.fullPath).toBe('/content/articles/1?bookmark=2');
	expect(guard.confirmLeave.value).toBe(false);
});

test('leaving the page asks', async () => {
	const { router, guard } = await setup(true);

	await router.push('/other');

	expect(router.currentRoute.value.path).toBe('/content/articles/1');
	expect(guard.confirmLeave.value).toBe(true);
	expect(guard.leaveTo.value).toBe('/other');
});

test('a path under ignorePrefix does not ask', async () => {
	const { router, guard } = await setup(true, { ignorePrefix: '/content/articles/+' });

	await router.push('/content/articles/+');

	expect(router.currentRoute.value.path).toBe('/content/articles/+');
	expect(guard.confirmLeave.value).toBe(false);
});

test('no edits, no question', async () => {
	const { router, guard } = await setup(false, { compareQuery: ['version'] });

	await router.push('/content/articles/1?version=draft');
	await router.push('/other');

	expect(router.currentRoute.value.path).toBe('/other');
	expect(guard.confirmLeave.value).toBe(false);
});

test('beforeunload is prevented only while there are edits', async () => {
	const { hasEdits } = await setup(true);

	const first = new Event('beforeunload', { cancelable: true });
	document.dispatchEvent(first);
	expect(first.defaultPrevented).toBe(true);

	hasEdits.value = false;
	const second = new Event('beforeunload', { cancelable: true });
	document.dispatchEvent(second);
	expect(second.defaultPrevented).toBe(false);
});
