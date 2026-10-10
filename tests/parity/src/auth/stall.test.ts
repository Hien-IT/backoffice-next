// Feature 003, US4.3, FR-040, SC-003: every login answer, failed or not, takes at least LOGIN_STALL_TIME (500 ms by
// default), and "unknown email" cannot be told from "wrong password" by its time. Timings only mean something on CI
// (Directus runs emulated on arm64 machines), so this file runs in the full Postgres suite only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { capture, type ParityRequest } from '../parity.js';
import { parseSuite } from '../suite.js';
import { type App, APPS, cleanupFixtures, createUser, PASSWORD, setSettings, type User, urls } from './fixtures.js';
import { post } from './flows.js';

const STALL_TIME = 500;
const RUNS = 50;

const [vendor] = getDbsToTest();
let active: User;
let suspended: User;
let tfa: User;
let restore: () => Promise<void>;

async function timed(app: App, req: ParityRequest): Promise<{ ms: number; status: number }> {
	const start = performance.now();
	const res = await capture(urls()[app], req);
	return { ms: performance.now() - start, status: res.status };
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

describe.runIf(parseSuite() === 'full' && vendor === 'postgres')('LOGIN_STALL_TIME', () => {
	beforeAll(async () => {
		// Many failures in a row: no suspension during this file.
		restore = await setSettings({ auth_login_attempts: null });
		active = await createUser('stall');
		suspended = await createUser('stall-suspended', { status: 'suspended' });
		tfa = await createUser('stall-tfa', { tfa_secret: 'JBSWY3DPEHPK3PXP' });
	}, 60_000);

	afterAll(async () => {
		await restore();
		await cleanupFixtures();
	}, 60_000);

	it('every branch of FR-040 answers after at least LOGIN_STALL_TIME', async () => {
		const branches: Record<string, ParityRequest> = {
			'unknown email': post('/auth/login', { email: 'nobody-stall@example.com', password: PASSWORD }),
			'wrong password': post('/auth/login', { email: active.email, password: 'wrong' }),
			'invalid payload': post('/auth/login', { email: 'not-an-email', password: PASSWORD }),
			'user not active': post('/auth/login', { email: suspended.email, password: PASSWORD }),
			'missing OTP': post('/auth/login', { email: tfa.email, password: PASSWORD }),
			'wrong OTP': post('/auth/login', { email: tfa.email, password: PASSWORD, otp: '000000' }),
			success: post('/auth/login', { email: active.email, password: PASSWORD }),
		};

		for (const [name, req] of Object.entries(branches)) {
			for (const app of APPS) {
				const { ms } = await timed(app, req);
				expect(ms, `${name} at ${app}`).toBeGreaterThanOrEqual(STALL_TIME);
			}
		}
	}, 60_000);

	it(`unknown email and wrong password: medians of ${RUNS} runs within 50 ms at each app (SC-003)`, async () => {
		for (const app of APPS) {
			const unknown: number[] = [];
			const wrong: number[] = [];

			for (let i = 0; i < RUNS; i++) {
				unknown.push((await timed(app, post('/auth/login', { email: 'nobody-stall@example.com', password: 'x' }))).ms);
				wrong.push((await timed(app, post('/auth/login', { email: active.email, password: 'x' }))).ms);
			}

			expect(Math.abs(median(unknown) - median(wrong)), app).toBeLessThanOrEqual(50);
		}
	}, 300_000);
});
