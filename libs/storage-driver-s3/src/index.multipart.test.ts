// TUS chunked uploads against an in-memory S3 (multipart API), complementing the ported Directus tests.
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DriverS3 } from './index.js';

type Part = { PartNumber: number; ETag: string; body: Buffer };

class FakeS3 {
	uploads = new Map<string, { key: string; parts: Part[]; params: Record<string, unknown> }>();
	objects = new Map<string, Buffer>();
	listPageSize = 1000;
	failListPartsWithCode: string | undefined;
	sent: string[] = [];

	async send(command: { constructor: { name: string }; input: any }): Promise<any> {
		const { input } = command;
		const name = command.constructor.name;
		this.sent.push(name);

		switch (name) {
			case 'CreateMultipartUploadCommand': {
				const id = `upload-${this.uploads.size + 1}`;
				this.uploads.set(id, { key: input.Key, parts: [], params: input });
				return { UploadId: id };
			}

			case 'UploadPartCommand': {
				const chunks: Buffer[] = [];
				for await (const chunk of input.Body) chunks.push(Buffer.from(chunk));
				const part = { PartNumber: input.PartNumber, ETag: `"etag-${input.PartNumber}"`, body: Buffer.concat(chunks) };
				this.uploads.get(input.UploadId)!.parts.push(part);
				return { ETag: part.ETag };
			}

			case 'ListPartsCommand': {
				const parts = [...this.uploads.get(input.UploadId)!.parts].sort((a, b) => b.PartNumber - a.PartNumber);
				const start = input.PartNumberMarker ? Number(input.PartNumberMarker) : 0;
				const page = parts.slice(start, start + this.listPageSize);
				const truncated = start + this.listPageSize < parts.length;
				return {
					Parts: page,
					IsTruncated: truncated,
					NextPartNumberMarker: truncated ? String(start + this.listPageSize) : undefined,
				};
			}

			case 'CompleteMultipartUploadCommand': {
				const upload = this.uploads.get(input.UploadId)!;
				const byNumber = new Map(upload.parts.map((p) => [p.PartNumber, p.body]));
				this.objects.set(
					upload.key,
					Buffer.concat(input.MultipartUpload.Parts.map((p: Part) => byNumber.get(p.PartNumber)!)),
				);
				this.uploads.delete(input.UploadId);
				return { Location: `https://s3/${upload.key}` };
			}

			case 'AbortMultipartUploadCommand': {
				if (this.failListPartsWithCode)
					throw Object.assign(new Error('nope'), {
						code: this.failListPartsWithCode,
						Code: this.failListPartsWithCode,
					});
				this.uploads.delete(input.UploadId);
				return {};
			}

			case 'DeleteObjectsCommand': {
				for (const { Key } of input.Delete.Objects) this.objects.delete(Key);
				return {};
			}

			default:
				throw new Error(`unexpected ${name}`);
		}
	}
}

let s3: FakeS3;
let driver: DriverS3;

function makeDriver(config: Record<string, unknown> = {}) {
	const d = new DriverS3({ key: 'k', secret: 's', bucket: 'b', region: 'us-east-1', root: 'root', ...config } as any);
	(d as any).client = s3;
	return d;
}

beforeEach(() => {
	s3 = new FakeS3();
	driver = makeDriver();
});

test('tusExtensions', () => {
	expect(driver.tusExtensions).toEqual(['creation', 'termination', 'expiration']);
});

describe('createChunkedUpload', () => {
	test('creates a multipart upload with tus metadata, content type and cache control', async () => {
		const context = await driver.createChunkedUpload('a.bin', {
			metadata: { contentType: 'image/png', cacheControl: 'no-cache' },
		});
		expect(context.metadata!['upload-id']).toBe('upload-1');

		expect(s3.uploads.get('upload-1')!.params).toMatchObject({
			Bucket: 'b',
			Key: 'root/a.bin',
			Metadata: { 'tus-version': '1.0.0' },
			ContentType: 'image/png',
			CacheControl: 'no-cache',
		});
	});

	test('server-side encryption, with the KMS key only for aws:kms', async () => {
		driver = makeDriver({ serverSideEncryption: 'aws:kms', serverSideEncryptionKmsKeyId: 'key-1' });
		await driver.createChunkedUpload('a.bin', { metadata: {} });
		expect(s3.uploads.get('upload-1')!.params).toMatchObject({ ServerSideEncryption: 'aws:kms', SSEKMSKeyId: 'key-1' });

		driver = makeDriver({ serverSideEncryption: 'AES256', serverSideEncryptionKmsKeyId: 'key-1' });
		await driver.createChunkedUpload('b.bin', { metadata: {} });
		expect(s3.uploads.get('upload-2')!.params).not.toHaveProperty('SSEKMSKeyId');
	});
});

describe('writeChunk and finishChunkedUpload', () => {
	test('one-part upload: write then complete', async () => {
		const context = await driver.createChunkedUpload('one.bin', { size: 6, metadata: {} });
		const offset = await driver.writeChunk('one.bin', Readable.from([Buffer.from('abcdef')]), 0, context);
		expect(offset).toBe(6);
		await driver.finishChunkedUpload('one.bin', context);
		expect(s3.objects.get('root/one.bin')!.toString()).toBe('abcdef');
	});

	test('multi-part upload across several PATCH requests, with paginated ListParts', async () => {
		driver = makeDriver({ tus: { chunkSize: 5 * 1024 * 1024 } });
		(driver as any).preferredPartSize = 4;
		(driver as any).minPartSize = 4;
		s3.listPageSize = 1;

		const context = await driver.createChunkedUpload('multi.bin', { size: 10, metadata: {} });
		let offset = await driver.writeChunk('multi.bin', Readable.from([Buffer.from('abcd')]), 0, context);
		offset = await driver.writeChunk('multi.bin', Readable.from([Buffer.from('efghij')]), offset, context);
		expect(offset).toBe(10);

		await driver.finishChunkedUpload('multi.bin', context);
		expect(s3.objects.get('root/multi.bin')!.toString()).toBe('abcdefghij');
	});

	test('a part smaller than the minimum (not final) is not uploaded', async () => {
		(driver as any).preferredPartSize = 4;
		(driver as any).minPartSize = 4;
		const context = await driver.createChunkedUpload('short.bin', { size: 100, metadata: {} });
		const offset = await driver.writeChunk('short.bin', Readable.from([Buffer.from('ab')]), 0, context);
		expect(offset).toBe(0);
	});

	test('a failing source stream rejects', async () => {
		const context = await driver.createChunkedUpload('err.bin', { size: 10, metadata: {} });

		const failing = new Readable({
			read() {
				this.destroy(new Error('broken'));
			},
		});

		await expect(driver.writeChunk('err.bin', failing, 0, context)).rejects.toThrow('broken');
	});

	test('missing parts after retries → 500 "Failed to upload all parts to S3."', async () => {
		vi.useFakeTimers();
		const context = await driver.createChunkedUpload('missing.bin', { size: 10, metadata: {} });
		const finishing = driver.finishChunkedUpload('missing.bin', context).catch((e) => e);
		await vi.advanceTimersByTimeAsync(5000);
		expect(await finishing).toEqual({ status_code: 500, body: 'Failed to upload all parts to S3.' });
		vi.useRealTimers();
	});
});

describe('deleteChunkedUpload', () => {
	test('aborts the multipart upload and deletes the object', async () => {
		const context = await driver.createChunkedUpload('del.bin', { metadata: {} });
		s3.objects.set('root/del.bin', Buffer.from('x'));
		await driver.deleteChunkedUpload('del.bin', context);
		expect(s3.uploads.size).toBe(0);
		expect(s3.objects.has('root/del.bin')).toBe(false);
		expect(s3.sent.slice(-2)).toEqual(['AbortMultipartUploadCommand', 'DeleteObjectsCommand']);
	});

	test('without upload id: only deletes', async () => {
		await driver.deleteChunkedUpload('none.bin', { metadata: {} });
		expect(s3.sent).toEqual(['DeleteObjectsCommand']);
	});

	test('NoSuchUpload → tus FILE_NOT_FOUND; other errors are rethrown', async () => {
		s3.failListPartsWithCode = 'NoSuchUpload';
		await expect(driver.deleteChunkedUpload('x.bin', { metadata: { 'upload-id': 'u' } })).rejects.toMatchObject({
			status_code: 404,
		});

		s3.failListPartsWithCode = 'AccessDenied';
		await expect(driver.deleteChunkedUpload('x.bin', { metadata: { 'upload-id': 'u' } })).rejects.toThrow('nope');
	});
});

test('calcOptimalPartSize: one part, preferred size, or size / max parts', () => {
	const calc = (size?: number) => (driver as any).calcOptimalPartSize(size);
	const preferred = (driver as any).preferredPartSize;
	const maxParts = (driver as any).maxMultipartParts;
	expect(calc(10)).toBe(10);
	expect(calc(preferred * 2)).toBe(preferred);
	expect(calc(preferred * maxParts + 1)).toBe(Math.ceil((preferred * maxParts + 1) / maxParts));
	expect(calc(undefined)).toBe(Math.ceil((driver as any).maxUploadSize / maxParts));
});
