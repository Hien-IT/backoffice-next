// Feature 017 (FR-062, T080): the flow list of `system-manual-flow-select` (016) follows the flows store, so a manual
// flow saved in the flows editor is offered after `hydrate()`; collection-only flows and other collections are not.
import { mount } from '@vue/test-utils';
import type { FlowRaw } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { expect, test } from 'vitest';
import { nextTick } from 'vue';
import BoSelect from '../../../components/BoSelect.vue';
import { i18n } from '../../../lang/index.ts';
import { useFlowsStore } from '../../../stores/flows.ts';
import SystemManualFlowSelect from './SystemManualFlowSelect.vue';

const flow = (id: string, options: Record<string, unknown>, extra: Partial<FlowRaw> = {}) =>
	({ id, name: id, icon: 'bolt', status: 'active', trigger: 'manual', options, ...extra }) as FlowRaw;

test('the manual flows of the collection, also one added to the store later; not collection-only ones', async () => {
	const pinia = createPinia();
	setActivePinia(pinia);
	const store = useFlowsStore();
	store.flows = [flow('a', { collections: ['bo_content'], location: 'both' })];

	const wrapper = mount(SystemManualFlowSelect, {
		props: { value: null, collectionName: 'bo_content' },
		global: { plugins: [pinia, i18n] },
	});
	const values = () => (wrapper.findComponent(BoSelect).props('items') as { value: string }[]).map((i) => i.value);
	expect(values()).toEqual(['a']);

	store.flows = [
		...store.flows,
		flow('b', { collections: ['bo_content'] }, { status: 'inactive' }),
		flow('c', { collections: ['bo_content'], location: 'collection' }),
		flow('d', { collections: ['bo_std'] }),
		flow('e', { collections: ['bo_content'] }, { trigger: 'webhook' }),
	];
	await nextTick();
	expect(values()).toEqual(['a', 'b']);
});
