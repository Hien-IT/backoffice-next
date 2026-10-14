// Ported from directus/app/src/views/private/private-view/stores/nav-bar.test.ts
// Backoffice: real localStorage (happy-dom) and a memory router; breakpoints mocked through use-media-query.
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useNavBarStore } from './nav-bar';
import { useSidebarStore } from './sidebar';

const breakpoints = vi.hoisted(() => ({ lg: true, xl: true }));

vi.mock('../../composables/use-media-query.ts', () => ({
	useLayoutBreakpoints: () => ({ lg: ref(breakpoints.lg), xl: ref(breakpoints.xl) }),
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
	breakpoints.lg = true;
	breakpoints.xl = true;
	newPinia();
	await router.push('/');
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('nav-bar store size guard', () => {
	it('returns default size on init', () => {
		const store = useNavBarStore();
		expect(store.size).toBe(225);
	});

	it('accepts finite values', () => {
		const store = useNavBarStore();
		store.size = 300;
		expect(store.size).toBe(300);
	});

	it('rejects NaN, Infinity and -Infinity', () => {
		const store = useNavBarStore();
		store.size = NaN;
		store.size = Infinity;
		store.size = -Infinity;
		expect(store.size).toBe(225);
	});

	it('preserves last valid value after rejected write', () => {
		const store = useNavBarStore();
		store.size = 320;
		store.size = NaN;
		expect(store.size).toBe(320);
	});
});

describe('nav-bar store', () => {
	it('persists collapsed under backoffice-nav-bar-collapsed', async () => {
		const store = useNavBarStore();
		store.toggle();
		await nextTick();
		expect(localStorage.getItem('backoffice-nav-bar-collapsed')).toBe('true');
	});

	it('works in memory when localStorage is blocked', () => {
		vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
			throw new DOMException('blocked', 'SecurityError');
		});

		const store = useNavBarStore();
		store.collapse();
		expect(store.collapsed).toBe(true);
	});

	it('inline from xl, from lg only when the sidebar is collapsed', () => {
		breakpoints.xl = false;
		const store = useNavBarStore();
		expect(store.inlineNav).toBe(false);

		useSidebarStore().collapse();
		expect(store.inlineNav).toBe(true);
	});

	it('closes the drawer nav on navigation, keeps an inline nav open', async () => {
		const store = useNavBarStore();
		await router.push('/content');
		expect(store.collapsed).toBe(false);

		breakpoints.lg = false;
		breakpoints.xl = false;
		newPinia();

		const drawer = useNavBarStore();
		const onCollapse = vi.fn();
		drawer.onCollapse(onCollapse);
		await router.push('/files');
		expect(drawer.collapsed).toBe(true);
		expect(onCollapse).toHaveBeenCalledOnce();
	});
});
