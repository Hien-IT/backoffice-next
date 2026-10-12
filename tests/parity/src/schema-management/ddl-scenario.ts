// Feature 006 (research R5, Clarifications): the two apps share one database, so a data model scenario runs in
// sequence with the same names: Directus runs the requests, the database is captured, the model is deleted through
// Directus and the database must be back to its shape; then the new app runs the same requests, is captured, deletes.
// Responses are compared like parity() does, the two captures must be equal (FR-060, SC-002, SC-003).
import type { Knex } from 'knex';
import { expect } from 'vitest';
import { type AppName, adminToken, appRequest, appUrl } from '../directus-api.js';
import { acceptedDifferences } from '../../accepted-differences.js';
import { type Captured, capture, classify, compare, endpointOf, type ParityRequest, report } from '../parity.js';
import { normalizeMetaIds } from '../normalizers.js';
import { captureModel, type ModelCapture, schemaShape } from './ddl-capture.js';

export interface DdlScenarioOptions {
	/** Tables (collections) the scenario creates or changes; their metadata rows are compared too. */
	tables: string[];
	/** Extra clean-up after the collections of `tables` are deleted (fields added to system collections...). */
	cleanup?: (app: AppName) => Promise<void>;
	/** Builds the starting model before each run (through Directus), after the previous run cleaned up. */
	setup?: () => Promise<void>;
}

export interface DdlRun {
	responses: Captured[];
	model: ModelCapture;
}

/**
 * `meta.id` is an auto-increment id; the ETag hashes the body that holds it. FieldsService.readAll and
 * RelationsService.readAll read their metadata rows without ORDER BY (Directus too): the order is the physical order
 * of the rows, which differs between two runs that write different rows, so those lists are sorted.
 */
function normalized(captured: Captured, path: string): Captured {
	let json = captured.isJson ? normalizeMetaIds(captured.json) : captured.json;
	const data = (json as { data?: unknown } | undefined)?.data;

	if (/^\/(fields|relations)(\/[^/?]+)?(\?|$)/.test(path) && Array.isArray(data)) {
		const key = (item: any) => `${item?.collection}.${item?.field}`;
		json = { ...(json as object), data: [...data].sort((a, b) => key(a).localeCompare(key(b))) };
	}

	return {
		...captured,
		json,
		headers: { ...captured.headers, ...(captured.headers['etag'] ? { etag: '<etag>' } : {}) },
	};
}

async function run(db: Knex, app: AppName, steps: ParityRequest[], options: DdlScenarioOptions): Promise<DdlRun> {
	await options.setup?.();
	const before = await schemaShape(db);
	const token = await adminToken(app);
	const responses: Captured[] = [];

	for (const step of steps) {
		responses.push(
			await capture(appUrl(app), { ...step, headers: { authorization: `Bearer ${token}`, ...step.headers } }),
		);
	}

	const model = await captureModel(db, options.tables);

	await cleanupTables(app, options.tables);
	await options.cleanup?.(app);
	await options.setup?.();

	expect(await schemaShape(db), `${app}: the database is back to its shape after the clean-up`).toEqual(before);
	// Removed so the next run builds it again from nothing (same ids order, same snapshot hash).
	if (options.setup) await cleanupTables('directus', options.tables);
	return { responses, model };
}

/** Deletes the user collections of `tables` through `app`, last created first; missing ones are skipped. */
export async function cleanupTables(app: AppName, tables: string[]): Promise<void> {
	for (const table of [...tables].reverse()) {
		if (table.startsWith('directus_')) continue;
		await appRequest(app, 'DELETE', `/collections/${table}`).catch(() => undefined);
	}
}

/** Runs `steps` on Directus then on the new app, in that order on the shared database, and compares both runs. */
export async function ddlScenario(
	db: Knex,
	steps: ParityRequest[],
	options: DdlScenarioOptions,
): Promise<{ directus: DdlRun; backoffice: DdlRun }> {
	await cleanupTables('directus', options.tables);

	const directus = await run(db, 'directus', steps, options);
	const backoffice = await run(db, 'backoffice', steps, options);

	const differences: string[] = [];

	steps.forEach((step, i) => {
		const endpoint = endpointOf(step);
		const d = normalized(directus.responses[i]!, step.path);
		const b = normalized(backoffice.responses[i]!, step.path);
		// Same accepted differences as parity() (D-01 X-Powered-By...).
		const { differences: found } = classify(endpoint, compare(endpoint, d, b), acceptedDifferences, d, b);
		if (found.length > 0) differences.push(`#${i} ${report({ endpoint, differences: found })}`);
	});

	expect(differences, differences.join('\n')).toEqual([]);
	expect(backoffice.model, 'database and metadata left by the new app').toEqual(directus.model);
	return { directus, backoffice };
}
