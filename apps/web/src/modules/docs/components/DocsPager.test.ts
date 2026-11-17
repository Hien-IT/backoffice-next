// Spec 033 T023 (FR-008).
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { DocsPage } from '../../../docs/types.ts';
import { i18n } from '../../../lang/index.ts';
import DocsPager from './DocsPager.vue';

enableAutoUnmount(afterEach);

const page = (path: string, title: string): DocsPage => ({ path, title, lead: 'x', kind: 'markdown', source: 'x' });

async function pager(props: { previous?: DocsPage; next?: DocsPage }) {
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { render: () => null } }] });
	await router.push('/docs');
	return mount(DocsPager, { props, global: { plugins: [i18n, router] } });
}

test('both links, with their labels and targets', async () => {
	const wrapper = await pager({ previous: page('', 'Bắt đầu'), next: page('configuration/database', 'Cơ sở dữ liệu') });
	const [previous, next] = wrapper.findAll('a');

	expect(previous!.attributes('href')).toBe('/docs');
	expect(previous!.text()).toBe('PreviousBắt đầu');
	expect(next!.attributes('href')).toBe('/docs/configuration/database');
	expect(next!.text()).toBe('NextCơ sở dữ liệu');
	expect(wrapper.find('nav').attributes('aria-label')).toBe('Previous and next page');
});

test('the first page has no previous link, the last no next link, a lone page no pager', async () => {
	expect((await pager({ next: page('a', 'A') })).findAll('a').map((a) => a.attributes('rel'))).toEqual(['next']);
	expect((await pager({ previous: page('a', 'A') })).findAll('a').map((a) => a.attributes('rel'))).toEqual(['prev']);
	expect((await pager({})).find('nav').exists()).toBe(false);
});
