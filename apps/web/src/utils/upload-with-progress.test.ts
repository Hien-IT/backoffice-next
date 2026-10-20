import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createSdk } from '../api/sdk.ts';
import { uploadWithProgress } from './upload-with-progress.ts';

class FakeXhr {
	static last: FakeXhr;
	method = '';
	url = '';
	withCredentials = false;
	status = 0;
	responseText = '';
	body: unknown;
	upload: { onprogress?: (event: Partial<ProgressEvent>) => void } = {};
	onload?: () => void;
	onerror?: () => void;
	onabort?: () => void;
	abort = vi.fn(() => this.onabort?.());

	constructor() {
		FakeXhr.last = this;
	}

	open(method: string, url: string) {
		this.method = method;
		this.url = url;
	}

	send(body: unknown) {
		this.body = body;
	}

	answer(status: number, body: unknown) {
		this.status = status;
		this.responseText = JSON.stringify(body);
		this.onload?.();
	}
}

beforeEach(() => {
	vi.stubGlobal('XMLHttpRequest', FakeXhr);
	createSdk('http://api.test/base');
});

afterEach(() => vi.unstubAllGlobals());

test('posts the form to the API URL with credentials, reports the progress and resolves with data', async () => {
	const form = new FormData();
	const onProgress = vi.fn();
	const promise = uploadWithProgress('/utils/import/bo_content?background=true', form, onProgress);
	const xhr = FakeXhr.last;

	expect(xhr.method).toBe('POST');
	expect(xhr.url).toBe('http://api.test/base/utils/import/bo_content?background=true');
	expect(xhr.withCredentials).toBe(true);
	expect(xhr.body).toBe(form);

	xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 3 });
	xhr.upload.onprogress?.({ lengthComputable: false, loaded: 2, total: 0 });
	xhr.upload.onprogress?.({ lengthComputable: true, loaded: 3, total: 3 });
	expect(onProgress.mock.calls).toEqual([[33], [100]]);

	xhr.answer(200, { data: { ok: 1 } });
	await expect(promise).resolves.toEqual({ ok: 1 });
});

test('PATCH when asked (replacing a file)', async () => {
	const promise = uploadWithProgress('/files/f1', new FormData(), undefined, undefined, 'PATCH');
	expect([FakeXhr.last.method, FakeXhr.last.url]).toEqual(['PATCH', 'http://api.test/base/files/f1']);
	FakeXhr.last.answer(200, { data: { id: 'f1' } });
	await expect(promise).resolves.toEqual({ id: 'f1' });
});

test('an empty 204 answer resolves with undefined', async () => {
	const promise = uploadWithProgress('/utils/import/c', new FormData());
	FakeXhr.last.status = 204;
	FakeXhr.last.onload?.();
	await expect(promise).resolves.toBeUndefined();
});

test('a non-2xx answer rejects with the SDK error shape', async () => {
	const promise = uploadWithProgress('/utils/import/c', new FormData());
	const errors = [{ message: 'x', extensions: { code: 'FAILED_VALIDATION' } }];
	FakeXhr.last.answer(400, { errors });
	await expect(promise).rejects.toEqual({ errors, response: { status: 400 } });
});

test('network errors and aborts reject', async () => {
	const failed = uploadWithProgress('/utils/import/c', new FormData());
	FakeXhr.last.onerror?.();
	await expect(failed).rejects.toBeInstanceOf(TypeError);

	const controller = new AbortController();
	const aborted = uploadWithProgress('/utils/import/c', new FormData(), undefined, controller.signal);
	controller.abort();
	expect(FakeXhr.last.abort).toHaveBeenCalled();
	await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });

	await expect(uploadWithProgress('/x', new FormData(), undefined, controller.signal)).rejects.toMatchObject({
		name: 'AbortError',
	});
});
