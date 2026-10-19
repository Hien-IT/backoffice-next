// Feature 019, US5 (FR-061): a TUS upload whose chunks go to different instances (3 BE replicas + Directus) completes,
// the stored bytes equal the source and there is one directus_files row; after an instance stops mid-upload, HEAD at
// another one gives the offset and the upload goes on.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { metadata, tus } from '../tus-request.js';
import { adminToken, api, compose, containerName, directusUrl, docker, instanceUrls, SEPARATE } from './instances.js';

// TUS_CHUNK_SIZE default (8mb), as the TUS parity file of 007: an S3 multipart part under 5 MB does not move the offset.
const CHUNK = 8 * 1024 * 1024;
const created: string[] = [];
let urls: string[];
let admin: string;

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const auth = () => ({ authorization: `Bearer ${admin}` });

beforeAll(async () => {
	urls = instanceUrls();
	admin = await adminToken(directusUrl);
});

afterAll(async () => {
	if (created.length) await api(directusUrl, 'DELETE', '/files', { token: admin, body: created });
});

async function upload(
	data: Buffer,
	name: string,
	patchAt: (chunk: number) => string,
	afterChunk?: (chunk: number) => Promise<void>,
) {
	const create = await tus(urls[0]!, 'POST', '/files/tus', {
		...auth(),
		'upload-length': String(data.length),
		'upload-metadata': metadata({ filename_download: name, type: 'application/octet-stream' }),
	});
	expect(create.status).toBe(201);
	// Location carries PUBLIC_URL (the load balancer); each chunk is sent to the chosen instance instead.
	const path = new URL(create.headers['location']!).pathname;

	let offset = 0;
	for (let chunk = 0; offset < data.length; chunk++) {
		const base = patchAt(chunk);
		const head = await tus(base, 'HEAD', path, auth());
		expect(Number(head.headers['upload-offset']), `HEAD at ${base}`).toBe(offset);
		const body = data.subarray(offset, offset + CHUNK);
		const res = await tus(
			base,
			'PATCH',
			path,
			{ ...auth(), 'upload-offset': String(offset), 'content-type': 'application/offset+octet-stream' },
			body,
		);
		expect(res.status, `PATCH ${chunk} at ${base}`).toBe(204);
		const next = Number(res.headers['upload-offset']);
		expect(next, `offset after PATCH ${chunk}`).toBeGreaterThan(offset);
		offset = next;
		await afterChunk?.(chunk);
	}

	const rows = await api(directusUrl, 'GET', `/files?filter[filename_download][_eq]=${name}&fields=id`, {
		token: admin,
	});
	expect(rows.body.data).toHaveLength(1);
	const id = rows.body.data[0].id;
	created.push(id);
	for (const base of [directusUrl, urls[0]!]) {
		const asset = Buffer.from(await (await fetch(`${base}/assets/${id}`, { headers: auth() })).arrayBuffer());
		expect(sha(asset), `asset at ${base}`).toBe(sha(data));
	}
}

describe.skipIf(SEPARATE)('TUS over several instances', () => {
	it('takes each chunk at another instance (Directus included)', async () => {
		const data = randomBytes(4 * CHUNK + CHUNK / 2);
		await upload(data, `deploy-tus-${randomUUID().slice(0, 8)}.bin`, (chunk) => urls[chunk % urls.length]!);
	}, 120_000);

	it('goes on at another instance after the one of the last chunk stops', async () => {
		const data = randomBytes(4 * CHUNK + 123);
		const victim = containerName('backoffice-api', 2);
		try {
			await upload(
				data,
				`deploy-tus-${randomUUID().slice(0, 8)}.bin`,
				// Chunks 0-1 at replicas 1-2; replica 2 then stops; the rest at replica 3 and Directus.
				(chunk) => (chunk < 2 ? urls[chunk]! : chunk % 2 ? directusUrl : urls[2]!),
				async (chunk) => {
					if (chunk === 1) docker('kill', '-s', 'TERM', victim);
				},
			);
		} finally {
			compose('up', '-d', '--wait', 'backoffice-api');
		}
	}, 120_000);
});
