// Spec 033 T053 (FR-024): the API page: the description, the list of endpoints linking to their cards, one card each.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import resource from '../../../docs/api/generated/folders.json';
import type { DocsApiResource } from '../../../docs/types.ts';
import { i18n } from '../../../lang/index.ts';
import DocsApiPage from './DocsApiResource.vue';

enableAutoUnmount(afterEach);

test('the description, the endpoint list linking to the cards, one card per endpoint', async () => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
	});
	await router.push('/docs/api/folders');
	const wrapper = mount(DocsApiPage, {
		props: { resource: resource as DocsApiResource },
		global: { plugins: [i18n, router] },
	});

	expect(wrapper.find('p[lang="en"]').text()).toContain('folders');
	const list = wrapper.find('nav[data-docs-endpoints]');
	expect(list.attributes('aria-label')).toBe('Endpoints');

	const links = list.findAll('a');
	expect(links).toHaveLength(resource.operations.length);
	expect(links.map((link) => link.attributes('href'))).toEqual(
		resource.operations.map((operation) => `#${operation.anchor}`),
	);
	expect(wrapper.findAll('section[data-operation]')).toHaveLength(resource.operations.length);

	await links[1]!.trigger('click');
	await flushPromises();
	expect(router.currentRoute.value.hash).toBe(`#${resource.operations[1]!.anchor}`);
});
