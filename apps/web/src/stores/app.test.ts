import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, it } from 'vitest';
import { useAppStore } from './app';

beforeEach(() => setActivePinia(createPinia()));

it('defaults basemap to OpenStreetMap like @directus/stores', () => {
	const store = useAppStore();
	expect(store.basemap).toBe('OpenStreetMap');
	store.basemap = 'Custom';
	expect(store.basemap).toBe('Custom');
});
