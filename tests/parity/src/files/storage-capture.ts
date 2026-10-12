// Feature 007 (research R8, contracts/parity.md §2, spec FR-080): what an app leaves on the shared storage and in
// directus_files, directus_folders. `local` is the `uploads` volume of every app container (read inside the main
// Directus container), `s3` the `directus` bucket of MinIO (read with the S3 client on the host port).
import { createHash } from 'node:crypto';
import {
	DeleteObjectsCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	S3Client,
} from '@aws-sdk/client-s3';
import type { Knex } from 'knex';
import type { StorageLocation } from '../config.js';
import { compose } from '../docker.js';

const UPLOADS = '/directus/uploads';
const BUCKET = 'directus';

let s3: S3Client | undefined;

function s3Client(): S3Client {
	s3 ??= new S3Client({
		endpoint: 'http://127.0.0.1:8881',
		region: 'us-east-1',
		forcePathStyle: true,
		credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' },
	});

	return s3;
}

export interface ObjectDigest {
	key: string;
	size: number;
	sha256: string;
	/** Content-Type stored on S3 (the `local` driver keeps none). */
	contentType?: string | undefined;
}

/** Keys of the objects whose name starts with `prefix`, sorted (case sensitive, unlike the `local` driver list). */
export async function listObjects(location: StorageLocation, prefix = ''): Promise<string[]> {
	if (location === 'local') {
		const out = compose('exec', '-T', 'directus', 'find', UPLOADS, '-type', 'f');

		return out
			.split('\n')
			.filter(Boolean)
			.map((path) => path.slice(UPLOADS.length + 1))
			.filter((key) => key.startsWith(prefix) && key !== 'directus-health-file')
			.sort();
	}

	const keys: string[] = [];
	let token: string | undefined;

	do {
		const page = await s3Client().send(
			new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }),
		);

		for (const object of page.Contents ?? []) {
			if (object.Key && object.Key !== 'directus-health-file') keys.push(object.Key);
		}

		token = page.NextContinuationToken;
	} while (token);

	return keys.sort();
}

/** Size and sha256 of one object, plus its S3 Content-Type. */
export async function objectDigest(location: StorageLocation, key: string): Promise<ObjectDigest> {
	if (location === 'local') {
		const path = `${UPLOADS}/${key}`;
		const [sha256, size] = compose('exec', '-T', 'directus', 'sh', '-c', `sha256sum "$1" && stat -c %s "$1"`, '-', path)
			.trim()
			.split('\n');

		return { key, size: Number(size), sha256: sha256!.split(/\s+/)[0]! };
	}

	const head = await s3Client().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
	const body = await s3Client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
	const bytes = Buffer.from(await body.Body!.transformToByteArray());

	return {
		key,
		size: bytes.length,
		sha256: createHash('sha256').update(bytes).digest('hex'),
		contentType: head.ContentType,
	};
}

/** Digests of every object under `prefix` (key, size, sha256, Content-Type), for comparing two apps. */
export async function captureObjects(location: StorageLocation, prefix: string): Promise<ObjectDigest[]> {
	const keys = await listObjects(location, prefix);
	return Promise.all(keys.map((key) => objectDigest(location, key)));
}

/** Delete every derived asset (`<name>__<hash>.<ext>`) whose name starts with `prefix`. */
export async function deleteDerived(location: StorageLocation, prefix = ''): Promise<string[]> {
	const derived = (await listObjects(location, prefix)).filter((key) => key.includes('__'));
	await deleteObjects(location, derived);
	return derived;
}

/** Delete objects by key (cleanup of a test, never used to compare). */
export async function deleteObjects(location: StorageLocation, keys: string[]): Promise<void> {
	if (keys.length === 0) return;

	if (location === 'local') {
		compose('exec', '-T', 'directus', 'sh', '-c', 'cd "$0" && rm -f -- "$@"', UPLOADS, ...keys);
		return;
	}

	await s3Client().send(
		new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys.map((Key) => ({ Key })) } }),
	);
}

/** Columns of directus_files that differ between two uploads of the same file by design (spec FR-080). */
export const FILE_VOLATILE_COLUMNS = ['id', 'created_on', 'modified_on', 'uploaded_on'] as const;

const parseJson = (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value);

/**
 * Rows of directus_files in the order of `ids`, without the volatile columns; the row's own id inside filename_disk
 * becomes `<id>`, JSON columns are parsed (vendors store them as text), and tus_* are kept only while not null.
 */
export async function fileRows(db: Knex, ids: string[]): Promise<Record<string, unknown>[]> {
	const rows: Record<string, unknown>[] = await db('directus_files').whereIn('id', ids);

	return ids.map((id) => {
		const row = rows.find((r) => r['id'] === id);
		if (!row) return { missing: id };

		const out: Record<string, unknown> = {};

		for (const [column, value] of Object.entries(row)) {
			if ((FILE_VOLATILE_COLUMNS as readonly string[]).includes(column)) continue;
			if ((column === 'tus_id' || column === 'tus_data') && value === null) continue;

			if (column === 'filename_disk' && typeof value === 'string') out[column] = value.replaceAll(id, '<id>');
			else if (column === 'metadata' || column === 'tags' || column === 'tus_data') out[column] = parseJson(value);
			else if (column === 'filesize' && value !== null) out[column] = Number(value);
			else out[column] = value;
		}

		return out;
	});
}

/** Rows of directus_folders in the order of `ids`, without the id. */
export async function folderRows(db: Knex, ids: string[]): Promise<Record<string, unknown>[]> {
	const rows: Record<string, unknown>[] = await db('directus_folders').whereIn('id', ids);

	return ids.map((id) => {
		const { id: _id, ...row } = rows.find((r) => r['id'] === id) ?? { id, missing: id };
		return row;
	});
}
