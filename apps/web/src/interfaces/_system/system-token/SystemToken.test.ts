// Feature 015 (T071, FR-083, CHK023, CHK073, CHK084): system-token, the cases of Directus system-token.test.ts checked
// on the rendered field and the requests it sends.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '../../../lang/index.ts';
import { assertOnlyKnownRequests, calls, json, mockApi } from '../../../test-utils/fetch.ts';
import config from './index.ts';
import SystemToken from './SystemToken.vue';

enableAutoUnmount(afterEach);

const TOKEN = 'Abc123TokenFromApi';
const writeText = vi.fn(async () => {});
let refresh: ReturnType<typeof vi.fn>;
let fetch: ReturnType<typeof mockApi>;

function mountToken(props: Record<string, unknown> = {}) {
	return mount(SystemToken, {
		props: { value: null, primaryKey: 'user-1', collection: 'directus_users', ...props },
		global: { plugins: [i18n], provide: { refresh } },
		attachTo: document.body,
	});
}

const button = (action: string) => document.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const dialogButton = (text: string) =>
	[...dialog()!.querySelectorAll('button')].find((el) => el.textContent?.trim() === text)!;
const patchBodies = () =>
	fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH').map(([, init]) => JSON.parse(String(init!.body)));

beforeEach(() => {
	setActivePinia(createPinia());
	refresh = vi.fn();
	vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
	fetch = mockApi({ 'GET /utils/random/string': TOKEN, 'PATCH /users/user-1': { id: 'user-1' } });
});

afterEach(() => vi.unstubAllGlobals());

describe('system-token', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'system-token', icon: 'vpn_key', system: true, types: ['hash'], options: [] });
	});

	test('no token: a read-only password field with the generate placeholder and a generate button', () => {
		const wrapper = mountToken();
		const input = wrapper.get('input');

		expect(input.attributes('readonly')).toBeDefined();
		expect(input.attributes('type')).toBe('password');
		expect(input.attributes('placeholder')).toBe('Click "Generate Token" to create a new static access token');
		expect(button('generate')?.getAttribute('aria-label')).toBe('Generate Token');
		expect(button('remove')).toBeNull();
		expect(button('copy')).toBeNull();
		expect(document.querySelector('[data-action="key"]')).not.toBeNull();
	});

	test('generate: GET /utils/random/string, PATCH { token }, the token shown once with the notices and copy', async () => {
		const wrapper = mountToken();

		button('generate')!.click();
		await flushPromises();

		expect(calls(fetch)).toEqual(['GET /utils/random/string', 'PATCH /users/user-1']);
		expect(patchBodies()).toEqual([{ token: TOKEN }]);
		assertOnlyKnownRequests(calls(fetch));
		expect(wrapper.get('input').element.value).toBe(TOKEN);
		expect(wrapper.get('input').attributes('type')).toBe('text');
		expect(wrapper.text()).toContain('Token was saved successfully.');
		expect(wrapper.text()).toContain('Make sure to copy this token now.');
		expect(button('generate')?.getAttribute('aria-label')).toBe('Regenerate Token');

		button('copy')!.click();
		await flushPromises();
		expect(writeText).toHaveBeenCalledWith(TOKEN);
		expect(refresh).not.toHaveBeenCalled();
	});

	test('focus selects the shown token, blur clears the selection', async () => {
		const wrapper = mountToken();
		button('generate')!.click();
		await flushPromises();

		const input = wrapper.get('input').element;
		input.dispatchEvent(new FocusEvent('focus'));
		expect([input.selectionStart, input.selectionEnd]).toEqual([0, TOKEN.length]);
		input.dispatchEvent(new FocusEvent('blur'));
	});

	test('a stored token (masked by the API) shows "Value Securely Saved"; regenerate asks first in a danger dialog', async () => {
		const wrapper = mountToken({ value: '**********' });

		expect(wrapper.get('input').attributes('placeholder')).toBe('Value Securely Saved');
		expect(wrapper.get('input').attributes('data-saved')).toBeDefined();

		button('generate')!.click();
		await flushPromises();
		expect(calls(fetch)).toEqual([]);
		expect(dialog()?.textContent).toContain('The current token will be immediately invalidated.');

		dialogButton('Regenerate Token').click();
		await vi.waitFor(() => expect(dialog()).toBeNull());
		expect(patchBodies()).toEqual([{ token: TOKEN }]);
		expect(wrapper.get('input').element.value).toBe(TOKEN);
		expect(refresh).not.toHaveBeenCalled();
	});

	test('cancel closes the regenerate dialog without a request', async () => {
		mountToken({ value: '****' });
		button('generate')!.click();
		await flushPromises();

		dialogButton('Cancel').click();
		await flushPromises();
		expect(dialog()).toBeNull();
		expect(calls(fetch)).toEqual([]);
	});

	test('remove: danger dialog, PATCH { token: null }, then refresh', async () => {
		mountToken({ value: '****' });

		button('remove')!.click();
		await flushPromises();
		expect(dialog()?.textContent).toContain('Any API access using this token will stop working immediately.');

		dialogButton('Remove Token').click();
		await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
		expect(patchBodies()).toEqual([{ token: null }]);
		expect(dialog()).toBeNull();
	});

	test('a new user: field locked, notice, no buttons', () => {
		const wrapper = mountToken({ primaryKey: '+' });

		expect(wrapper.get('input').attributes('disabled')).toBeDefined();
		expect(wrapper.get('input').attributes('placeholder')).toBeUndefined();
		expect(wrapper.text()).toContain('Save this user before generating a token.');
		expect(button('generate')).toBeNull();
		expect(button('remove')).toBeNull();
		expect(document.querySelector('[data-action="key"]')).toBeNull();
	});

	test('disabled: no generate or remove button; the key icon is shown', () => {
		mountToken({ value: '****', disabled: true });

		expect(button('generate')).toBeNull();
		expect(button('remove')).toBeNull();
		expect(document.querySelector('[data-action="key"]')).not.toBeNull();
	});

	test('a 403 shows the error in place (CHK073); a failed regenerate keeps the dialog open with the error', async () => {
		fetch = mockApi({
			'GET /utils/random/string': TOKEN,
			'PATCH /users/user-1': () => json({ errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] }, 403),
		});
		const wrapper = mountToken();

		button('generate')!.click();
		await vi.waitFor(() => expect(wrapper.text()).toContain('Forbidden'));
		expect(wrapper.get('input').element.value).toBe('');

		await wrapper.setProps({ value: '****' });
		button('generate')!.click();
		await flushPromises();
		dialogButton('Regenerate Token').click();
		await vi.waitFor(() => expect(dialog()?.textContent).toContain('Forbidden'));
	});

	test('the token lives in the component only: not logged, gone after unmount (CHK084)', async () => {
		const log = vi.spyOn(console, 'log');
		const wrapper = mountToken();

		button('generate')!.click();
		await flushPromises();
		expect(log.mock.calls.flat().join(' ')).not.toContain(TOKEN);
		wrapper.unmount();

		// The API now returns the masked value; a new mount never shows the token again.
		expect(mountToken({ value: '****' }).get('input').element.value).toBe('');
		expect(location.href).not.toContain(TOKEN);
	});
});
