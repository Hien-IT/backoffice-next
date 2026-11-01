// Backoffice (spec 029, D-207.5): the shared response cache is skipped for the globals of a passkey session only.
import type { Request, Response } from 'express';
import { beforeEach, expect, test, vi } from 'vitest';
import getDatabase from '../database/index.js';
import passkeySessionCacheGuard from './passkey-session-cache-guard.js';

vi.mock('../database/index.js', () => ({ default: vi.fn() }));

const first = vi.fn();
const where = vi.fn(() => ({ first }));

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getDatabase).mockReturnValue({ select: () => ({ from: () => ({ where }) }) } as any);
});

async function run(req: Partial<Request>) {
	const res = { locals: {} } as Response;
	const next = vi.fn();
	await passkeySessionCacheGuard(req as Request, res, next);
	expect(next).toHaveBeenCalledOnce();
	return res.locals;
}

const globals = (session?: string) => ({
	originalUrl: '/policies/me/globals',
	accountability: (session ? { session } : {}) as any,
	query: {},
});

test('a passkey session asking for the globals: no cache read, no cache write', async () => {
	first.mockResolvedValueOnce({ bo_passkey: true });

	expect(await run(globals('token'))).toEqual({ skipCacheRead: true, cache: false });
	expect(where).toHaveBeenCalledWith({ token: 'token' });
});

test('a password session (bo_passkey null) keeps the cache', async () => {
	first.mockResolvedValueOnce({ bo_passkey: null });
	expect(await run(globals('token'))).toEqual({});
});

test('no session (JSON or static token) and other paths: no lookup', async () => {
	expect(await run(globals())).toEqual({});
	expect(await run({ originalUrl: '/users/me', accountability: { session: 't' } as any, query: {} })).toEqual({});
	expect(where).not.toHaveBeenCalled();
});

test('GraphQL system documents with policies_me_globals are checked, others are not', async () => {
	first.mockResolvedValueOnce({ bo_passkey: 1 });

	const gql = (query: string) => ({
		originalUrl: '/graphql/system',
		method: 'POST',
		body: { query },
		accountability: { session: 't' } as any,
		query: {},
	});

	expect(await run(gql('{ policies_me_globals { enforce_tfa } }'))).toEqual({ skipCacheRead: true, cache: false });
	expect(await run(gql('{ users_me { id } }'))).toEqual({});
	expect(where).toHaveBeenCalledOnce();
});
