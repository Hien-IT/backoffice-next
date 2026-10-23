// DR has no test for system-scope.vue (spec 016 T100, US6-2, contracts/api-calls.md #155): the three choices,
// the current value first with the role or user name, DrawerCollection of directus_users / directus_roles and the
// emitted `all` / `user_<id>` / `role_<id>`.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed } from 'vue';
import { replaceQueue } from '../../../api/sdk.ts';
import BoSelect from '../../../components/BoSelect.vue';
import DrawerCollection from '../../../components/drawers/DrawerCollection.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import { resetNotices, useNotices } from '../../../composables/use-notices.ts';
import { i18n } from '../../../lang/index.ts';
import { calls, json, mockApi } from '../../../test-utils/fetch.ts';
import config from './index.ts';
import SystemScope from './SystemScope.vue';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockApi>;

beforeEach(async () => {
	setActivePinia(createPinia());
	resetNotices();
	await replaceQueue();
	fetch = mockApi({
		'GET /roles/r1': { id: 'r1', name: 'Editor' },
		'GET /users/u1': { id: 'u1', first_name: null, last_name: null, email: 'ann@example.com' },
		'GET /users/u2': () => json({ errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] }, 403),
	});
});

afterEach(() => vi.unstubAllGlobals());

async function mountScope(value: string | null) {
	const a11y = computed(() => ({ inputId: 'field-scope', labelId: 'l', describedBy: undefined, invalid: false }));
	const wrapper = mount(SystemScope, {
		props: { value, onInput: (v: string | null) => wrapper.setProps({ value: v }) },
		global: {
			plugins: [i18n],
			provide: { [FORM_FIELD_A11Y as symbol]: a11y },
			stubs: { DrawerCollection: true },
		},
	});
	await flushPromises();
	return { wrapper, select: () => wrapper.findComponent(BoSelect) };
}

describe('system-scope', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({
			id: 'system-scope',
			name: '$t:scope',
			icon: 'arrow_drop_down_circle',
			system: true,
		});
		expect(config.types).toEqual(['string']);
		expect(config.options).toEqual([]);
		expect(config.component).toBe(SystemScope);
	});

	test('`all`: the three choices, no request, linked to the form label', async () => {
		const { select } = await mountScope('all');

		expect(select().props('items')).toEqual([
			{ text: 'Global: All Users', value: 'all' },
			{ text: 'User: Select...', value: 'directus_users' },
			{ text: 'Role: Select...', value: 'directus_roles' },
		]);
		expect(select().props('modelValue')).toBe('all');
		expect(select().props('id')).toBe('field-scope');
		expect(calls(fetch)).toEqual([]);
	});

	test('a role value: GET /roles/<id> with id,name, the role name first', async () => {
		const { select } = await mountScope('role_r1');

		expect(calls(fetch)).toEqual(['GET /roles/r1?fields=id,name']);
		expect(select().props('items')[0]).toEqual({ text: 'Role: Editor', value: 'role_r1' });
		expect(select().props('items')).toHaveLength(4);
	});

	test('a user value: GET /users/<id> with the name fields, the email when there is no name', async () => {
		const { select } = await mountScope('user_u1');

		expect(calls(fetch)).toEqual(['GET /users/u1?fields=id,first_name,last_name,email']);
		expect(select().props('items')[0]).toEqual({ text: 'User: ann@example.com', value: 'user_u1' });
	});

	test('a failed name request shows the id and opens the error dialog', async () => {
		const { select } = await mountScope('user_u2');

		expect(select().props('items')[0]).toEqual({ text: 'User: u2', value: 'user_u2' });
		expect(useNotices().dialogs.value).toHaveLength(1);
	});

	test('choosing `all` emits it; choosing user or role opens DrawerCollection and emits its pick', async () => {
		const { wrapper, select } = await mountScope(null);

		expect(wrapper.findComponent(DrawerCollection).exists()).toBe(false);

		select().vm.$emit('update:modelValue', 'directus_users');
		await flushPromises();
		const drawer = () => wrapper.findComponent(DrawerCollection);
		expect(drawer().props()).toMatchObject({ active: true, collection: 'directus_users' });

		drawer().vm.$emit('input', ['u1']);
		await flushPromises();
		expect(wrapper.emitted('input')!.at(-1)).toEqual(['user_u1']);
		expect(select().props('items')[0]).toEqual({ text: 'User: ann@example.com', value: 'user_u1' });

		select().vm.$emit('update:modelValue', 'directus_roles');
		await flushPromises();
		expect(drawer().props('collection')).toBe('directus_roles');
		drawer().vm.$emit('input', ['r1']);
		await flushPromises();
		expect(wrapper.emitted('input')!.at(-1)).toEqual(['role_r1']);

		drawer().vm.$emit('update:active', false);
		await flushPromises();
		expect(drawer().exists()).toBe(false);

		select().vm.$emit('update:modelValue', 'all');
		expect(wrapper.emitted('input')!.at(-1)).toEqual(['all']);
	});
});
