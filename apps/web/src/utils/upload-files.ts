// Ported from directus/app/src/utils/upload-files.ts
// Backoffice: no success toast (`notifications`, D-66); per-file failures reach `onError` with the file, so the caller
// lists them in place, and the other files go on.
import type { File } from '@directus/types';
import PQueue from 'p-queue';
import { type ChunkedUploadController, uploadFile } from './upload-file.ts';
import { unexpectedError } from './unexpected-error.ts';

export async function uploadFiles(
	files: globalThis.File[],
	options?: {
		onProgressChange?: (percentages: number[]) => void;
		onChunkedUpload?: (controllers: (ChunkedUploadController | null)[]) => void;
		onError?: (file: globalThis.File, error: unknown) => void;
		preset?: Record<string, any>;
		fileId?: string;
		maxConcurrency?: number | undefined;
	},
): Promise<(File | undefined)[]> {
	const progressHandler = options?.onProgressChange || (() => undefined);
	const progressForFiles = files.map(() => 0);
	const uploadControllers: (ChunkedUploadController | null)[] = Array(files.length).fill(null);

	const uploadQueue = new PQueue({
		concurrency: options?.maxConcurrency && options.maxConcurrency > 0 ? options.maxConcurrency : Infinity,
	});

	const startUpload = (file: globalThis.File, index: number) =>
		uploadFile(file, {
			...(options?.preset && { preset: options.preset }),
			...(options?.fileId && { fileId: options.fileId }),
			...(options?.onError && { onError: (error: unknown) => options.onError!(file, error) }),
			onProgressChange: (percentage: number) => {
				progressForFiles[index] = percentage;
				progressHandler(progressForFiles);
			},
			onChunkedUpload: (controller: ChunkedUploadController) => {
				uploadControllers[index] = controller;
				options?.onChunkedUpload?.(uploadControllers);
			},
		});

	try {
		const uploadedFiles = (
			await Promise.all(
				files.map((file, index) => uploadQueue.add(() => startUpload(file, index), { throwOnTimeout: true })),
			)
		).filter((v) => v);

		return uploadedFiles;
	} catch (error) {
		unexpectedError(error);
	}

	return [];
}
