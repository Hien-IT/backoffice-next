// Ported from directus/app/src/views/private/private-view/stores/nav-bar.test.ts
// Backoffice: real localStorage (happy-dom) and a memory router; breakpoints mocked through use-media-query.
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useNavBarStore } from './nav-bar';

// Read lazily by the mock (after this line has run).
const xl = ref(true);

vi.mock('../../composables/use-media-query.ts', () => ({
	useLayoutBreakpoints: () => ({ lg: ref(true), xl }),
}));

const router = createRouter({
	history: createMemoryHistory(),
	routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
});

// The store calls useRoute(): pinia runs store setup in the app context, which has the router.
function newPinia() {
	const pinia = createPinia();
	createApp({}).use(router).use(pinia);
	setActivePinia(pinia);
}

beforeEach(async () => {
	localStorage.clear();
	xl.value = true;
	newPinia();
	await router.push('/');
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('nav-bar store', () => {
	it('persists collapsed under backoffice-nav-bar-collapsed and triggers the hooks', async () => {
		const store = useNavBarStore();
		const onCollapse = vi.fn();
		store.onCollapse(onCollapse);

		store.toggle();
		await nextTick();
		expect(localStorage.getItem('backoffice-nav-bar-collapsed')).toBe('true');
		expect(onCollapse).toHaveBeenCalledOnce();
	});

	it('works in memory when localStorage is blocked', () => {
		vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
			throw new DOMException('blocked', 'SecurityError');
		});

		const store = useNavBarStore();
		store.collapse();
		expect(store.collapsed).toBe(true);
	});

	it('inline from xl only', () => {
		xl.value = false;
		expect(useNavBarStore().inlineNav).toBe(false);
	});

	it('the drawer is not saved and closes on navigation and when the window reaches xl', async () => {
		xl.value = false;
		const store = useNavBarStore();

		store.drawerOpen = true;
		await router.push('/files');
		expect(store.drawerOpen).toBe(false);
		expect(store.collapsed).toBe(false);

		store.drawerOpen = true;
		xl.value = true;
		await nextTick();
		expect(store.drawerOpen).toBe(false);
	});
});
