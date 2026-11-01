// Backoffice (spec 029, T032, T045, contracts/web.md, design-system Q-47): the Passkeys card in chromium with the
// passkey probe and use-passkeys mocked: visibility, empty state, the two-step add dialog, rename, delete with focus back
// on the trigger, the admin branch, the limit, axe.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import type { Passkey } from '../../../composables/use-passkeys.ts';
import { i18n } from '../../../lang/index.ts';
import '../../../styles/index.css';
import { useUserStore } from '../../../stores/user.ts';
import type { AppUser } from '../../../types/user.ts';
import UserPasskeys from './UserPasskeys.vue';

const available = ref(true);
const state = vi.hoisted(() => ({ api: undefined as any }));

vi.mock('../../../composables/use-passkey-support.ts', () => ({
	usePasskeySupport: () => ({ passkeyAvailable: available, ready: Promise.resolve(available.value) }),
}));

vi.mock('../../../composables/use-passkeys.ts', async (original) => {
	const actual = await original<typeof import('../../../composables/use-passkeys.ts')>();
	const { computed, ref } = await import('vue');

	return {
		...actual,
		usePasskeys: vi.fn(() => {
			const passkeys = ref<Passkey[]>([]);

			state.api = {
				passkeys,
				loading: ref(false),
				error: ref(null),
				atLimit: computed(() => passkeys.value.length >= actual.MAX_PASSKEYS),
				load: vi.fn(async () => undefined),
				begin: vi.fn(async () => ({ id: 'cred' })),
				save: vi.fn(async (_r: unknown, name: string) => {
					passkeys.value = [...passkeys.value, passkey('new', name)];
				}),
				rename: vi.fn(async (id: string, name: string) => {
					passkeys.value = passkeys.value.map((p) => (p.id === id ? { ...p, name } : p));
				}),
				remove: vi.fn(async (id: string) => {
					passkeys.value = passkeys.value.filter((p) => p.id !== id);
				}),
			};

			return state.api;
		}),
	};
});

function passkey(id: string, name = id): Passkey {
	return {
		id,
		name,
		date_created: new Date(Date.now() - 3_600_000).toISOString(),
		last_used: null,
		device_type: 'singleDevice',
		backed_up: false,
		transports: ['internal'],
	};
}

enableAutoUnmount(afterEach);

beforeEach(() => {
	setActivePinia(createPinia());
	available.value = true;
	useUserStore().currentUser = { id: 'me', admin_access: false } as unknown as AppUser;
});

function mountCard(props: Partial<{ userId: string; provider: string | null; isCurrentUser: boolean }> = {}) {
	return mount(UserPasskeys, {
		props: { userId: 'me', provider: 'default', isCurrentUser: true, ...props },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

const card = () => document.querySelector<HTMLElement>('[data-testid="user-passkeys"]');
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

const buttonIn = (root: ParentNode | null, text: string) =>
	// An icon button's text starts with the Material Symbols ligature ("add"): match the end.
	[...(root?.querySelectorAll('button') ?? [])].find((el) => el.textContent?.trim().endsWith(text));

async function seriousViolations(root: Element) {
	const { violations } = await axe.run(root, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
	return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
}

describe('visibility', () => {
	test('hidden without passkey support, for a non-local user, and for another user when not admin', async () => {
		available.value = false;
		mountCard();
		await flushPromises();
		expect(card()).toBeNull();

		available.value = true;
		await flushPromises();
		expect(card()).not.toBeNull();
	});

	test('hidden for an SSO user and for another user of a non-admin', async () => {
		const sso = mountCard({ provider: 'oidc' });
		await flushPromises();
		expect(card()).toBeNull();
		sso.unmount();

		mountCard({ userId: 'other', isCurrentUser: false });
		await flushPromises();
		expect(card()).toBeNull();
	});
});

describe('own passkeys (US2)', () => {
	test('empty state with a title, a hint and the add button; no axe violation', async () => {
		mountCard();
		await flushPromises();

		expect(state.api.load).toHaveBeenCalled();
		expect(card()!.querySelector('h3')!.textContent).toContain('Passkeys');
		expect(card()!.textContent).toContain('No passkeys yet');
		expect(buttonIn(card(), 'Add passkey')).toBeDefined();
		expect(await seriousViolations(card()!)).toEqual([]);
	});

	test('add: password step, then name step with a suggested name, then the new row', async () => {
		mountCard();
		await flushPromises();

		buttonIn(card(), 'Add passkey')!.click();
		await flushPromises();
		expect(dialog()!.textContent).toContain('Enter your password to add a passkey');

		const password = dialog()!.querySelector<HTMLInputElement>('input[type="password"]')!;
		expect(password.getAttribute('autocomplete')).toBe('current-password');
		expect(document.activeElement).toBe(password);
		expect(buttonIn(dialog(), 'Next')!.disabled).toBe(true);

		await userEvent.type(password, 'pw');
		await userEvent.keyboard('{Enter}');
		await flushPromises();

		expect(state.api.begin).toHaveBeenCalledWith('pw');
		const name = dialog()!.querySelector<HTMLInputElement>('input[name="passkey-name"]')!;
		expect(name.value).toMatch(/^Passkey on /);
		expect(await seriousViolations(dialog()!)).toEqual([]);

		await userEvent.clear(name);
		await userEvent.type(name, 'My Mac');
		buttonIn(dialog(), 'Save')!.click();
		await flushPromises();

		expect(state.api.save).toHaveBeenCalledWith({ id: 'cred' }, 'My Mac');
		expect(dialog()).toBeNull();
		expect(card()!.textContent).toContain('My Mac');
		expect(card()!.textContent).toContain('Never used');
	});

	test('add: a cancelled browser dialog closes quietly; an API error shows in the dialog', async () => {
		mountCard();
		await flushPromises();

		state.api.begin.mockResolvedValueOnce(null);
		buttonIn(card(), 'Add passkey')!.click();
		await flushPromises();
		await userEvent.type(dialog()!.querySelector('input')!, 'pw{Enter}');
		await flushPromises();
		expect(dialog()).toBeNull();

		state.api.begin.mockRejectedValueOnce({ errors: [{ extensions: { code: 'INVALID_CREDENTIALS' } }] });
		buttonIn(card(), 'Add passkey')!.click();
		await flushPromises();
		await userEvent.type(dialog()!.querySelector('input')!, 'bad{Enter}');
		await flushPromises();
		expect(dialog()!.querySelector('[role="alert"]')!.textContent).toMatch(/wrong|invalid/i);
	});

	test('rename from the row menu; delete with the confirmation, Cancel first, focus back on the trigger', async () => {
		mountCard();
		await flushPromises();
		state.api.passkeys.value = [passkey('a', 'Laptop')];
		await flushPromises();

		const trigger = card()!.querySelector<HTMLButtonElement>('button[aria-label="Passkey actions: Laptop"]')!;
		trigger.focus();
		await userEvent.keyboard('{Enter}');
		await flushPromises();
		(document.querySelector('[role="menuitem"]') as HTMLElement).click();
		await flushPromises();

		const rename = dialog()!.querySelector<HTMLInputElement>('input[name="passkey-rename"]')!;
		await userEvent.clear(rename);
		await userEvent.type(rename, 'Work{Enter}');
		await flushPromises();
		expect(state.api.rename).toHaveBeenCalledWith('a', 'Work');

		trigger.focus();
		await userEvent.keyboard('{Enter}');
		await flushPromises();
		(document.querySelectorAll('[role="menuitem"]')[1] as HTMLElement).click();
		await flushPromises();

		const actions = [...dialog()!.querySelectorAll('button')].map((b) => b.textContent?.trim());
		expect(actions.indexOf('Cancel')).toBeLessThan(actions.indexOf('Delete'));
		expect(dialog()!.textContent).toContain('Delete "Work"?');

		buttonIn(dialog(), 'Cancel')!.click();
		await flushPromises();
		await new Promise((resolve) => setTimeout(resolve, 50));
		// D-197: a dialog opened from a menu item gives the focus back to the menu trigger.
		expect(document.activeElement).toBe(trigger);

		trigger.focus();
		await userEvent.keyboard('{Enter}');
		await flushPromises();
		(document.querySelectorAll('[role="menuitem"]')[1] as HTMLElement).click();
		await flushPromises();
		buttonIn(dialog(), 'Delete')!.click();
		await flushPromises();
		expect(state.api.remove).toHaveBeenCalledWith('a');
		expect(dialog()).toBeNull();
	});

	test('at ten passkeys the add button is disabled with the reason', async () => {
		mountCard();
		await flushPromises();
		state.api.passkeys.value = Array.from({ length: 10 }, (_, i) => passkey(`p${i}`));
		await flushPromises();

		const add = buttonIn(card(), 'Add passkey')!;
		expect(add.disabled).toBe(true);
		expect(document.getElementById(add.getAttribute('aria-describedby')!)!.textContent).toContain('up to 10');
	});
});

describe('another user, admin (US3)', () => {
	test('list with a named delete button only, the admin text in the confirmation; no add, no menu', async () => {
		useUserStore().currentUser = { id: 'me', admin_access: true } as unknown as AppUser;
		mountCard({ userId: 'other', isCurrentUser: false });
		await flushPromises();
		state.api.passkeys.value = [passkey('x', 'Phone')];
		await flushPromises();

		expect(buttonIn(card(), 'Add passkey')).toBeUndefined();
		expect(card()!.querySelector('button[aria-label^="Passkey actions"]')).toBeNull();

		card()!.querySelector<HTMLButtonElement>('button[aria-label="Delete passkey: Phone"]')!.click();
		await flushPromises();
		expect(dialog()!.textContent).toContain('The user will have to add a new passkey');
		expect(await seriousViolations(dialog()!)).toEqual([]);

		buttonIn(dialog(), 'Delete')!.click();
		await flushPromises();
		expect(state.api.remove).toHaveBeenCalledWith('x');
	});
});
