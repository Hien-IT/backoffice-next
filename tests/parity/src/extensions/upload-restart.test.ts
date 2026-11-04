// Spec 031 (FR-023, D-212.1): Directus started next to a package uploaded at Backoffice, on the extensions pair (own
// storage prefix extensions-ext, one database with the main pair; the main pair is never restarted). Directus keeps the
// row of source `upload`, writes no row of its own for the folder (it never scans the hidden .upload folder), logs no
// error about it, answers 404 on its endpoint and lists it with `schema: null`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { profilePorts } from '../config.js';
import { compose } from '../docker.js';
import { admin, containerLog, extRows, mc, waitAll } from './helpers.js';

const full = process.env['PARITY_SUITE'] !== 'reduced';
const DIRECTUS = `http://127.0.0.1:${profilePorts.extensions.directus}`;
const BACKOFFICE = `http://127.0.0.1:${profilePorts.extensions.backoffice}`;
const FIXTURE = fileURLToPath(
	new URL('../../../fixtures/extensions/parity-upload-endpoint/parity-upload-endpoint-1.0.0.tgz', import.meta.url),
);

let id: string | undefined;

afterAll(async () => {
	if (id) {
		await fetch(`${BACKOFFICE}/extensions/registry/uninstall/${id}`, { method: 'DELETE', headers: await admin() });
		mc(`mc rm --recursive --force local/directus/extensions-ext/.upload/${id} || true`);
	}
	await closeHostDb();
}, 120_000);

describe.runIf(full)('Directus restarted next to an uploaded package (D-212.1)', () => {
	it('keeps the row, writes none, logs no error about it, never runs it', async () => {
		const form = new FormData();
		form.append('file', new Blob([new Uint8Array(readFileSync(FIXTURE))]), 'parity-upload-endpoint-1.0.0.tgz');
		const res = await fetch(`${BACKOFFICE}/backoffice/extensions/upload`, {
			method: 'POST',
			headers: await admin(),
			body: form,
		});
		const body = (await res.json()) as { data: { id: string } };
		expect(res.status, JSON.stringify(body)).toBe(200);
		id = body.data.id as string;

		await waitAll(async () => {
			const endpoint = await fetch(`${BACKOFFICE}/parity-upload-endpoint`);
			if (endpoint.status !== 200) throw new Error(`backoffice-api-extensions: ${endpoint.status}`);
		}, 30_000);

		const rowsBefore = await extRows();
		const since = new Date();

		compose('up', '-d', '--wait', '--force-recreate', '--no-deps', 'directus-extensions');

		await waitAll(async () => {
			const ping = await fetch(`${DIRECTUS}/server/ping`);
			if (ping.status !== 200) throw new Error(`directus-extensions: ${ping.status}`);
		}, 120_000);

		const log = containerLog('directus-extensions', since);
		expect(log).not.toContain(id);
		expect(log).not.toContain('parity-upload-endpoint');
		expect(log).not.toContain('NoSuchKey');

		const rowsAfter = await extRows();
		expect(rowsAfter).toEqual(rowsBefore);
		expect(rowsAfter.filter((row) => row.folder === id)).toEqual([
			{ id, enabled: true, folder: id, source: 'upload', bundle: null },
		]);

		expect((await fetch(`${DIRECTUS}/parity-upload-endpoint`)).status).toBe(404);

		const list = await fetch(`${DIRECTUS}/extensions`, { headers: await admin() });
		const rows = ((await list.json()) as { data: { id: string; schema: unknown }[] }).data;
		expect(rows.find((row) => row.id === id)).toMatchObject({ schema: null });

		// Backoffice still serves it after Directus came back.
		expect((await fetch(`${BACKOFFICE}/parity-upload-endpoint`)).status).toBe(200);
	}, 300_000);
});
