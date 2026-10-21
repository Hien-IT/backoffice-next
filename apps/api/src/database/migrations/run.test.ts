// Ported from directus/api/src/database/migrations/run.test.ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Knex } from 'knex';
import knex from 'knex';
import { createTracker, MockClient, Tracker } from 'knex-mock-client';
import type { MockedFunction } from 'vitest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIRECTUS_MIGRATIONS } from './directus-11.17.4.js';
import run from './run.js';

// Backoffice (spec 021 T040): env, cache and logger are mocked so the custom migration cases below can set
// MIGRATIONS_PATH and count the cache flushes; the ported cases above see no custom migration folder.
const { env, flushCaches, logger } = vi.hoisted(() => ({
	env: { MIGRATIONS_PATH: '/nonexistent/backoffice-migrations' } as Record<string, unknown>,
	flushCaches: vi.fn(),
	logger: { info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@backoffice/env', () => ({ useEnv: () => env }));
vi.mock('../../cache.js', () => ({ flushCaches }));
vi.mock('../../logger/index.js', () => ({ useLogger: () => logger }));

describe('run', () => {
	let db: MockedFunction<Knex>;
	let tracker: Tracker;

	beforeAll(() => {
		db = vi.mocked(knex.default({ client: MockClient }));
		tracker = createTracker(db);
	});

	afterEach(() => {
		tracker.reset();
	});

	describe('when passed the argument up', () => {
		it('returns "Nothing To Upgrade" if no directus_migrations', async () => {
			tracker.on.select('directus_migrations').response(['Empty']);

			await run(db, 'up').catch((e: Error) => {
				expect(e).toBeInstanceOf(Error);
				expect(e.message).toBe('Nothing to upgrade');
			});
		});

		it('returns "Method implemented in the dialect driver" if no directus_migrations', async () => {
			tracker.on.select('directus_migrations').response([]);

			await run(db, 'up').catch((e: Error) => {
				expect(e).toBeInstanceOf(Error);
				expect(e.message).toBe('Method implemented in the dialect driver');
			});
		});

		it('returns undefined if the migration is successful', async () => {
			tracker.on.select('directus_migrations').response([
				{
					version: '20201028A',
					name: 'Remove Collection Foreign Keys',
					timestamp: '2021-11-27 11:36:56.471595-05',
				},
			]);

			tracker.on.delete('directus_relations').response([]);
			tracker.on.insert('directus_migrations').response(['Remove System Relations', '20201029A']);

			expect(await run(db, 'up')).toBe(undefined);
		});
	});

	describe('when passed the argument down', () => {
		it('returns "Nothing To downgrade" if no valid directus_migrations', async () => {
			tracker.on.select('directus_migrations').response(['Empty']);

			await run(db, 'down').catch((e: Error) => {
				expect(e).toBeInstanceOf(Error);
				expect(e.message).toBe(`Couldn't find migration`);
			});
		});

		it('returns "Method implemented in the dialect driver" if no directus_migrations', async () => {
			tracker.on.select('directus_migrations').response([]);

			await run(db, 'down').catch((e: Error) => {
				expect(e).toBeInstanceOf(Error);
				expect(e.message).toBe('Nothing to downgrade');
			});
		});

		it(`returns "Couldn't find migration" if an invalid migration object is supplied`, async () => {
			tracker.on.select('directus_migrations').response([
				{
					version: '202018129A',
					name: 'Fake Migration',
					timestamp: '2020-00-32 11:36:56.471595-05',
				},
			]);

			await run(db, 'down').catch((e: Error) => {
				expect(e).toBeInstanceOf(Error);
				expect(e.message).toBe(`Couldn't find migration`);
			});
		});
	});

	describe('when passed the argument latest', () => {
		it('returns "Nothing To downgrade" if no valid directus_migrations', async () => {
			tracker.on.select('directus_migrations').response(['Empty']);

			await run(db, 'latest').catch((e: Error) => {
				expect(e).toBeInstanceOf(Error);
				expect(e.message).toBe(`Method implemented in the dialect driver`);
			});
		});

		it('returns "Method implemented in the dialect driver" if no directus_migrations', async () => {
			tracker.on.select('directus_migrations').response([]);

			await run(db, 'latest').catch((e: Error) => {
				expect(e).toBeInstanceOf(Error);
				expect(e.message).toBe('Method implemented in the dialect driver');
			});
		});
	});

	describe('custom migrations in MIGRATIONS_PATH (spec 021 FR-020, FR-021, FR-027)', () => {
		const ran = () => (globalThis as any).__boMigrationsRan as string[];
		let dir: string;

		beforeAll(() => {
			dir = mkdtempSync(join(tmpdir(), 'bo-migrations-'));
			const up = (name: string) => `export async function up() { globalThis.__boMigrationsRan.push('${name}'); }\n`;

			writeFileSync(join(dir, '20990101A-first-custom.js'), up('js'));
			writeFileSync(join(dir, '20990102A-second.mjs'), up('mjs'));
			writeFileSync(
				join(dir, '20990103A-third.cjs'),
				`exports.up = async () => { globalThis.__boMigrationsRan.push('cjs'); };\n`,
			);
			writeFileSync(join(dir, '20990104A-skipped.ts'), up('ts'));
			writeFileSync(join(dir, 'helpers.js'), up('no dash'));
			env['MIGRATIONS_PATH'] = dir;
		});

		beforeEach(() => {
			flushCaches.mockClear();
			logger.info.mockClear();
		});

		afterAll(() => {
			env['MIGRATIONS_PATH'] = '/nonexistent/backoffice-migrations';
			rmSync(dir, { recursive: true, force: true });
		});

		it('latest applies the .js, .mjs and .cjs files with a "-" in version order, then flushes the caches once', async () => {
			(globalThis as any).__boMigrationsRan = [];
			tracker.on.select('directus_migrations').response(DIRECTUS_MIGRATIONS.map((version) => ({ version })));
			tracker.on.insert('directus_migrations').response([]);

			await run(db, 'latest');

			expect(ran()).toEqual(['js', 'mjs', 'cjs']);
			expect(logger.info.mock.calls.map((call) => call[0])).toEqual([
				'Applying First Custom...',
				'Applying Second...',
				'Applying Third...',
			]);
			expect(tracker.history.insert.map((query) => query.bindings)).toEqual([
				['First Custom', '20990101A'],
				['Second', '20990102A'],
				['Third', '20990103A'],
			]);
			expect(flushCaches).toHaveBeenCalledOnce();
			expect(flushCaches).toHaveBeenCalledWith(true);
		});

		it('latest with every migration completed applies nothing and does not flush the caches', async () => {
			(globalThis as any).__boMigrationsRan = [];
			tracker.on
				.select('directus_migrations')
				.response([...DIRECTUS_MIGRATIONS, '20990101A', '20990102A', '20990103A'].map((version) => ({ version })));

			await run(db, 'latest');

			expect(ran()).toEqual([]);
			expect(flushCaches).not.toHaveBeenCalled();
		});
	});
});
