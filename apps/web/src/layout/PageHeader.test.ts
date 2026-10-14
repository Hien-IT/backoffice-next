import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { mountLayout } from '../test-utils/layout.ts';
import HeaderBar from './HeaderBar.vue';
import { useNavBarStore } from './stores/nav-bar.ts';
import { useSidebarStore } from './stores/sidebar.ts';

const breakpoints = vi.hoisted(() => ({ lg: true, xl: true }));

vi.mock('../composables/use-media-query.ts', () => ({
	useLayoutBreakpoints: () => ({ lg: ref(breakpoints.lg), xl: ref(breakpoints.xl) }),
}));

enableAutoUnmount(afterEach);

beforeEach(() => {
	localStorage.clear();
	breakpoints.lg = true;
	breakpoints.xl = true;
});

const button = (label: string) =>
	document.body.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;

describe('HeaderBar', () => {
	test('icon, h1 title and actions slot', async () => {
		const { wrapper } = await mountLayout(HeaderBar, {
			props: { title: 'Content', icon: 'box' },
			slots: { actions: '<button type="button">Act</button>' },
		});

		expect(wrapper.get('h1').text()).toBe('Content');
		expect(wrapper.text()).toContain('box');
		expect(wrapper.text()).toContain('Act');
	});

	test('open navigation only when the inline nav is collapsed', async () => {
		await mountLayout(HeaderBar, { props: { title: 'Content' } });
		const navBarStore = useNavBarStore();

		expect(button('Open navigation')).toBeNull();

		navBarStore.collapse();
		await nextTick();
		button('Open navigation')!.click();
		expect(navBarStore.collapsed).toBe(false);
	});

	test('open navigation always shown when the nav is a drawer (below lg)', async () => {
		breakpoints.lg = false;
		breakpoints.xl = false;
		await mountLayout(HeaderBar, { props: { title: 'Content' } });

		expect(button('Open navigation')).not.toBeNull();
	});

	test('sidebar toggle: label and aria-expanded follow the sidebar state', async () => {
		await mountLayout(HeaderBar, { props: { title: 'Content' } });
		const sidebarStore = useSidebarStore();

		expect(button('Close sidebar')!.getAttribute('aria-expanded')).toBe('true');

		button('Close sidebar')!.click();
		await nextTick();
		expect(sidebarStore.collapsed).toBe(true);
		expect(button('Open sidebar')!.getAttribute('aria-expanded')).toBe('false');
	});
});
