// Ported from directus/app/src/utils/upload-file.ts
// Backoffice: TUS (tus-js-client, loaded on demand) when the server enables it, otherwise multipart POST /files or
// PATCH /files/:id through uploadWithProgress (XMLHttpRequest: fetch has no upload progress), which reports bytes like
// axios `onUploadProgress` in Directus. The TUS endpoint is the SDK API URL (may be another origin; cookies go with
// `withCredentials`). No `notifications` toasts and no `upload` / `tusResumableUploadsChanged` events (no listener in
// the app; the resumable uploads list is 018, D-90): failures go to `onError` (shown in place by the caller, D-66), or
// to unexpectedError, and resolve to undefined like Directus.
import type { File } from '@directus/types';
import type { PreviousUpload, Upload } from 'tus-js-client';
import { getApiUrl, requestEndpoint, sdk } from '../api/sdk.ts';
import { useServerStore } from '../stores/server.ts';
import { unexpectedError } from './unexpected-error.ts';
import { uploadWithProgress } from './upload-with-progress.ts';

/** Ported from directus/packages/constants/src/files.ts (8 MiB; @directus/constants is not a dependency). */
export const DEFAULT_CHUNK_SIZE = 8_388_608;

export type ChunkedUploadController = Pick<Upload, 'start' | 'abort'>;

export interface UploadFileOptions {
	onProgressChange?: (percentage: number) => void;
	onChunkedUpload?: (controller: ChunkedUploadController) => void;
	onError?: (error: unknown) => void;
	preset?: Partial<File>;
	fileId?: string;
}

export async function uploadFile(file: globalThis.File, options?: UploadFileOptions): Promise<File | undefined> {
	const progressHandler = options?.onProgressChange || (() => undefined);
	const fail = (error: unknown) => (options?.onError ? options.onError(error) : unexpectedError(error));

	const server = useServerStore();

	if (server.info.uploads?.tus === true) {
		try {
			return await uploadWithTus(file, options, progressHandler, server.info.uploads.chunkSize);
		} catch (error) {
			fail(error);
			return undefined;
		}
	}

	const formData = new FormData();

	if (options?.preset) {
		for (const [key, value] of Object.entries(options.preset)) {
			formData.append(key, value as string);
		}
	}

	formData.append('file', file);

	try {
		return options?.fileId
			? await uploadWithProgress<File>(`/files/${options.fileId}`, formData, progressHandler, undefined, 'PATCH')
			: await uploadWithProgress<File>('/files', formData, progressHandler);
	} catch (error) {
		fail(error);
	}

	return undefined;
}

async function uploadWithTus(
	file: globalThis.File,
	options: UploadFileOptions | undefined,
	progressHandler: (percentage: number) => void,
	chunkSize: number | undefined,
): Promise<File> {
	const { Upload } = await import('tus-js-client');

	const fileInfo: Partial<File> = { ...(options?.preset ?? {}) };

	if (options?.fileId) {
		fileInfo.id = options.fileId;
	}

	fileInfo.filename_download = file.name;
	fileInfo.type = file.type;

	return new Promise<File>((resolve, reject) => {
		const upload = new Upload(file, {
			endpoint: new URL('files/tus', getApiUrl()).href,
			chunkSize: chunkSize ?? DEFAULT_CHUNK_SIZE,
			metadata: fileInfo as Record<string, string>,
			// Allow user to re-upload of the same file
			// https://github.com/tus/tus-js-client/blob/main/docs/api.md#removefingerprintonsuccess
			removeFingerprintOnSuccess: true,
			onBeforeRequest(req) {
				const xhr = req.getUnderlyingObject() as XMLHttpRequest;
				xhr.withCredentials = true;
			},
			onError(error) {
				reject(error);
			},
			onProgress(bytesUploaded, bytesTotal) {
				const percentage = Number(((bytesUploaded / bytesTotal) * 100).toFixed(2));
				progressHandler(percentage);
			},
			async onSuccess() {
				try {
					const data = await sdk.request(requestEndpoint<File>(`/files/${fileInfo.id}`, { method: 'GET' }));
					resolve(data ?? (fileInfo as File));
				} catch {
					resolve(fileInfo as File);
				}
			},
			onShouldRetry() {
				return false;
			},
			onAfterResponse(_req, res) {
				const headerId = res.getHeader('Directus-File-Id'); // brand-allowed: API header name
				if (fileInfo.id === undefined && headerId) fileInfo.id = headerId;
			},
		});

		options?.onChunkedUpload?.({
			start() {
				upload.start();
			},
			abort: () => upload.abort(),
		});

		// Check if there are any previous uploads to continue.
		upload.findPreviousUploads().then((previousUploads: PreviousUpload[]) => {
			// Found previous uploads so we select the first one.
			if (previousUploads.length > 0) {
				upload.resumeFromPreviousUpload(previousUploads[0]!);
				const previousId = previousUploads[0]!.metadata['id'];
				if (previousId) fileInfo.id = previousId;
			}

			// Start the upload
			upload.start();
		});
	});
}
