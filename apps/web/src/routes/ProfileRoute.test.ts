import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { replaceQueue } from '../api/sdk.ts';
import BoSelect from '../components/BoSelect.vue';
import { getInternalModules, registeredModules } from '../modules/index.ts';
import { useUserStore } from '../stores/user.ts';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import { mountLayout } from '../test-utils/layout.ts';
import type { AppUser } from '../types/user.ts';
import ProfileRoute from './ProfileRoute.vue';

vi.mock('../composables/use-media-query.ts', () => ({
	useLayoutBreakpoints: () => ({ lg: ref(true), xl: ref(true) }),
}));
vi.mock('../router/index.ts', () => ({ router: {} }));
vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

enableAutoUnmount(afterEach);

const USER = {
	id: 'u1',
	first_name: 'Ada',
	last_name: 'Lovelace',
	email: 'ada@example.com',
	avatar: { id: 'f1' },
	language: null,
	appearance: null,
	theme_light_overrides: { primary: '#aa0000' },
	theme_dark_overrides: null,
	admin_access: true,
	app_access: true,
};

const HYDRATE = {
	'GET /users/me': { ...USER, avatar: 'f1' },
	'GET /policies/me/globals': { admin_access: true, app_access: true, enforce_tfa: false },
	'GET /roles/me': [],
};

let fetch: ReturnType<typeof mockApi>;

beforeEach(async () => {
	// No rate limit: the default queue spaces requests 500 ms apart after five.
	await replaceQueue();
	fetch = mockApi(HYDRATE);
	registeredModules.value = getInternalModules();
});

async function render(user: Partial<AppUser> = {}) {
	const result = await mountLayout(ProfileRoute, {
		path: '/users/me',
		beforeMount: () => {
			useUserStore().currentUser = { ...structuredClone(USER), ...user } as unknown as AppUser;
		},
	});

	fetch.mockClear();
	return result;
}

/** The control named by a visible label. */
function field(label: string) {
	const element = [...document.querySelectorAll('label')].find((l) => l.textContent?.trim() === label);
	if (!element) throw new Error(`No label ${label}`);
	return document.getElementById(element.htmlFor) as HTMLInputElement;
}

function type(label: string, value: string) {
	const input = field(label);
	input.value = value;
	input.dispatchEvent(new Event('input'));
}

async function submit() {
	document.querySelector('form')!.dispatchEvent(new Event('submit'));
	await flushPromises();
}

function patchBody() {
	const call = fetch.mock.calls.find(([, init]) => init?.method === 'PATCH');
	return call ? JSON.parse(String(call[1]!.body)) : undefined;
}

describe('ProfileRoute (FR-060)', () => {
	test('shows the current values under the Directus field labels; nothing changed, nothing to save', async () => {
		const { wrapper } = await render();

		expect(document.querySelector('header h1')!.textContent).toBe('Profile');
		expect(field('First Name').value).toBe('Ada');
		expect(field('Last Name').value).toBe('Lovelace');
		expect(field('Email').value).toBe('ada@example.com');
		expect(field('Password').value).toBe('');
		expect(field('Avatar').type).toBe('file');
		expect(field('Language').textContent).toContain('Default Language');
		expect(field('Appearance').textContent).toContain('Default (Sync with Project)');
		expect(JSON.parse(field('Light Theme Customization').value)).toEqual({ primary: '#aa0000' });
		expect(field('Dark Theme Customization').value).toBe('');
		expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();

		await submit();
		expect(fetch).not.toHaveBeenCalled();
	});

	test('sends only the changed fields, then hydrates the user', async () => {
		fetch = mockApi({ ...HYDRATE, 'PATCH /users/me': {} });
		const { wrapper } = await render();

		type('First Name', 'Grace');
		type('Last Name', '');
		type('Password', 'new-secret');
		const [language, appearance] = wrapper.findAllComponents(BoSelect);
		language!.vm.$emit('update:modelValue', 'vi-VN');
		appearance!.vm.$emit('update:modelValue', 'dark');
		await submit();

		expect(patchBody()).toEqual({
			first_name: 'Grace',
			last_name: null,
			password: 'new-secret',
			language: 'vi-VN',
			appearance: 'dark',
		});
		expect(calls(fetch)).toEqual(
			expect.arrayContaining(['PATCH /users/me', expect.stringMatching(/^GET \/users\/me/)]),
		);
		// The hydrated user resets the form (password emptied).
		expect(field('Password').value).toBe('');
	});

	test('"default" choices send null', async () => {
		fetch = mockApi({ ...HYDRATE, 'PATCH /users/me': {} });
		const { wrapper } = await render({ language: 'vi-VN', appearance: 'light' });
		expect(field('Language').textContent).toContain('Vietnamese');

		const [language, appearance] = wrapper.findAllComponents(BoSelect);
		language!.vm.$emit('update:modelValue', 'default');
		appearance!.vm.$emit('update:modelValue', 'default');
		await submit();

		expect(patchBody()).toEqual({ language: null, appearance: null });
	});

	test('JSON overrides: parsed when changed, not sent when only reformatted', async () => {
		fetch = mockApi({ ...HYDRATE, 'PATCH /users/me': {} });
		await render();

		type('Light Theme Customization', '{"primary":"#aa0000"}');
		type('Dark Theme Customization', '{ "background": "black" }');
		await submit();

		expect(patchBody()).toEqual({ theme_dark_overrides: { background: 'black' } });
	});

	test('invalid JSON: error on the field, nothing sent', async () => {
		const { wrapper } = await render();

		type('Dark Theme Customization', '{ primary: ');
		await submit();

		const textarea = field('Dark Theme Customization');
		expect(textarea.getAttribute('aria-invalid')).toBe('true');
		expect(document.getElementById(textarea.getAttribute('aria-describedby')!)!.textContent).toContain('Invalid Input');
		expect(fetch).not.toHaveBeenCalled();
		expect(wrapper.find('[role="alert"]').exists()).toBe(true);
	});

	test('RECORD_NOT_UNIQUE and FAILED_VALIDATION go on their field', async () => {
		fetch = mockApi({
			...HYDRATE,
			'PATCH /users/me': () =>
				json(
					{
						errors: [
							{
								message: 'dup',
								extensions: { code: 'RECORD_NOT_UNIQUE', collection: 'directus_users', field: 'email' },
							},
							{ message: 'bad', extensions: { code: 'FAILED_VALIDATION', field: 'first_name', type: 'nnull' } },
						],
					},
					400,
				),
		});
		await render();

		type('Email', 'admin@example.com');
		type('First Name', 'X');
		await submit();

		const email = field('Email');
		expect(document.getElementById(email.getAttribute('aria-describedby')!)!.textContent).toContain(
			'Value has to be unique',
		);
		const firstName = field('First Name');
		expect(document.getElementById(firstName.getAttribute('aria-describedby')!)!.textContent).toContain(
			"Value can't be null",
		);
		expect(document.body.textContent).not.toContain('Duplicate value detected');
	});

	test('other API errors show in a notice', async () => {
		fetch = mockApi({
			...HYDRATE,
			'PATCH /users/me': () => json({ errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }] }, 403),
		});
		await render();

		type('First Name', 'X');
		await submit();

		expect(document.querySelector('[role="alert"]')!.textContent).toContain('Forbidden');
	});

	test('avatar: uploads the file with POST /files, saves its id; remove sends null', async () => {
		fetch = mockApi({ ...HYDRATE, 'POST /files': { id: 'f2' }, 'PATCH /users/me': {} });
		const { wrapper } = await render();

		const input = field('Avatar');
		const file = new File(['png'], 'me.png', { type: 'image/png' });
		Object.defineProperty(input, 'files', { value: [file] });
		input.dispatchEvent(new Event('change'));
		await flushPromises();

		const upload = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
		expect(new URL(String(upload[0])).pathname).toBe('/files');
		expect((upload[1]!.body as FormData).get('file')).toBeInstanceOf(File);

		await submit();
		expect(patchBody()).toEqual({ avatar: 'f2' });

		fetch.mockClear();
		const remove = wrapper.findAll('button').find((b) => b.text() === 'Remove')!;
		await remove.trigger('click');
		await submit();
		expect(patchBody()).toEqual({ avatar: null });
	});
});
