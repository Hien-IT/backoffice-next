// Backoffice (spec 030, D-210, research R4): the in-process job that builds one index after POST answered 202. Its
// state lives in the row of backoffice_indexes (creating → ready | failed), so any replica reads it; the Set below
// only lets a SIGTERM on this replica mark the rows failed before the pool closes (server.ts). No queue, no retry:
// a replica that dies without SIGTERM leaves `creating`, which GET reads as failed after an hour (FR-009).
import type { Knex } from 'knex';
import { setTimeout as sleep } from 'node:timers/promises';
import { useLogger } from '../../logger/index.js';
import type { SchemaHelper } from '../../database/helpers/schema/types.js';

export type IndexType = 'btree' | 'trigram';
export type IndexStatus = 'creating' | 'ready' | 'failed';

export interface IndexRow {
	id: string;
	collection: string;
	name: string;
	fields: string[];
	type: IndexType;
	unique: boolean;
	status: IndexStatus;
	error: string | null;
	date_created: string;
}

export interface JobContext {
	knex: Knex;
	client: string;
	helpers: SchemaHelper;
	/** The ItemsService update of the row, so activity and revisions are written like any system collection. */
	updateOne: (id: string, data: { status: IndexStatus; error: string | null }) => Promise<unknown>;
	attemptConcurrentIndex: boolean;
}

export const PG_TRGM_HINT = 'pg_trgm is not installed; ask a DBA to run: CREATE EXTENSION pg_trgm';
const SHUTDOWN_ERROR = 'Server shutdown';
const SHUTDOWN_MARK_TIMEOUT = 400;

/** The jobs of this process; `Promise.all([...running])` waits for them (tests). */
export const running = new Set<Promise<void>>();
const active = new Map<Promise<void>, { row: IndexRow; ctx: JobContext; stopped: boolean }>();

export function runIndexJob(row: IndexRow, ctx: JobContext): Promise<void> {
	const logger = useLogger();
	const entry = { row, ctx, stopped: false };

	const run = async () => {
		logger.info(`[indexes] building ${row.name} on ${row.collection}`);

		try {
			if (row.type === 'trigram' && ctx.client === 'postgres') {
				await ctx.knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');
			}

			await ctx.helpers.createIndex(row.collection, row.fields, {
				unique: row.unique,
				type: row.type,
				attemptConcurrentIndex: ctx.attemptConcurrentIndex,
			});

			if (!entry.stopped) await ctx.updateOne(row.id, { status: 'ready', error: null });
			logger.info(`[indexes] ${row.name} ready`);
		} catch (err: any) {
			const error = failureMessage(err, row);
			logger.warn(`[indexes] ${row.name} failed: ${error}`);

			// A failed CREATE INDEX CONCURRENTLY leaves an INVALID index behind on Postgres.
			if (ctx.client === 'postgres') {
				await ctx.helpers.dropIndex(row.collection, row.name).catch(() => undefined);
			}

			if (!entry.stopped) await ctx.updateOne(row.id, { status: 'failed', error }).catch(() => undefined);
		}
	};

	const promise: Promise<void> = run().finally(() => {
		running.delete(promise);
		active.delete(promise);
	});

	running.add(promise);
	active.set(promise, entry);
	return promise;
}

/** Called on SIGTERM before the database pool closes: marks the rows, never waits for the DDL. */
export async function failRunningIndexJobs(): Promise<void> {
	const marks: Promise<unknown>[] = [];

	for (const entry of active.values()) {
		entry.stopped = true;
		marks.push(entry.ctx.updateOne(entry.row.id, { status: 'failed', error: SHUTDOWN_ERROR }).catch(() => undefined));
	}

	await Promise.race([Promise.all(marks), sleep(SHUTDOWN_MARK_TIMEOUT)]);
}

function failureMessage(err: any, row: IndexRow): string {
	if (row.type === 'trigram' && err?.code === '42501') return PG_TRGM_HINT;
	const message = typeof err?.message === 'string' && err.message ? err.message : String(err);
	return message.slice(0, 1000);
}
