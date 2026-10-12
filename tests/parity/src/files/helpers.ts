// Feature 007 (research R8): shared helpers of the files, folders and assets parity files. Uploads create rows with
// random ids and times at each app, so write flows run as scenarios (Directus, then Backoffice) and their transcripts
// are compared after the ids become placeholders.
import { readFileSync } from 'node:fs';
import type { App } from '../auth/fixtures.js';
import { alias, type ScenarioContext, send, snapshotOf, type Snapshot } from '../auth/scenario.js';
import { adminToken } from '../directus-api.js';
import type { Captured, ParityRequest } from '../parity.js';

export type { App };

export const fixture = (name: string): Buffer => readFileSync(new URL(`../../fixtures/files/${name}`, import.meta.url));

export const assetFixture = (name: string): Buffer =>
	readFileSync(new URL(`../../fixtures/assets/${name}`, import.meta.url));

export type Part =
	| { name: string; value: string }
	| { name: string; data: Buffer; filename?: string | undefined; contentType?: string };

const BOUNDARY = 'parity-files-boundary-0f3a';

/** A multipart/form-data body with a fixed boundary, so both apps receive the same bytes. */
export function multipart(parts: Part[]): { body: Buffer; headers: Record<string, string> } {
	const chunks: Buffer[] = [];

	for (const part of parts) {
		let head = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${part.name}"`;

		if ('data' in part) {
			if (part.filename !== undefined) head += `; filename="${part.filename}"`;
			head += `\r\nContent-Type: ${part.contentType ?? 'application/octet-stream'}`;
			chunks.push(Buffer.from(`${head}\r\n\r\n`), part.data, Buffer.from('\r\n'));
		} else {
			chunks.push(Buffer.from(`${head}\r\n\r\n${part.value}\r\n`));
		}
	}

	chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));

	return {
		body: Buffer.concat(chunks),
		headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
	};
}

/** `Authorization` header of the admin, issued by Directus (same SECRET, valid at both apps). */
export async function admin(): Promise<Record<string, string>> {
	return { authorization: `Bearer ${await adminToken('directus')}` };
}

/** Sends a request of a scenario step (Host of Directus at both apps, like the other scenario files). */
export function call(ctx: ScenarioContext, req: ParityRequest): Promise<Captured> {
	return send(ctx.url, req, ctx.host);
}

/** Ids in `data` of a files or folders response: one object, an array, or none. */
export function idsOf(captured: Captured): string[] {
	const data = (captured.json as { data?: unknown } | undefined)?.data;
	if (Array.isArray(data)) return data.map((row) => (row as { id: string }).id);
	if (data && typeof data === 'object' && 'id' in data) return [(data as { id: string }).id];
	return [];
}

const TIMES = new Set(['created_on', 'modified_on', 'uploaded_on', 'timestamp', 'date_created', 'date_updated']);

/** Times of the rows an app writes differ between the two runs: keep only whether they are set. */
export function withoutTimes<T>(value: T, key?: string): T {
	if (key !== undefined && TIMES.has(key)) return (value === null ? null : '<time>') as T;
	if (Array.isArray(value)) return value.map((item) => withoutTimes(item)) as T;

	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutTimes(v, k)])) as T;
	}

	return value;
}

/**
 * Snapshot of a response for a transcript: compared headers and body like parity(), the ids of this run replaced by
 * `<name>` placeholders, times reduced to `<time>`. ETag and Last-Modified follow modified_on of each run's row.
 */
export function snap(captured: Captured, path: string, ids: Record<string, string> = {}): Snapshot {
	const snapshot = snapshotOf(path, captured);
	const placeholders = Object.fromEntries(Object.entries(ids).map(([name, id]) => [id, `<${name}>`]));
	return withoutTimes(alias(snapshot, placeholders));
}
