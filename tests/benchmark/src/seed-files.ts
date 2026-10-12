// Seed of the files and assets benchmark (feature 007, contracts/parity.md §6), through the Directus API: IMAGES jpeg
// images of about 1 MB made by sharp (noise, so each is distinct and compresses little) uploaded to `local`, their
// system-medium-cover asset made once, ROWS small file rows (no object, inserted on the host) for the list, a user who
// reads half of the files (filter on the title), and an admin user, both with a static token.
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { db, directus } from './seed-permissions.ts';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
const IMAGES = Number(process.env['BENCH_FILES_IMAGES'] ?? 200);
const ROWS = Number(process.env['BENCH_FILES_ROWS'] ?? 1000);
const BOUNDARY = 'bench-files-boundary-7d1c';

export interface FilesSeed {
	tag: string;
	tokens: { admin: string; user: string };
	images: string[];
	/** Average size of the seeded images in bytes. */
	imageBytes: number;
	seconds: number;
}

/** A multipart/form-data body of one file with a fixed boundary, and its Content-Type. */
export function multipart(filename: string, data: Buffer, type: string): { body: Buffer; contentType: string } {
	return {
		body: Buffer.concat([
			Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="storage"\r\n\r\nlocal\r\n`),
			Buffer.from(
				`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`,
			),
			data,
			Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
		]),
		contentType: `multipart/form-data; boundary=${BOUNDARY}`,
	};
}

/** The derived assets (`<name>__<hash>.<ext>`) in the shared `uploads` volume, through the Directus container. */
export function deleteDerived(): void {
	execFileSync('docker', [
		'compose',
		'-p',
		'benchmark',
		'exec',
		'-T',
		'directus',
		'find',
		'/directus/uploads',
		'-name',
		'*__*',
		'-delete',
	]);
}

async function upload(token: string, filename: string, data: Buffer): Promise<string> {
	const { body, contentType } = multipart(filename, data, 'image/jpeg');
	const res = await fetch(`${DIRECTUS}/files`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
		body,
	});
	if (!res.ok) throw new Error(`upload ${filename}: ${res.status} ${await res.text()}`);
	return ((await res.json()) as any).data.id as string;
}

export async function seed(): Promise<FilesSeed> {
	const started = Date.now();
	const tag = `bench-files-${randomBytes(3).toString('hex')}`;

	const policy = async (name: string, body: Record<string, unknown>) =>
		(await directus('POST', '/policies', { name: `${tag}-${name}`, icon: 'badge', ...body })).data.id as string;

	const admin = await policy('admin', { admin_access: true, app_access: true });
	const reader = await policy('user', {
		app_access: true,
		permissions: [
			{
				collection: 'directus_files',
				action: 'read',
				fields: ['*'],
				permissions: { title: { _starts_with: `${tag}-a` } },
			},
		],
	});

	const tokens = { admin: `${tag}-admin`, user: `${tag}-user` };

	for (const [name, token, policyId] of [
		['admin', tokens.admin, admin],
		['user', tokens.user, reader],
	] as const) {
		const user = (await directus('POST', '/users', { email: `${tag}-${name}@example.com`, token, status: 'active' }))
			.data.id;
		await directus('POST', '/access', { user, policy: policyId });
	}

	const images: string[] = [];
	let bytes = 0;

	for (let i = 0; i < IMAGES; i++) {
		const data = await sharp({
			create: {
				width: 1600,
				height: 1200,
				channels: 3,
				background: '#808080',
				noise: { type: 'gaussian', mean: 128, sigma: 40 },
			},
		})
			.jpeg({ quality: 85 })
			.toBuffer();
		bytes += data.length;
		images.push(await upload(tokens.admin, `${tag}-a-image-${i}.jpg`, data));
	}

	// The cover the file library shows, made once (the asset-derived scenario reads it).
	for (const id of images) {
		const res = await fetch(`${DIRECTUS}/assets/${id}?key=system-medium-cover`, {
			headers: { authorization: `Bearer ${tokens.admin}` },
		});
		await res.arrayBuffer();
	}

	// Rows only (no object), on the host: POST /files takes one JSON row at a time at both apps.
	const rows = Array.from({ length: ROWS }, (_, i) => ({
		id: randomUUID(),
		storage: 'local',
		type: 'application/octet-stream',
		filename_download: `${tag}-${i}.bin`,
		// Half of the rows are readable by the user.
		title: `${tag}-${i % 2 === 0 ? 'a' : 'b'}-${i}`,
		filesize: 10 * 1024,
	}));
	await db.batchInsert('directus_files', rows, 200);

	return {
		tag,
		tokens,
		images,
		imageBytes: Math.round(bytes / Math.max(1, IMAGES)),
		seconds: Math.round((Date.now() - started) / 1000),
	};
}

/** Files of the seed and of the upload scenario, objects too (the API); the rows without object on the host. */
export async function deleteFiles(tag: string, pattern = `${tag}%`): Promise<void> {
	// An upload still running when autocannon stops has a row without filename_disk for a moment, and Directus answers
	// 500 to DELETE /files of such a row (the storage path is null): those rows go on the host, then retry a few times.
	for (let attempt = 1; ; attempt++) {
		await db('directus_files').where('filename_download', 'like', pattern).whereNull('filename_disk').delete();
		const ids = (await db('directus_files').select('id').where('filename_download', 'like', pattern)).map((r) => r.id);

		try {
			for (let i = 0; i < ids.length; i += 500) await directus('DELETE', '/files', ids.slice(i, i + 500));
			return;
		} catch (error) {
			if (attempt === 5) throw error;
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
}

export async function cleanup(seeded: FilesSeed): Promise<void> {
	await deleteFiles(seeded.tag);
	deleteDerived();

	const users = await db('directus_users').select('id').where('email', 'like', `${seeded.tag}%`);
	if (users.length)
		await directus(
			'DELETE',
			'/users',
			users.map((u) => u.id),
		);

	for (const { id: policy } of await db('directus_policies').select('id').where('name', 'like', `${seeded.tag}%`)) {
		await directus('DELETE', `/policies/${policy}`);
	}

	await db.destroy();
}
