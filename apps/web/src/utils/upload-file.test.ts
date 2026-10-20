// Feature 015 (FR-022, data-model §4): uploadFile as directus/app/src/utils/upload-file.ts: multipart field order,
// PATCH for a replaced file, and the TUS options when the server enables TUS (tus-js-client mocked).
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { useServerStore } from '../stores/server.ts';
import { uploadFile } from './upload-file.ts';

const request = vi.hoisted(() => vi.fn());
const xhrUpload = vi.hoisted(() => vi.fn());
const tus = vi.hoisted(() => ({ instances: [] as any[], previous: [] as any[] }));

vi.mock('../api/sdk.ts', () => ({
	getApiUrl: () => 'http://api.test/',
	sdk: { request: (command: () => unknown) => request(command()) },
	requestEndpoint: (path: string, options: object) => () => ({ path, ...options }),
}));

vi.mock('./upload-with-progress.ts', () => ({ uploadWithProgress: xhrUpload }));

vi.mock('tus-js-client', () => ({
	Upload: class {
		options: any;
		file: File;
		started = false;
		resumedFrom: unknown = null;
		constructor(file: File, options: any) {
			this.file = file;
			this.options = options;
			tus.instances.push(this);
		}
		findPreviousUploads() {
			return Promise.resolve(tus.previous);
		}
		resumeFromPreviousUpload(previous: unknown) {
			this.resumedFrom = previous;
		}
		start() {
			this.started = true;
		}
		abort() {}
	},
}));

const file = () => new File(['hello'], 'hello.txt', { type: 'text/plain' });

beforeEach(() => {
	setActivePinia(createPinia());
	request.mockReset();
	xhrUpload.mockReset();
	tus.instances.length = 0;
	tus.previous = [];
});

test('multipart: preset fields first, then the file, POST /files with byte progress', async () => {
	xhrUpload.mockImplementation(async (_path, _body, onProgress) => {
		onProgress(40);
		return { id: 'f1' };
	});

	const onProgressChange = vi.fn();
	const result = await uploadFile(file(), { preset: { folder: 'd1', title: 'T' }, onProgressChange });

	expect(result).toEqual({ id: 'f1' });
	expect(onProgressChange.mock.calls).toEqual([[40]]);

	const [path, body, , , method = 'POST'] = xhrUpload.mock.calls[0]!;
	expect([path, method]).toEqual(['/files', 'POST']);
	expect([...(body as FormData).keys()]).toEqual(['folder', 'title', 'file']);
	expect(((body as FormData).get('file') as File).name).toBe('hello.txt');
});

test('multipart with fileId replaces the file with PATCH /files/:id', async () => {
	xhrUpload.mockResolvedValue({ id: 'f1' });

	await uploadFile(file(), { fileId: 'f1' });

	const [path, body, , , method] = xhrUpload.mock.calls[0]!;
	expect([path, method]).toEqual(['/files/f1', 'PATCH']);
	expect([...(body as FormData).keys()]).toEqual(['file']);
});

test('a failed upload calls onError and resolves undefined', async () => {
	const error = { errors: [{ message: 'too large' }], response: { status: 413 } };
	xhrUpload.mockRejectedValue(error);
	const onError = vi.fn();

	expect(await uploadFile(file(), { onError })).toBeUndefined();
	expect(onError).toHaveBeenCalledWith(error);
});

test('TUS: options as Directus, id from the response header, then GET /files/:id', async () => {
	useServerStore().info.uploads = { tus: true, chunkSize: 1024 };
	request.mockResolvedValue({ id: 'new-id', title: 'hello' });

	const promise = uploadFile(file(), { preset: { folder: 'd1' } });
	await vi.waitFor(() => expect(tus.instances[0]?.started).toBe(true));

	const upload = tus.instances[0];
	expect(request).not.toHaveBeenCalled();
	expect(upload.options.endpoint).toBe('http://api.test/files/tus');
	expect(upload.options.chunkSize).toBe(1024);
	expect(upload.options.metadata).toEqual({ folder: 'd1', filename_download: 'hello.txt', type: 'text/plain' });
	expect(upload.options.removeFingerprintOnSuccess).toBe(true);
	expect(upload.options.onShouldRetry()).toBe(false);

	const xhr = { withCredentials: false };
	upload.options.onBeforeRequest({ getUnderlyingObject: () => xhr });
	expect(xhr.withCredentials).toBe(true);

	upload.options.onAfterResponse({}, { getHeader: (name: string) => (name === 'Directus-File-Id' ? 'new-id' : null) });
	await upload.options.onSuccess();

	expect(await promise).toEqual({ id: 'new-id', title: 'hello' });
	expect(request).toHaveBeenCalledWith({ path: '/files/new-id', method: 'GET' });
});

test('TUS: default chunk size and fileId in the metadata', async () => {
	useServerStore().info.uploads = { tus: true };

	void uploadFile(file(), { fileId: 'f9' });
	await vi.waitFor(() => expect(tus.instances[0]?.started).toBe(true));

	const upload = tus.instances[0];
	expect(upload.options.chunkSize).toBe(8_388_608);
	expect(upload.options.metadata.id).toBe('f9');
});

test('TUS: a previous upload of the file is resumed and its id kept (the metadata object, as Directus)', async () => {
	useServerStore().info.uploads = { tus: true };
	tus.previous = [{ metadata: { id: 'old-id' } }];

	void uploadFile(file());
	await vi.waitFor(() => expect(tus.instances[0]?.started).toBe(true));

	const upload = tus.instances[0];
	expect(upload.resumedFrom).toEqual({ metadata: { id: 'old-id' } });
	expect(upload.options.metadata.id).toBe('old-id');
});

test('TUS: an error goes to onError', async () => {
	useServerStore().info.uploads = { tus: true };
	const onError = vi.fn();

	const promise = uploadFile(file(), { onError });
	await vi.waitFor(() => expect(tus.instances[0]?.started).toBe(true));
	tus.instances[0].options.onError(new Error('offset mismatch'));

	expect(await promise).toBeUndefined();
	expect(onError).toHaveBeenCalledWith(new Error('offset mismatch'));
});
