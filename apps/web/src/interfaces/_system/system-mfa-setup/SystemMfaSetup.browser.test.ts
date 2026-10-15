// Feature 015 (T071, FR-082, CHK022, CHK084): system-mfa-setup in chromium (dialog focus, autofocus) with a mocked
// use-tfa-setup: the password, SSO and admin flows, the 6-digit OTP rule, the cancel of a pending SSO setup.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick, ref, type Ref } from 'vue';
import { useTFASetup } from '../../../composables/use-tfa-setup.ts';
import { i18n } from '../../../lang/index.ts';
import '../../../styles/index.css';
import { useUserStore } from '../../../stores/user.ts';
import type { AppUser } from '../../../types/user.ts';
import SystemMfaSetup from './SystemMfaSetup.vue';

type Tfa = ReturnType<typeof useTFASetup>;

const QR = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

let tfa: Tfa;

vi.mock('../../../composables/use-tfa-setup.ts', async () => {
	const { ref } = await import('vue');

	return {
		useTFASetup: vi.fn((initialEnabled: boolean) => {
			const state = {
				loading: ref(false),
				password: ref(''),
				tfaEnabled: ref(initialEnabled),
				tfaGenerated: ref(false),
				secret: ref<string>(),
				otp: ref(''),
				error: ref<any>(null),
				qrCode: ref<string>(),
				requireTfaSetup: ref<string | null>(null),
			};

			tfa = {
				...state,
				generateTFA: vi.fn(async () => {
					state.secret.value = 'JBSWY3DPEHPK3PXP';
					state.qrCode.value = QR;
					state.tfaGenerated.value = true;
				}),
				enableTFA: vi.fn(async () => true),
				disableTFA: vi.fn(async () => true),
				adminDisableTFA: vi.fn(async () => true),
				requestTFASetup: vi.fn(async () => true),
				cancelTFASetup: vi.fn(async () => true),
			} as unknown as Tfa;

			return tfa;
		}),
	};
});

enableAutoUnmount(afterEach);

const ME = { id: 'me', provider: 'default', tfa_secret: null };

function signIn(user: Partial<AppUser>) {
	useUserStore().currentUser = { ...ME, ...user } as unknown as AppUser;
}

function mountMfa(props: Record<string, unknown>, values: Ref<Record<string, unknown>> = ref({})) {
	const discardAllChanges = vi.fn();
	const wrapper = mount(SystemMfaSetup, {
		props: { value: null, primaryKey: 'me', ...props },
		global: { plugins: [i18n], provide: { values, discardAllChanges } },
		attachTo: document.body,
	});

	return { wrapper, discardAllChanges };
}

const checkbox = () => document.querySelector<HTMLButtonElement>('[role="checkbox"]')!;
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const button = (text: string) =>
	[...(dialog()?.querySelectorAll('button') ?? [])].find((el) => el.textContent?.trim() === text)!;

async function open() {
	checkbox().click();
	await vi.waitFor(() => expect(dialog()).not.toBeNull());
}

beforeEach(() => setActivePinia(createPinia()));

describe('system-mfa-setup', () => {
	test('password user: password step, then the QR step with the OTP focused and Done enabled at 6 digits', async () => {
		signIn({});
		mountMfa({});

		expect(checkbox().getAttribute('aria-checked')).toBe('false');
		expect(document.body.textContent).toContain('Disabled');

		await open();
		expect(dialog()!.textContent).toContain('Enter your password to enable Two-Factor Authentication');
		const password = dialog()!.querySelector<HTMLInputElement>('input[type="password"]')!;
		await vi.waitFor(() => expect(document.activeElement).toBe(password));

		await userEvent.type(password, 'secret');
		button('Next').click();
		await vi.waitFor(() => expect(tfa.generateTFA).toHaveBeenCalledWith(true));
		expect(tfa.password.value).toBe('secret');

		await vi.waitFor(() => expect(dialog()!.querySelector('img')?.getAttribute('src')).toBe(QR));
		expect(dialog()!.textContent).toContain('Scan the code in your authenticator app');
		expect(dialog()!.querySelector('[data-testid="tfa-secret"]')!.textContent).toBe('JBSWY3DPEHPK3PXP');
		const otp = dialog()!.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
		await vi.waitFor(() => expect(document.activeElement).toBe(otp));

		expect(button('Done').disabled).toBe(true);
		await userEvent.type(otp, '12345');
		expect(button('Done').disabled).toBe(true);
		await userEvent.type(otp, '6');
		expect(button('Done').disabled).toBe(false);

		// Let the button color transition from its disabled look end.
		await new Promise((resolve) => setTimeout(resolve, 300));
		const { violations } = await axe.run(dialog()!, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
		expect(
			violations
				.filter((v) => v.impact === 'serious' || v.impact === 'critical')
				.map((v) => `${v.id}: ${v.nodes.map((n) => n.html + n.failureSummary).join(' | ')}`),
		).toEqual([]);

		button('Done').click();
		await vi.waitFor(() => expect(tfa.enableTFA).toHaveBeenCalledTimes(1));
		await vi.waitFor(() => expect(dialog()).toBeNull());
	});

	test('a failed enable keeps the dialog open and focuses the OTP again', async () => {
		signIn({});
		mountMfa({});
		await open();
		vi.mocked(tfa.enableTFA).mockResolvedValue(false);
		await tfa.generateTFA(true);
		await flushPromises();

		const otp = dialog()!.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
		await userEvent.type(otp, '000000');
		button('Done').focus();
		button('Done').click();
		await vi.waitFor(() => expect(tfa.enableTFA).toHaveBeenCalled());
		await vi.waitFor(() => expect(document.activeElement).toBe(otp));
		expect(dialog()).not.toBeNull();
	});

	test('cancel clears the state and closes', async () => {
		signIn({});
		mountMfa({});
		await open();
		tfa.password.value = 'typed';

		button('Cancel').click();
		await vi.waitFor(() => expect(dialog()).toBeNull());
		expect(tfa.password.value).toBe('');
		expect(tfa.otp.value).toBe('');
	});

	test('SSO user: the logout notice, then discardAllChanges and requestTFASetup', async () => {
		signIn({ provider: 'oidc' });
		const { discardAllChanges } = mountMfa({});

		await open();
		expect(dialog()!.textContent).toContain('You will be logged out of your account');

		button('Enable 2FA').click();
		await vi.waitFor(() => expect(tfa.requestTFASetup).toHaveBeenCalledTimes(1));
		expect(discardAllChanges).toHaveBeenCalledTimes(1);
		expect(tfa.generateTFA).not.toHaveBeenCalled();
	});

	test('SSO user with a pending setup (key in this browser): enabled, and the toggle offers to cancel the setup', async () => {
		signIn({ provider: 'oidc' });
		mountMfa({});
		tfa.requireTfaSetup.value = 'me';
		await nextTick();

		expect(checkbox().getAttribute('aria-checked')).toBe('true');
		await open();
		expect(dialog()!.textContent).toContain('Are you sure you want to cancel the 2FA setup?');

		button('Cancel Setup').click();
		await vi.waitFor(() => expect(tfa.cancelTFASetup).toHaveBeenCalledTimes(1));
		await vi.waitFor(() => expect(dialog()).toBeNull());
	});

	test('own TFA enabled: disable asks for the OTP, Disable 2FA enabled at 6 digits', async () => {
		signIn({ tfa_secret: '**********' });
		mountMfa({ value: '**********' });

		expect(checkbox().getAttribute('aria-checked')).toBe('true');
		await open();
		expect(dialog()!.textContent).toContain('Enter the OTP to disable 2FA');
		const otp = dialog()!.querySelector<HTMLInputElement>('input')!;
		await vi.waitFor(() => expect(document.activeElement).toBe(otp));

		expect(button('Disable 2FA').disabled).toBe(true);
		await userEvent.type(otp, '654321');
		button('Disable 2FA').click();
		await vi.waitFor(() => expect(tfa.disableTFA).toHaveBeenCalledTimes(1));
		expect(tfa.adminDisableTFA).not.toHaveBeenCalled();
	});

	test('admin viewing another user with TFA: the admin text, then adminDisableTFA(pk)', async () => {
		signIn({ admin_access: true });
		mountMfa({ primaryKey: 'other', value: '****' }, ref({ id: 'other', provider: 'default', tfa_secret: '****' }));

		expect(checkbox().disabled).toBe(false);
		await open();
		expect(dialog()!.textContent).toContain('Are you sure you want to disable 2FA for this user?');

		button('Disable 2FA').click();
		await vi.waitFor(() => expect(tfa.adminDisableTFA).toHaveBeenCalledWith('other'));
		expect(tfa.disableTFA).not.toHaveBeenCalled();
	});

	test('another user is read from tfa_secret only, even an SSO user whose id matches the key here (CHK022)', async () => {
		signIn({});
		const values = ref<Record<string, unknown>>({ id: 'other', provider: 'oidc', tfa_secret: null });
		mountMfa({ primaryKey: 'other' }, values);
		tfa.requireTfaSetup.value = 'other';
		await nextTick();

		expect(checkbox().getAttribute('aria-checked')).toBe('false');
		// Not oneself and not enabled: nothing to do here.
		expect(checkbox().disabled).toBe(true);

		values.value = { ...values.value, tfa_secret: '****' };
		await nextTick();
		expect(checkbox().getAttribute('aria-checked')).toBe('true');
		expect(checkbox().disabled).toBe(false);
	});

	test('disabled locks the checkbox', () => {
		signIn({});
		mountMfa({ disabled: true });

		expect(checkbox().disabled).toBe(true);
	});
});
