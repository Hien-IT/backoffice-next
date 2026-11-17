// Spec 033 T022 (FR-005, Q-50).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { DocsHeading } from '../../../docs/types.ts';
import { i18n } from '../../../lang/index.ts';
import DocsToc from './DocsToc.vue';

enableAutoUnmount(afterEach);

const HEADINGS: DocsHeading[] = [
	{ id: 'mot', text: 'Một', level: 2 },
	{ id: 'mot-a', text: 'Một A', level: 3 },
	{ id: 'hai', text: 'Hai', level: 2 },
];

let notify: (entries: { target: { id: string }; isIntersecting: boolean }[]) => void = () => undefined;
const observed: string[] = [];
const disconnect = vi.fn();

beforeEach(() => {
	observed.length = 0;
	disconnect.mockReset();
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(callback: typeof notify) {
				notify = callback;
			}
			observe(element: Element) {
				observed.push(element.id);
			}
			disconnect = disconnect;
		},
	);
	document.body.innerHTML = HEADINGS.map((heading) => `<h2 id="${heading.id}">${heading.text}</h2>`).join('');
});

afterEach(() => {
	vi.unstubAllGlobals();
	document.body.innerHTML = '';
});

async function toc(headings = HEADINGS) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
	});
	await router.push('/docs');
	const wrapper = mount(DocsToc, { props: { headings }, global: { plugins: [i18n, router] } });
	await flushPromises();
	return { wrapper, router };
}

const current = (wrapper: Awaited<ReturnType<typeof toc>>['wrapper']) =>
	wrapper.findAll('a[aria-current="location"]').map((a) => a.text());

test('a named navigation listing the headings, third-level ones indented', async () => {
	const { wrapper } = await toc();

	expect(wrapper.find('nav').attributes('aria-label')).toBe('On this page');
	expect(wrapper.findAll('a').map((a) => [a.attributes('href'), a.text()])).toEqual([
		['#mot', 'Một'],
		['#mot-a', 'Một A'],
		['#hai', 'Hai'],
	]);
	expect(wrapper.findAll('a')[1]!.classes()).toContain('ps-6');
	expect(observed).toEqual(['mot', 'mot-a', 'hai']);
});

test('the heading being read is marked: the first of the visible ones', async () => {
	const { wrapper } = await toc();
	expect(current(wrapper)).toEqual(['Một']);

	notify([
		{ target: { id: 'mot' }, isIntersecting: false },
		{ target: { id: 'mot-a' }, isIntersecting: true },
		{ target: { id: 'hai' }, isIntersecting: true },
	]);
	await flushPromises();

	expect(current(wrapper)).toEqual(['Một A']);
	expect(wrapper.find('a[aria-current="location"]').classes()).toContain('border-brand-500');

	// Nothing in the band (between two headings): the last one read stays marked.
	notify([
		{ target: { id: 'mot-a' }, isIntersecting: false },
		{ target: { id: 'hai' }, isIntersecting: false },
	]);
	await flushPromises();
	expect(current(wrapper)).toEqual(['Một A']);
});

test('a click replaces the hash and marks the item', async () => {
	const { wrapper, router } = await toc();
	const replace = vi.spyOn(router, 'replace');

	await wrapper.findAll('a')[2]!.trigger('click');
	await flushPromises();

	expect(replace).toHaveBeenCalledWith({ hash: '#hai' });
	expect(router.currentRoute.value.hash).toBe('#hai');
	expect(current(wrapper)).toEqual(['Hai']);
});

test('no headings: nothing is shown; new headings are observed again', async () => {
	expect((await toc([])).wrapper.find('nav').exists()).toBe(false);

	const { wrapper } = await toc();
	await wrapper.setProps({ headings: [HEADINGS[2]!] });
	await flushPromises();

	expect(disconnect).toHaveBeenCalled();
	expect(wrapper.findAll('a').map((a) => a.text())).toEqual(['Hai']);
	expect(current(wrapper)).toEqual(['Hai']);
});
