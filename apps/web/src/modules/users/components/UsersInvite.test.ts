// Directus has no test for users-invite.vue: emails split on commas and new lines, the roles loaded on open, and no
// role at all sends the invite without `role` (FR-063, CHK019).
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../../api/sdk.ts';
import { mockApi } from '../../../test-utils/fetch.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import UsersInvite from './UsersInvite.vue';

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => replaceQueue());

test('no role at all: the select is empty and the invite goes without role', async () => {
	const fetch = mockApi({ 'GET /roles': [], 'POST /users/invite': null });
	const { wrapper } = await mountLayout(UsersInvite, { props: { modelValue: false } });
	await wrapper.setProps({ modelValue: true });
	await flushPromises();

	const textarea = document.querySelector('[role="dialog"] textarea') as HTMLTextAreaElement;
	textarea.value = ' a@example.com ,\n\nb@example.com';
	textarea.dispatchEvent(new Event('input'));
	await flushPromises();
	document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')!.click();
	await vi.waitFor(() => expect(wrapper.emitted('invited')).toHaveLength(1));

	const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
	expect(JSON.parse(String(post[1]!.body))).toEqual({ email: ['a@example.com', 'b@example.com'] });
	expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
});
