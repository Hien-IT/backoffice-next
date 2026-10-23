// Feature 016 (T090, US5-3): system-owner as DR: the owner email with the edit button, the drawer with the owner
// fields of the setup form (organisation only for commercial use), save disabled until something changes,
// `POST /settings/owner` with the four keys and a settings reload, an invalid email blocks the request.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { replaceQueue } from '../../../api/sdk.ts';
import BoForm from '../../../components/form/BoForm.vue';
import { i18n } from '../../../lang/index.ts';
import { useSettingsStore } from '../../../stores/settings.ts';
import { useUserStore } from '../../../stores/user.ts';
import { calls, json, mockApi } from '../../../test-utils/fetch.ts';
import SystemOwner from './SystemOwner.vue';

enableAutoUnmount(afterEach);

const t = (key: string) => i18n.global.t(key);

let pinia: ReturnType<typeof createPinia>;
let fetch: ReturnType<typeof mockApi>;

beforeEach(async () => {
	await replaceQueue();
	pinia = createPinia();
	setActivePinia(pinia);
	// settingsStore.hydrate reloads only for a signed-in user.
	useUserStore().currentUser = { id: 'u1' } as never;
	useSettingsStore().settings = {
		project_owner: 'owner@example.test',
		project_usage: 'personal',
		org_name: null,
		product_updates: false,
	} as never;
	fetch = mockApi({
		'POST /settings/owner': ({ init }: { init: RequestInit }) => json({ data: JSON.parse(String(init.body)) }),
		'GET /settings': { project_owner: 'new@example.test', project_usage: 'commercial', org_name: 'ACME' },
	});
});

async function render() {
	const wrapper = mount(SystemOwner, {
		props: { value: 'owner@example.test' },
		global: { plugins: [pinia, i18n] },
		attachTo: document.body,
	});
	await flushPromises();
	return wrapper;
}

const drawerButton = (label: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
		(button) => button.getAttribute('aria-label') === label,
	)!;

const fieldsOf = (wrapper: Awaited<ReturnType<typeof render>>) =>
	(wrapper.findComponent(BoForm).props('fields') as { field: string }[]).map((field) => field.field);

test('the owner email and a named edit button opening the drawer with the owner fields', async () => {
	const wrapper = await render();

	expect(wrapper.text()).toContain('owner@example.test');
	await wrapper.get(`button[aria-label="${t('interfaces.system-owner.edit')}"]`).trigger('click');
	await flushPromises();

	expect(document.body.textContent).toContain(t('interfaces.system-owner.update'));
	expect(fieldsOf(wrapper)).toEqual(['project_owner', 'project_usage']);
	expect(drawerButton(t('save')).disabled).toBe(true);
});

test('commercial use adds the organisation; save posts the four keys and reloads the settings', async () => {
	const wrapper = await render();
	await wrapper.get(`button[aria-label="${t('interfaces.system-owner.edit')}"]`).trigger('click');
	await flushPromises();

	wrapper.findComponent(BoForm).vm.$emit('update:modelValue', {
		project_owner: 'new@example.test',
		project_usage: 'commercial',
	});
	await flushPromises();
	expect(fieldsOf(wrapper)).toEqual(['project_owner', 'project_usage', 'org_name']);

	wrapper.findComponent(BoForm).vm.$emit('update:modelValue', {
		project_owner: 'new@example.test',
		project_usage: 'commercial',
		org_name: 'ACME',
	});
	await flushPromises();
	drawerButton(t('save')).click();
	await flushPromises();

	const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
	expect(JSON.parse(String(post[1]!.body))).toEqual({
		project_owner: 'new@example.test',
		project_usage: 'commercial',
		org_name: 'ACME',
		product_updates: false,
	});
	expect(calls(fetch)).toContain('GET /settings');
});

test('an invalid email (or a missing organisation) blocks the request', async () => {
	const wrapper = await render();
	await wrapper.get(`button[aria-label="${t('interfaces.system-owner.edit')}"]`).trigger('click');
	await flushPromises();

	wrapper.findComponent(BoForm).vm.$emit('update:modelValue', { project_owner: 'not-an-email' });
	await flushPromises();
	drawerButton(t('save')).click();
	await flushPromises();

	expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
	expect(
		(wrapper.findComponent(BoForm).props('validationErrors') as { field: string; type: string }[]).map((e) => [
			e.field,
			e.type,
		]),
	).toContainEqual(['project_owner', 'email']);
});
