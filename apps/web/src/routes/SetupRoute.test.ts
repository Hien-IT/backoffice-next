import type { VueHeadClient } from '@unhead/vue';
import { flushPromises, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { replaceQueue } from '../api/sdk.ts';
import { login } from '../auth.ts';
import BoSelect from '../components/BoSelect.vue';
import { i18n } from '../lang/index.ts';
import { json, mockApi } from '../test-utils/fetch.ts';
import { mountLayout } from '../test-utils/layout.ts';
import SetupRoute from './SetupRoute.vue';

vi.mock('../auth.ts', () => ({ login: vi.fn() }));

const { t } = i18n.global;

beforeEach(() => {
	vi.mocked(login).mockReset();
	return replaceQueue();
});
afterEach(() => {
	vi.unstubAllGlobals();
	document.body.innerHTML = '';
});

function mountRoute() {
	return mountLayout(
		{ template: '<RouterView />' },
		{
			path: '/setup',
			routes: [
				{ path: '/setup', component: SetupRoute },
				{ path: '/content', component: { template: '<p />' } },
			],
		},
	);
}

function body(fetch: ReturnType<typeof mockApi>) {
	const call = fetch.mock.calls.find(([input]) => String(input).endsWith('/server/setup'));
	return call ? JSON.parse(String(call[1]!.body)) : undefined;
}

async function title(head: VueHeadClient<any>) {
	return (await head.resolveTags()).find((tag) => tag.tag === 'title')?.textContent;
}

async function fill(wrapper: VueWrapper, values: Record<string, string>) {
	for (const [name, value] of Object.entries(values)) await wrapper.get(`input[name="${name}"]`).setValue(value);
}

const admin = {
	first_name: 'Ada',
	last_name: 'Admin',
	project_owner: 'admin@example.com',
	password: 'secret',
	password_confirm: 'secret',
};

describe('SetupRoute', () => {
	test('labelled fields; launch is disabled until the form is complete', async () => {
		mockApi({});
		const { wrapper, head } = await mountRoute();

		expect(await title(head)).toBe('Setup Project');
		expect(wrapper.get('h1').text()).toBe(t('setup_welcome'));
		const labels: Record<string, [string, string]> = {
			first_name: ['First Name', 'given-name'],
			last_name: ['Last Name', 'family-name'],
			project_owner: ['Admin Email', 'email'],
			password: ['Password', 'new-password'],
			password_confirm: ['Confirm Password', 'new-password'],
		};
		for (const [name, [label, autocomplete]] of Object.entries(labels)) {
			const input = wrapper.get(`input[name="${name}"]`);
			expect(wrapper.get(`label[for="${input.attributes('id')}"]`).text()).toBe(label);
			expect(input.attributes('autocomplete')).toBe(autocomplete);
		}
		expect(wrapper.text()).toContain(t('how_do_you_use_directus'));
		expect(wrapper.text()).toContain(t('setup_marketing_emails'));
		expect(wrapper.find('input[name="org_name"]').exists()).toBe(false);

		const launch = wrapper.get('button[type="submit"]');
		expect(launch.text()).toContain('Launch Backoffice');
		expect(launch.attributes('disabled')).toBeDefined();

		await fill(wrapper, { ...admin, project_owner: 'not-an-email' });
		expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
		await fill(wrapper, { project_owner: 'admin@example.com' });
		expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();

		// Commercial use needs an organization name
		wrapper.getComponent(BoSelect).vm.$emit('update:modelValue', 'commercial');
		await flushPromises();
		expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
		await fill(wrapper, { org_name: 'Acme' });
		expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
		wrapper.unmount();
	});

	test('POST /server/setup with the Directus keys, then sign in with the new admin and open /content', async () => {
		const fetch = mockApi({ 'POST /server/setup': () => new Response(null, { status: 204 }) });
		vi.mocked(login).mockResolvedValue();
		const { wrapper, router } = await mountRoute();

		await fill(wrapper, admin);
		wrapper.getComponent(BoSelect).vm.$emit('update:modelValue', 'commercial');
		await flushPromises();
		await fill(wrapper, { org_name: 'Acme' });
		await wrapper.get('input[name="product_updates"]').setValue(true);
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(body(fetch)).toEqual({
			first_name: 'Ada',
			last_name: 'Admin',
			project_owner: 'admin@example.com',
			password: 'secret',
			password_confirm: 'secret',
			project_usage: 'commercial',
			org_name: 'Acme',
			product_updates: true,
		});
		expect(login).toHaveBeenCalledWith({ credentials: { email: 'admin@example.com', password: 'secret' } });
		expect(router.currentRoute.value.fullPath).toBe('/content');
		wrapper.unmount();
	});

	test('leaving commercial use clears the organization name', async () => {
		const fetch = mockApi({ 'POST /server/setup': () => new Response(null, { status: 204 }) });
		vi.mocked(login).mockResolvedValue();
		const { wrapper } = await mountRoute();
		const select = wrapper.getComponent(BoSelect);

		await fill(wrapper, admin);
		select.vm.$emit('update:modelValue', 'commercial');
		await flushPromises();
		await fill(wrapper, { org_name: 'Acme' });
		select.vm.$emit('update:modelValue', 'personal');
		await flushPromises();
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(body(fetch)).toMatchObject({ project_usage: 'personal', org_name: null, product_updates: false });
		wrapper.unmount();
	});

	test('passwords that do not match show a field error and send nothing', async () => {
		const fetch = mockApi({});
		const { wrapper } = await mountRoute();

		await fill(wrapper, { ...admin, password_confirm: 'other' });
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		const confirm = wrapper.get('input[name="password_confirm"]');
		expect(confirm.attributes('aria-invalid')).toBe('true');
		expect(wrapper.get(`#${confirm.attributes('aria-describedby')}`).text()).toContain('Passwords do not match');
		expect(body(fetch)).toBeUndefined();
		expect(login).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	test('an API error shows translated with its message; no sign in', async () => {
		mockApi({
			'POST /server/setup': () =>
				json({ errors: [{ message: 'You do not have permission', extensions: { code: 'FORBIDDEN' } }] }, 403),
		});
		const { wrapper, router } = await mountRoute();

		await fill(wrapper, admin);
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		const alert = wrapper.get('[role="alert"]');
		expect(alert.text()).toContain(t('errors.FORBIDDEN'));
		expect(alert.text()).toContain('You do not have permission');
		expect(login).not.toHaveBeenCalled();
		expect(router.currentRoute.value.fullPath).toBe('/setup');
		wrapper.unmount();
	});
});
