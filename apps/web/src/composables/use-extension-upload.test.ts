// Backoffice (spec 031, D-212, T036): the probe of the Upload extension button and the multipart upload.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { apiFetch, getApiUrl } from '../api/sdk.ts';
import { _resetExtensionUpload, useExtensionUpload } from './use-extension-upload.ts';

vi.mock('../api/sdk.ts', () => ({ apiFetch: vi.fn(), getApiUrl: vi.fn() }));

const answer = (status: number, body: unknown = {}) =>
	({ ok: status < 400, status, statusText: 'x', json: async () => body }) as unknown as Response;

beforeEach(() => {
	_resetExtensionUpload();
	vi.mocked(getApiUrl).mockReturnValue('http://localhost:3000/');
});

afterEach(() => {
	vi.clearAllMocks();
});

test('Backoffice: available, with the size limit of the API', async () => {
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: { max_upload_size: 10485760 } }));

	const { ready, available, maxUploadSize } = useExtensionUpload();

	await expect(ready).resolves.toBe(true);
	expect(available.value).toBe(true);
	expect(maxUploadSize.value).toBe(10485760);
	expect(apiFetch).toHaveBeenCalledWith('/backoffice/extensions/upload', { method: 'GET' });
});

test('a DR API (404) or a network error: not available, silently', async () => {
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(404));
	await expect(useExtensionUpload().ready).resolves.toBe(false);

	_resetExtensionUpload();
	vi.mocked(apiFetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
	await expect(useExtensionUpload().ready).resolves.toBe(false);
});

test('one probe per API URL', async () => {
	vi.mocked(apiFetch).mockResolvedValue(answer(200, { data: { max_upload_size: null } }));

	await useExtensionUpload().ready;
	await useExtensionUpload().ready;
	expect(apiFetch).toHaveBeenCalledTimes(1);

	vi.mocked(getApiUrl).mockReturnValue('http://other:3000/');
	await useExtensionUpload().ready;
	expect(apiFetch).toHaveBeenCalledTimes(2);
});

/** The composable once its probe has answered (the probe is the first request). */
async function probed() {
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: { max_upload_size: null } }));
	const composable = useExtensionUpload();
	await composable.ready;
	return composable;
}

test('upload: the file as the `file` part of a FormData, no content-type set; resolves the installed row', async () => {
	const row = { id: 'u', bundle: null, meta: { source: 'upload' }, schema: { name: 'x', type: 'endpoint' } };
	const { ready, upload } = await probed();
	await ready;
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: row }));
	const file = new File([new Uint8Array([1, 2, 3])], 'x-1.0.0.tgz');

	await expect(upload(file)).resolves.toEqual(row);

	const [path, init] = vi.mocked(apiFetch).mock.calls[1]!;
	expect(path).toBe('/backoffice/extensions/upload');
	expect(init?.method).toBe('POST');
	expect(init?.headers).toBeUndefined();
	expect((init?.body as FormData).get('file')).toBeInstanceOf(File);
});

test('upload: an error of the API rejects with its errors (the reason kept)', async () => {
	const errors = [{ message: 'x', extensions: { code: 'INVALID_PAYLOAD', reason: 'An extension named "x" is already installed (local)' } }];
	const { upload } = await probed();
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(400, { errors }));

	await expect(upload(new File(['x'], 'x.tgz'))).rejects.toMatchObject({ errors });
});
