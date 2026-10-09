// Ported from directus/tests/blackbox/utils/await-connection.ts (fetch instead of axios; configurable retries).
import type { Knex } from 'knex';
import { setTimeout as sleep } from 'node:timers/promises';

export async function awaitDatabaseConnection(
	database: Knex,
	checkSQL: string,
	attempts = 30,
	delay = 5000,
): Promise<void | null> {
	for (let attempt = 0; attempt <= attempts; attempt++) {
		try {
			await database.raw(checkSQL);
			return null; // success
		} catch {
			await sleep(delay);
			continue;
		}
	}

	throw new Error(`Couldn't connect to DB`);
}

export async function awaitDirectusConnection(url: string, attempts = 100, delay = 5000): Promise<void | null> {
	for (let attempt = 0; attempt <= attempts; attempt++) {
		try {
			const res = await fetch(new URL('/server/ping', url));
			if (res.ok) return null; // success
		} catch {
			// not up yet
		}

		await sleep(delay);
	}

	throw new Error(`Couldn't connect to Directus`);
}
