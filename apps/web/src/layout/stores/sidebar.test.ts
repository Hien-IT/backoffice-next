// Ported from directus/app/src/views/private/private-view/stores/sidebar.test.ts
// Backoffice: real localStorage (happy-dom) instead of a mocked useLocalStorage; storage keys and blocked storage.
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useSidebarStore } from './sidebar';

beforeEach(() => {
	localStorage.clear();
	setActivePinia(createPinia());
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('sidebar store size guard', () => {
	it('returns default size on init', () => {
		const store = useSidebarStore();
		expect(store.size).toBe(333);
	});

	it('accepts finite values', () => {
		const store = useSidebarStore();
		store.size = 400;
		expect(store.size).toBe(400);
	});

	it('rejects NaN and returns default', () => {
		const store = useSidebarStore();
		store.size = NaN;
		expect(store.size).toBe(333);
	});

	it('rejects Infinity and returns default', () => {
		const store = useSidebarStore();
		store.size = Infinity;
		expect(store.size).toBe(333);
	});

	it('preserves last valid value after rejected write', () => {
		const store = useSidebarStore();
		store.size = 500;
		store.size = NaN;
		expect(store.size).toBe(500);
	});

	it('self-heals corrupted stored value back to default', () => {
		localStorage.setItem('backoffice-sidebar-size', 'abc');
		const store = useSidebarStore();
		expect(store.size).toBe(333);
	});
});

describe('sidebar store persistence (FR-020)', () => {
	it('reads and writes the backoffice- keys', async () => {
		localStorage.setItem('backoffice-sidebar-collapsed', 'true');
		const store = useSidebarStore();
		expect(store.collapsed).toBe(true);

		store.toggle();
		store.size = 300;
		await nextTick();

		expect(localStorage.getItem('backoffice-sidebar-collapsed')).toBe('false');
		expect(localStorage.getItem('backoffice-sidebar-size')).toBe('300');
	});

	it('works in memory when localStorage is blocked', async () => {
		vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
			throw new DOMException('blocked', 'SecurityError');
		});

		const store = useSidebarStore();
		expect(store.collapsed).toBe(false);
		expect(store.size).toBe(333);

		store.collapse();
		store.size = 400;
		await nextTick();
		expect(store.collapsed).toBe(true);
		expect(store.size).toBe(400);
	});

	it('triggers the collapse and expand hooks', async () => {
		const store = useSidebarStore();
		const onCollapse = vi.fn();
		const onExpand = vi.fn();
		store.onCollapse(onCollapse);
		store.onExpand(onExpand);

		store.collapse();
		await nextTick();
		store.expand();
		await nextTick();

		expect(onCollapse).toHaveBeenCalledOnce();
		expect(onExpand).toHaveBeenCalledOnce();
	});
});
