// Ported from directus/app/src/interfaces/select-dropdown-m2o/select-dropdown-m2o.test.ts
// Backoffice: mounted on the bo_rel m2o fields of the fixture snapshot with the real relation composables and stores
// (mockFixtureApi) instead of mocked composables; the DR cases are kept (disabled, nonEditable, enableLink, the
// click opening the select or edit drawer), plus FR-041/FR-042 options, notices, value shapes and the three users.
import type { FieldRaw } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import DrawerCollection from '../../components/drawers/DrawerCollection.vue';
import DrawerItem from '../../components/drawers/DrawerItem.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { type FixtureUser, fieldsOf, loadSnapshot, type Snapshot } from '../../test-utils/fixtures.ts';
import SelectDropdownM2O from './SelectDropdownM2O.vue';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;
let hydrateCalls = 0;

async function setup(user: FixtureUser = 'admin', snapshot: Snapshot = loadSnapshot()) {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(snapshot, { user });
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
	hydrateCalls = fetch.mock.calls.length;
}

beforeEach(() => setup());

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
});

const ownCalls = () => calls(fetch).slice(hydrateCalls);

function optionsOf(field: string): Record<string, unknown> {
	const raw = fieldsOf('bo_rel').find((f) => f.field === field) as FieldRaw;
	return raw.meta?.options ?? {};
}

async function mountM2O(
	field: string,
	props: Record<string, unknown> = {},
	provide: Record<string | symbol, unknown> = {},
) {
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

	const wrapper = mount(SelectDropdownM2O, {
		props: { ...optionsOf(field), collection: 'bo_rel', field, ...props },
		global: { plugins: [i18n, router], provide },
	});

	await flushPromises();
	return wrapper;
}

const main = (wrapper: Awaited<ReturnType<typeof mountM2O>>) => wrapper.get<HTMLButtonElement>('button.main');

describe('Interface', () => {
	it('should mount with the fixture field and value, without emitting', async () => {
		const wrapper = await mountM2O('m2o', { value: 1 });

		expect(wrapper.emitted('input')).toBeUndefined();
		expect(main(wrapper).text()).toBe('Target one (Published)');
		expect(ownCalls()).toContain('GET /items/bo_rel_target/1?fields=name,status,id');
	});

	it('should render action buttons disabled when disabled is true', async () => {
		const wrapper = await mountM2O('m2o', { value: null, enableLink: true, disabled: true });

		expect(main(wrapper).element.disabled).toBe(true);
		expect(wrapper.get('.item-actions button.add').attributes('disabled')).toBeDefined();
		expect(wrapper.findComponent(DrawerCollection).exists()).toBe(false);
	});

	it('should hide action buttons when nonEditable is true and enableLink is false', async () => {
		const wrapper = await mountM2O('m2o', { value: 1, enableLink: false, nonEditable: true, disabled: true });

		expect(wrapper.find('.item-actions').exists()).toBe(false);
	});

	it('should show item-actions with navigate link when nonEditable is true and enableLink is true', async () => {
		const wrapper = await mountM2O('m2o', { value: 1, enableLink: true, nonEditable: true, disabled: true });

		expect(wrapper.find('.item-actions').exists()).toBe(true);
		expect(wrapper.get('.item-actions a.item-link').attributes('href')).toBe('/content/bo_rel_target/1');
		expect(wrapper.find('.item-actions button.edit').exists()).toBe(false);
		expect(wrapper.find('.item-actions button.remove').exists()).toBe(false);
	});

	it('should show edit and remove controls when nonEditable is false', async () => {
		const wrapper = await mountM2O('m2o', { value: 1, enableLink: true });

		expect(wrapper.find('.item-actions button.edit').exists()).toBe(true);
		expect(wrapper.find('.item-actions button.remove').exists()).toBe(true);
	});

	it('should render non-clickable icon when disabled is true and nonEditable is false', async () => {
		const wrapper = await mountM2O('m2o', { value: 1, enableLink: true, disabled: true });

		expect(wrapper.find('.item-actions .item-link').exists()).toBe(false);
		expect(wrapper.get('.item-actions').text()).toContain('launch');
		expect(wrapper.get('button.edit').attributes('disabled')).toBeDefined();
		expect(wrapper.get('button.remove').attributes('disabled')).toBeDefined();
	});

	describe('on click', () => {
		it('should open the select modal', async () => {
			const wrapper = await mountM2O('m2o', { value: 1 });

			expect(wrapper.findComponent(DrawerCollection).props('active')).toBe(false);
			await main(wrapper).trigger('click');
			expect(wrapper.findComponent(DrawerCollection).props('active')).toBe(true);
		});

		it('should open the edit modal when enableSelect is false', async () => {
			const wrapper = await mountM2O('m2o', { value: 1, enableSelect: false });

			await main(wrapper).trigger('click');
			expect(wrapper.findComponent(DrawerItem).props('active')).toBe(true);
			expect(wrapper.findComponent(DrawerCollection).props('active')).toBe(false);
		});

		it('should open the edit modal when nonEditable is true', async () => {
			const wrapper = await mountM2O('m2o', { value: 1, nonEditable: true, disabled: true });

			expect(main(wrapper).element.disabled).toBe(false);
			await main(wrapper).trigger('click');
			expect(wrapper.findComponent(DrawerItem).props('active')).toBe(true);
			expect(wrapper.findComponent(DrawerItem).props('nonEditable')).toBe(true);
		});

		it('does nothing when disabled', async () => {
			const wrapper = await mountM2O('m2o', { value: 1, disabled: true });

			await main(wrapper).trigger('click');
			expect(wrapper.findComponent(DrawerItem).props('active')).toBe(false);
		});
	});
});

describe('defaults (Directus withDefaults)', () => {
	it('missing options: collection display template, select placeholder, create button, no link', async () => {
		const wrapper = await mountM2O('m2o_default', { value: 2 });

		expect(main(wrapper).text()).toBe('Target two');
		expect(wrapper.find('.item-link').exists()).toBe(false);
		expect(ownCalls()).toContain('GET /items/bo_rel_target/2?fields=name,id');

		await wrapper.setProps({ value: null });
		await flushPromises();
		expect(main(wrapper).text()).toBe('Select an item...');
		expect(wrapper.find('button.add').exists()).toBe(true);
		expect(wrapper.find('.expand').exists()).toBe(true);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	it('falls back to {{ primary key }} when the collection has no display template', async () => {
		const snapshot = loadSnapshot();
		snapshot.collections.find((c) => c['collection'] === 'bo_rel_target')!['meta'].display_template = null;
		await setup('admin', snapshot);

		const wrapper = await mountM2O('m2o_default', { value: 3 });

		expect(main(wrapper).text()).toBe('3');
		expect(ownCalls()).toContain('GET /items/bo_rel_target/3?fields=id');
	});
});

describe('options', () => {
	it('option:select-dropdown-m2o.template', async () => {
		const wrapper = await mountM2O('m2o', { value: 4, template: '{{ status }}: {{ name }}' });

		expect(main(wrapper).text()).toBe('Archived: Target four');
	});

	it('option:select-dropdown-m2o.enableCreate', async () => {
		const wrapper = await mountM2O('m2o', { value: null });

		await wrapper.get('button.add').trigger('click');
		expect(wrapper.findComponent(DrawerItem).props('active')).toBe(true);
		expect(wrapper.findComponent(DrawerItem).props('primaryKey')).toBe('+');

		await wrapper.setProps({ enableCreate: false });
		expect(wrapper.find('button.add').exists()).toBe(false);
	});

	it('option:select-dropdown-m2o.enableSelect', async () => {
		const wrapper = await mountM2O('m2o', { value: null, enableSelect: false });

		expect(main(wrapper).text()).toBe('Create Item');
		expect(wrapper.find('.expand').exists()).toBe(false);
	});

	it('option:select-dropdown-m2o.filter fills {{ field }} from the form values', async () => {
		const values = ref({ title: 'Target t' });
		const wrapper = await mountM2O('m2o', { value: null }, { values });

		expect(wrapper.findComponent(DrawerCollection).props('filter')).toEqual({
			_and: [{ name: { _contains: 'Target t' } }],
		});

		values.value = { title: 'four' };
		await flushPromises();
		expect(wrapper.findComponent(DrawerCollection).props('filter')).toEqual({
			_and: [{ name: { _contains: 'four' } }],
		});
	});

	it('option:select-dropdown-m2o.enableLink', async () => {
		const wrapper = await mountM2O('m2o', { value: 1 });

		expect(wrapper.get('a.item-link').attributes('href')).toBe('/content/bo_rel_target/1');
		expect(wrapper.get('a.item-link').attributes('aria-label')).toBe('Navigate to Item');

		await wrapper.setProps({ enableLink: false });
		expect(wrapper.find('a.item-link').exists()).toBe(false);
	});

	it('owner (m2o to directus_users) links to the user route', async () => {
		const wrapper = await mountM2O('owner', { value: 'bo-9', enableLink: true });

		expect(main(wrapper).text()).toBe('Edith Editor');
		expect(wrapper.get('a.item-link').attributes('href')).toBe('/users/bo-9');
		expect(ownCalls()).toContain('GET /users/bo-9?fields=first_name,last_name,id');
	});
});

describe('notices', () => {
	it('relation not set up', async () => {
		const wrapper = await mountM2O('title', { value: null });

		expect(wrapper.text()).toContain(i18n.global.t('relationship_not_setup'));
		expect(wrapper.find('button.main').exists()).toBe(false);
	});

	it('related collection the user cannot see counts as no relation', async () => {
		const snapshot = loadSnapshot();
		snapshot.collections = snapshot.collections.filter((c) => c['collection'] !== 'bo_rel_target');
		await setup('admin', snapshot);

		const wrapper = await mountM2O('m2o', { value: 1 });

		expect(wrapper.text()).toContain(i18n.global.t('relationship_not_setup'));
		expect(ownCalls()).toEqual([]);
	});

	it('singleton related collection', async () => {
		const snapshot = loadSnapshot();
		snapshot.collections.find((c) => c['collection'] === 'bo_rel_target')!['meta'].singleton = true;
		await setup('admin', snapshot);

		const wrapper = await mountM2O('m2o', { value: null });

		expect(wrapper.text()).toContain('Relationships to Singletons are not supported');
	});

	it('neither create nor select and no item', async () => {
		const wrapper = await mountM2O('m2o', { value: null, enableCreate: false, enableSelect: false });

		expect(wrapper.text()).toContain('No items');
		expect(wrapper.find('button.main').exists()).toBe(false);

		await wrapper.setProps({ value: 1 });
		await flushPromises();
		expect(main(wrapper).text()).toBe('Target one (Published)');
	});
});

describe('value shapes (FR-040)', () => {
	it('selecting in the drawer emits the key; an empty selection emits null', async () => {
		const wrapper = await mountM2O('m2o', { value: 1 });

		wrapper.findComponent(DrawerCollection).vm.$emit('input', [3]);
		wrapper.findComponent(DrawerCollection).vm.$emit('input', []);

		expect(wrapper.emitted('input')).toEqual([[3], [null]]);
	});

	it('editing the selected item emits the edits with its primary key', async () => {
		const wrapper = await mountM2O('m2o', { value: 1 });

		await wrapper.get('button.edit').trigger('click');
		expect(wrapper.findComponent(DrawerItem).props()).toMatchObject({ active: true, primaryKey: 1, edits: {} });

		wrapper.findComponent(DrawerItem).vm.$emit('input', { name: 'Renamed' });
		expect(wrapper.emitted('input')).toEqual([[{ name: 'Renamed', id: 1 }]]);
	});

	it('creating emits the new item; the staged edits show and go back to the drawer', async () => {
		const wrapper = await mountM2O('m2o', { value: null });

		wrapper.findComponent(DrawerItem).vm.$emit('input', { name: 'New one', status: 'draft' });
		expect(wrapper.emitted('input')).toEqual([[{ name: 'New one', status: 'draft' }]]);

		await wrapper.setProps({ value: { name: 'New one', status: 'draft' } });
		await flushPromises();

		expect(main(wrapper).text()).toBe('New one (Draft)');
		expect(wrapper.findComponent(DrawerItem).props('edits')).toEqual({ name: 'New one', status: 'draft' });
		expect(ownCalls()).toEqual([]);
	});

	it('deselect emits null; with staged edits it asks first', async () => {
		const wrapper = await mountM2O('m2o', { value: 1 });

		expect(wrapper.get('button.remove').attributes('aria-label')).toBe('Deselect');
		await wrapper.get('button.remove').trigger('click');
		expect(wrapper.emitted('input')).toEqual([[null]]);

		await wrapper.setProps({ value: { id: 1, name: 'Changed' } });
		await flushPromises();

		expect(wrapper.get('button.remove').attributes('aria-label')).toBe('Remove Item');
		await wrapper.get('button.remove').trigger('click');
		expect(wrapper.emitted('input')).toHaveLength(1);

		await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
		const del = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
			(b) => b.textContent?.trim() === 'Delete',
		)!;
		del.click();
		await flushPromises();

		expect(wrapper.emitted('input')).toEqual([[null], [null]]);
	});
});

describe('permissions (FR-041, three fixture users)', () => {
	it('admin: create button', async () => {
		const wrapper = await mountM2O('m2o_default', { value: null });

		expect(wrapper.find('button.add').exists()).toBe(true);
	});

	it('bo-editor: no create on bo_rel_target hides the create button, selecting still works', async () => {
		await setup('bo-editor');
		const wrapper = await mountM2O('m2o_default', { value: 2 });

		expect(main(wrapper).text()).toBe('Target two');
		expect(wrapper.find('button.edit').exists()).toBe(true);

		await wrapper.setProps({ value: null });
		await flushPromises();
		expect(wrapper.find('button.add').exists()).toBe(false);

		await main(wrapper).trigger('click');
		expect(wrapper.findComponent(DrawerCollection).props('active')).toBe(true);
	});

	it('bo-viewer: read-only form still opens the link', async () => {
		await setup('bo-viewer');
		const wrapper = await mountM2O('m2o', { value: 1, disabled: true, nonEditable: true });

		expect(main(wrapper).text()).toBe('Target one (Published)');
		expect(wrapper.get('a.item-link').attributes('href')).toBe('/content/bo_rel_target/1');
		expect(wrapper.find('button.edit').exists()).toBe(false);
		expect(wrapper.find('button.remove').exists()).toBe(false);
		expect(wrapper.findComponent(DrawerCollection).exists()).toBe(false);
	});
});

describe('states', () => {
	it('loading prop holds the request', async () => {
		const wrapper = await mountM2O('m2o', { value: 1, loading: true });

		const previews = () => ownCalls().filter((call) => call.endsWith('fields=name,status,id'));
		expect(previews()).toEqual([]);

		await wrapper.setProps({ loading: false });
		await flushPromises();
		expect(previews()).toHaveLength(1);
	});

	it('label linking and invalid state from the form field', async () => {
		const a11y = computed(() => ({ inputId: 'in-1', labelId: 'lb-1', describedBy: 'err-1', invalid: true }));
		const wrapper = await mountM2O('m2o', { value: 1 }, { [FORM_FIELD_A11Y as symbol]: a11y });

		expect(main(wrapper).attributes()).toMatchObject({
			id: 'in-1',
			'aria-labelledby': 'lb-1 in-1',
			'aria-describedby': 'err-1',
			'aria-invalid': 'true',
			type: 'button',
		});
		expect(wrapper.get('.item-row').classes()).toContain('border-error-600');
	});
});
