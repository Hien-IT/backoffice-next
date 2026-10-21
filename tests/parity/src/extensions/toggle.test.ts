// Spec 020 US5 (FR-033 to FR-035, T025): PATCH and DELETE /extensions/:pk run as scenarios, Directus then the new app,
// each restoring the rows after it; the responses and the rows of directus_extensions after each step must match.
// The 422 of an entry of a non partial bundle is covered by apps/api/src/services/extensions.service.test.ts (every
// bundle fixture is partial).
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { type AppName, appUrl } from '../directus-api.js';
import { type Captured, capture, type ParityRequest } from '../parity.js';
import { admin, type ExtensionRow, extRows, same } from './helpers.js';

afterAll(async () => {
	await closeHostDb();
});

const APPS: AppName[] = ['directus', 'backoffice'];

const rowOf = async (folder: string, bundle: string | null = null) =>
	(await extRows()).find((row) => row.folder === folder && row.bundle === bundle)!;

const pick = (rows: ExtensionRow[], ids: string[]) =>
	ids.map((id) => {
		const row = rows.find((r) => r.id === id);
		return row ? { folder: row.folder, enabled: row.enabled } : null;
	});

/** Status and body without the volatile parts (the response holds the row as stored). */
const shape = (captured: Captured) => ({ status: captured.status, json: captured.json ?? null });

async function scenario(steps: ParityRequest[], watched: string[]) {
	const out: Record<AppName, unknown[]> = { directus: [], backoffice: [] };

	for (const app of APPS) {
		for (const step of steps) {
			const captured = await capture(appUrl(app), { ...step, headers: { ...(await admin()), ...step.headers } });
			out[app].push({ response: shape(captured), rows: pick(await extRows(), watched) });
		}
	}

	expect(out.backoffice).toEqual(out.directus);
	return out.directus;
}

const patch = (id: string, enabled: boolean): ParityRequest => ({
	method: 'PATCH',
	path: `/extensions/${id}`,
	headers: { 'content-type': 'application/json' },
	body: { meta: { enabled } },
});

describe('PATCH /extensions/:pk', () => {
	it('disable then enable an extension', async () => {
		const row = await rowOf('parity-display-badge');
		const steps = await scenario([patch(row.id, false), patch(row.id, true)], [row.id]);
		expect(steps[0]).toMatchObject({ rows: [{ enabled: false }] });
		expect(steps[1]).toMatchObject({ rows: [{ enabled: true }] });
	});

	it('a bundle and its entries: the bundle toggles its entries, an entry of a partial bundle toggles alone', async () => {
		const bundle = await rowOf('parity-bundle-tools');
		const entries = (await extRows()).filter((row) => row.bundle === bundle.id);
		const entry = entries.find((row) => row.folder === 'bundle-iface')!;
		const watched = [bundle.id, ...entries.map((row) => row.id)];

		await scenario(
			[patch(bundle.id, false), patch(bundle.id, true), patch(entry.id, false), patch(entry.id, true)],
			watched,
		);
	});

	it('the checks: no meta, not a uuid, an unknown id, not admin', async () => {
		const row = await rowOf('parity-display-badge');
		const headers = { ...(await admin()), 'content-type': 'application/json' };

		await same({ method: 'PATCH', path: `/extensions/${row.id}`, headers, body: {} });
		await same({ method: 'PATCH', path: '/extensions/nope', headers, body: { meta: { enabled: true } } });
		await same({ method: 'PATCH', path: `/extensions/${randomUUID()}`, headers, body: { meta: { enabled: true } } });
		await same({ method: 'PATCH', path: `/extensions/${row.id}`, body: { meta: { enabled: true } } });
	});
});

describe('DELETE /extensions/:pk', () => {
	it('deletes the row and the rows of its bundle entries', async () => {
		const out: Record<AppName, unknown> = { directus: null, backoffice: null };

		for (const app of APPS) {
			const parent = randomUUID();
			const child = randomUUID();

			await hostDb()('directus_extensions').insert([
				{ id: parent, enabled: true, folder: `parity-toggle-${app}`, source: 'local', bundle: null },
				{ id: child, enabled: true, folder: 'entry', source: 'local', bundle: parent },
			]);

			const captured = await capture(appUrl(app), {
				method: 'DELETE',
				path: `/extensions/${parent}`,
				headers: await admin(),
			});
			const left = await hostDb()('directus_extensions').whereIn('id', [parent, child]).count({ n: '*' });
			out[app] = { response: shape(captured), left: Number(left[0]!['n']) };
		}

		expect(out.backoffice).toEqual(out.directus);
		expect(out.directus).toMatchObject({ response: { status: 204 }, left: 0 });
	});
});
