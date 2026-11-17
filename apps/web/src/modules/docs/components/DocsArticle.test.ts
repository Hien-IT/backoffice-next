// Spec 033 T023 (FR-006, FR-010, FR-039, contracts/web.md §3).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { renderDoc } from '../../../docs/render.ts';
import { i18n } from '../../../lang/index.ts';
import DocsArticle from './DocsArticle.vue';

enableAutoUnmount(afterEach);

const writeText = vi.fn();

beforeEach(() => {
	writeText.mockReset().mockResolvedValue(undefined);
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

const MARKDOWN = [
	'## Bước đầu',
	'',
	'Xem [Chung](/docs/configuration/general#may-chu-http), [mục dưới](#buoc-hai) và [ngoài](https://example.org/x).',
	'',
	'```bash',
	'curl "https://backoffice.example.com/server/ping"',
	'```',
	'',
	'## Bước hai',
].join('\n');

async function article() {
	const router = createRouter({
		history: createMemoryHistory('/admin'),
		routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
	});
	await router.push('/docs');

	const { html } = renderDoc(MARKDOWN, { base: '/admin/' });
	const wrapper = mount(DocsArticle, { props: { html }, attachTo: document.body, global: { plugins: [i18n, router] } });

	return { wrapper, router };
}

test('the content is marked with the docs language: English for en-US, Vietnamese for vi-VN', async () => {
	const { wrapper } = await article();
	expect(wrapper.find('.docs-article').attributes('lang')).toBe('en');

	i18n.global.locale.value = 'vi-VN';
	await flushPromises();
	expect(wrapper.find('.docs-article').attributes('lang')).toBe('vi');
	i18n.global.locale.value = 'en-US';
});

test('the copy button of a code block copies its text and announces it', async () => {
	const { wrapper } = await article();

	await wrapper.find('button[data-copy]').trigger('click');
	await flushPromises();

	expect(writeText).toHaveBeenCalledWith('curl "https://backoffice.example.com/server/ping"');
	expect(wrapper.find('[aria-live="polite"]').text()).toBe('Copied');
});

test('the sign of a heading copies the link to it and puts the anchor in the URL', async () => {
	const { wrapper, router } = await article();

	await wrapper.find('h2 a.docs-anchor').trigger('click');
	await flushPromises();

	expect(writeText).toHaveBeenCalledTimes(1);
	expect(String(writeText.mock.calls[0]![0])).toMatch(/#buoc-dau$/);
	expect(router.currentRoute.value.hash).toBe('#buoc-dau');
});

test('a link to another documentation page goes through the router; an anchor link replaces the hash', async () => {
	const { wrapper, router } = await article();
	const links = wrapper.findAll('p a');

	await links[1]!.trigger('click');
	await flushPromises();
	expect(router.currentRoute.value.fullPath).toBe('/docs#buoc-hai');
	expect(writeText).not.toHaveBeenCalled();

	await links[0]!.trigger('click');
	await flushPromises();
	expect(router.currentRoute.value.fullPath).toBe('/docs/configuration/general#may-chu-http');
});

test('an outside link and a click with a modifier are left to the browser', async () => {
	const { wrapper, router } = await article();
	const links = wrapper.findAll('p a');

	const outside = new MouseEvent('click', { bubbles: true, cancelable: true });
	links[2]!.element.addEventListener('click', (event) => event.preventDefault(), { once: true });
	links[2]!.element.dispatchEvent(outside);

	const modified = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
	let prevented = true;
	links[0]!.element.addEventListener('click', (event) => (prevented = event.defaultPrevented), { once: true });
	wrapper.find('.docs-article').element.addEventListener('click', (event) => event.preventDefault(), { once: true });
	links[0]!.element.dispatchEvent(modified);
	await flushPromises();

	expect(prevented).toBe(false);
	expect(router.currentRoute.value.fullPath).toBe('/docs');
});
