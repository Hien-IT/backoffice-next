import knex, { type Knex } from 'knex';
import { createTracker, MockClient, type Tracker } from 'knex-mock-client';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import getDatabase from '../database/index.js';
import { verifySessionJWT } from './verify-session-jwt.js';

vi.mock('../database/index.js');

let db: Knex;
let tracker: Tracker;

beforeAll(() => {
	db = knex.default({ client: MockClient });
	tracker = createTracker(db);
	vi.mocked(getDatabase).mockReturnValue(db);
});

afterEach(() => tracker.reset());

describe('verifySessionJWT', () => {
	test('looks up the session with its user and share (null when absent) and an expiry in the future', async () => {
		tracker.on.select('directus_sessions').response({ 1: 1 });
		await verifySessionJWT({ id: 'u', role: null, app_access: true, admin_access: false, session: 's' });

		const query = tracker.history.select[0]!;
		expect(query.sql).toBe(
			'select 1 from "directus_sessions" where "token" = ? and "user" = ? and "share" is null and "expires" >= ? limit ?',
		);
		expect(query.bindings.slice(0, 2)).toEqual(['s', 'u']);
	});

	test('throws INVALID_CREDENTIALS when the session is gone', async () => {
		tracker.on.select('directus_sessions').response(undefined);

		await expect(
			verifySessionJWT({ share: 'sh', role: null, app_access: false, admin_access: false, session: 's' }),
		).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
	});
});
