// Backoffice: no Directus source. The Directus app posts uploads with axios `onUploadProgress`
// (views/private/components/export-sidebar-detail.vue); fetch has no upload progress, so this sends the multipart body
// with XMLHttpRequest to the API URL (`getApiUrl()`, may be another origin) with the session cookie (research R10).
import { getApiUrl } from '../api/sdk.ts';

/**
 * POSTs `body` to `path` (relative to the API URL, query included) and resolves with the `data` of the JSON answer.
 * `onProgress` gets the uploaded percentage (0-100, floored like Directus). A non-2xx answer rejects with
 * `{ errors, response: { status } }` (the SDK error shape, read by extractErrorCode); an abort through `signal` rejects
 * with an `AbortError` DOMException.
 */
export function uploadWithProgress<T = unknown>(
	path: string,
	body: FormData,
	onProgress?: (percent: number) => void,
	signal?: AbortSignal,
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const abortError = () => new DOMException('The upload was aborted.', 'AbortError');

		if (signal?.aborted) return reject(abortError());

		const xhr = new XMLHttpRequest();
		xhr.open('POST', new URL(path.replace(/^\//, ''), getApiUrl()).href);
		xhr.withCredentials = true;

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress?.(Math.floor((event.loaded * 100) / event.total));
		};

		xhr.onload = () => {
			let json: { data?: T; errors?: unknown } | null = null;

			try {
				json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
			} catch {
				// Non-JSON answer (proxy error page): rejected below by status, or resolved without data.
			}

			if (xhr.status >= 200 && xhr.status < 300) resolve(json?.data as T);
			else reject({ errors: json?.errors, response: { status: xhr.status } });
		};

		xhr.onerror = () => reject(new TypeError('Network request failed'));
		xhr.onabort = () => reject(abortError());
		signal?.addEventListener('abort', () => xhr.abort(), { once: true });

		xhr.send(body);
	});
}
