// Backoffice (spec 029, T031): the requests of the Passkeys card.
import { startRegistration } from '@simplewebauthn/browser';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { isPasskeyCancel, MAX_PASSKEYS, usePasskeys } from './use-passkeys.ts';

vi.mock('@simplewebauthn/browser', () => ({ startRegistration: vi.fn() }));

vi.mock('../api/sdk.ts', () => ({
	sdk: { request: vi.fn() },
	requestEndpoint: vi.fn((path: string, options: Record<string, unknown>) => ({ path, ...options })),
}));

const passkey = (id: string, name = id) => ({
	id,
	name,
	date_created: '2026-11-01T09:00:00.000Z',
	last_used: null,
	device_type: 'singleDevice',
	backed_up: false,
	transports: ['internal'],
});

const sent = () => vi.mocked(requestEndpoint).mock.calls.map(([path, options]) => `${options?.method} ${path}`);

beforeEach(() => {
	vi.mocked(sdk.request).mockReset();
});

afterEach(() => {
	vi.clearAllMocks();
});

test('own passkeys: list, add in two steps, rename, delete', async () => {
	const own = usePasskeys('u1', true);

	vi.mocked(sdk.request).mockResolvedValueOnce([passkey('a')]);
	await own.load();
	expect(own.passkeys.value.map((p) => p.id)).toEqual(['a']);

	vi.mocked(sdk.request).mockResolvedValueOnce({ challenge: 'c' });
	vi.mocked(startRegistration).mockResolvedValueOnce({ id: 'cred' } as any);
	const response = await own.begin('pw');
	expect(response).toEqual({ id: 'cred' });
	expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: { challenge: 'c' } });
	expect(vi.mocked(requestEndpoint).mock.calls[1]![1]).toMatchObject({ body: { password: 'pw' } });

	vi.mocked(sdk.request).mockResolvedValueOnce(passkey('b', 'Mac'));
	await own.save(response!, 'Mac');
	expect(vi.mocked(requestEndpoint).mock.calls[2]![1]).toMatchObject({
		body: { response: { id: 'cred' }, name: 'Mac' },
	});

	vi.mocked(sdk.request).mockResolvedValueOnce(passkey('b', 'Work'));
	await own.rename('b', 'Work');
	expect(own.passkeys.value.map((p) => p.name)).toEqual(['a', 'Work']);

	vi.mocked(sdk.request).mockResolvedValueOnce(undefined);
	await own.remove('a');
	expect(own.passkeys.value.map((p) => p.id)).toEqual(['b']);

	expect(sent()).toEqual([
		'GET /backoffice/users/me/passkeys',
		'POST /backoffice/users/me/passkeys/options',
		'POST /backoffice/users/me/passkeys',
		'PATCH /backoffice/users/me/passkeys/b',
		'DELETE /backoffice/users/me/passkeys/a',
	]);
});

test('a cancelled browser dialog resolves null; an API error throws', async () => {
	const own = usePasskeys('u1', true);

	vi.mocked(sdk.request).mockResolvedValueOnce({ challenge: 'c' });
	vi.mocked(startRegistration).mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
	await expect(own.begin('pw')).resolves.toBeNull();

	vi.mocked(sdk.request).mockRejectedValueOnce({ errors: [{ extensions: { code: 'INVALID_CREDENTIALS' } }] });
	await expect(own.begin('bad')).rejects.toMatchObject({ errors: [{ extensions: { code: 'INVALID_CREDENTIALS' } }] });
});

test('another user (admin): list and delete under /backoffice/users/:pk/passkeys', async () => {
	const other = usePasskeys('u2', false);

	vi.mocked(sdk.request)
		.mockResolvedValueOnce([passkey('x')])
		.mockResolvedValueOnce(undefined);
	await other.load();
	await other.remove('x');

	expect(sent()).toEqual(['GET /backoffice/users/u2/passkeys', 'DELETE /backoffice/users/u2/passkeys/x']);
	expect(other.passkeys.value).toEqual([]);
});

test('at the limit of ten; load errors are kept, not thrown', async () => {
	const own = usePasskeys('u1', true);

	vi.mocked(sdk.request).mockResolvedValueOnce(Array.from({ length: MAX_PASSKEYS }, (_, i) => passkey(`p${i}`)));
	await own.load();
	expect(own.atLimit.value).toBe(true);

	vi.mocked(sdk.request).mockRejectedValueOnce(new Error('down'));
	await own.load();
	expect(own.error.value).toBeInstanceOf(Error);
});

test('isPasskeyCancel', () => {
	expect(isPasskeyCancel({ name: 'NotAllowedError' })).toBe(true);
	expect(isPasskeyCancel({ name: 'AbortError' })).toBe(true);
	expect(isPasskeyCancel({ name: 'InvalidStateError' })).toBe(false);
	expect(isPasskeyCancel(null)).toBe(false);
});
