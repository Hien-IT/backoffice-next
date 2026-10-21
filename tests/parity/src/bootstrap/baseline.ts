// Spec 021 (contracts/tests.md "Baseline"): the state right after both apps of profile bootstrap started on their empty
// databases. cross/cli/partial/init write to those databases and Vitest does not fix the file order, so global-setup
// captures this once per env (env.mjs up removes .data/bootstrap) and schema.test.ts reads only this file.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootstrapRegistryPort } from '../config.js';
import { serviceLogs } from './cli.js';
import { type BootstrapApp, type Dump, bootstrapDb, dump } from './dump.js';

export interface Baseline {
	vendor: string;
	dumps: Record<BootstrapApp, Dump>;
	/** Raw output of the containers (bootstrap, then start). */
	logs: Record<BootstrapApp, string>;
	/** Owner reports registry-bootstrap received (only Directus sends them, D-38). */
	ownerReports: number;
	/** Milliseconds from "Initializing bootstrap..." to "Done" (SC-010), from the pino `time` fields. */
	bootstrapMs: Record<BootstrapApp, number | null>;
}

const FILE = fileURLToPath(new URL('../../.data/bootstrap/baseline.json', import.meta.url));

export const SERVICES: Record<BootstrapApp, string> = {
	directus: 'directus-bootstrap',
	backoffice: 'backoffice-api-bootstrap',
};

function bootstrapMs(output: string): number | null {
	const times = new Map<string, number>();

	for (const line of output.split('\n')) {
		const start = line.indexOf('{');
		if (start === -1) continue;

		try {
			const { msg, time } = JSON.parse(line.slice(start)) as { msg?: string; time?: number };
			if (typeof msg === 'string' && typeof time === 'number' && !times.has(msg)) times.set(msg, time);
		} catch {
			// not a pino line
		}
	}

	const begin = times.get('Initializing bootstrap...');
	const end = times.get('Done');
	return begin !== undefined && end !== undefined ? end - begin : null;
}

/** Captures the baseline unless this env already has one. */
export async function captureBaseline(vendor: string): Promise<void> {
	if (existsSync(FILE)) return;

	const dumps = {} as Record<BootstrapApp, Dump>;
	const logs = {} as Record<BootstrapApp, string>;

	for (const app of ['directus', 'backoffice'] as const) {
		const db = bootstrapDb(vendor, app);

		try {
			dumps[app] = await dump(db);
		} finally {
			await db.destroy();
		}

		logs[app] = serviceLogs(SERVICES[app]);
	}

	const owner = (await (await fetch(`http://127.0.0.1:${bootstrapRegistryPort}/v1/owner`)).json()) as { count: number };

	const baseline: Baseline = {
		vendor,
		dumps,
		logs,
		ownerReports: owner.count,
		bootstrapMs: { directus: bootstrapMs(logs.directus), backoffice: bootstrapMs(logs.backoffice) },
	};

	writeFileSync(FILE, JSON.stringify(baseline));
}

export function readBaseline(): Baseline | undefined {
	return existsSync(FILE) ? (JSON.parse(readFileSync(FILE, 'utf8')) as Baseline) : undefined;
}
