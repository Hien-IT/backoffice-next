// Feature 015 (FR-021, FR-023): uploadFiles runs uploadFile through a queue of maxConcurrency, reports the progress of
// every file, and keeps going when one file fails.
import { beforeEach, expect, test, vi } from 'vitest';
import { uploadFiles } from './upload-files.ts';

const uploadFile = vi.hoisted(() => vi.fn());

vi.mock('./upload-file.ts', () => ({ uploadFile }));

const files = (n: number) => Array.from({ length: n }, (_, i) => new File(['x'], `f${i}.txt`, { type: 'text/plain' }));

beforeEach(() => {
	uploadFile.mockReset();
});

test('at most maxConcurrency uploads at once', async () => {
	let running = 0;
	let peak = 0;

	uploadFile.mockImplementation(async (file: File) => {
		running++;
		peak = Math.max(peak, running);
		await new Promise((resolve) => setTimeout(resolve, 5));
		running--;
		return { id: file.name };
	});

	const result = await uploadFiles(files(12), { maxConcurrency: 5 });

	expect(peak).toBe(5);
	expect(result).toHaveLength(12);
});

test('maxConcurrency 0 or missing means no limit', async () => {
	let running = 0;
	let peak = 0;

	uploadFile.mockImplementation(async () => {
		running++;
		peak = Math.max(peak, running);
		await new Promise((resolve) => setTimeout(resolve, 5));
		running--;
		return { id: 'x' };
	});

	await uploadFiles(files(6), { maxConcurrency: 0 });
	expect(peak).toBe(6);
});

test('progress is an array with one percentage per file; preset is passed on', async () => {
	uploadFile.mockImplementation(async (_file: File, options: any) => {
		options.onProgressChange(100);
		return { id: 'x' };
	});

	const onProgressChange = vi.fn();
	await uploadFiles(files(2), { onProgressChange, preset: { folder: 'd1' } });

	expect(onProgressChange).toHaveBeenLastCalledWith([100, 100]);
	expect(uploadFile.mock.calls[0]![1].preset).toEqual({ folder: 'd1' });
});

test('a failed file is left out, reported with its file, and the others go on', async () => {
	uploadFile.mockImplementation(async (file: File, options: any) => {
		if (file.name === 'f1.txt') {
			options.onError({ status: 413 });
			return undefined;
		}

		return { id: file.name };
	});

	const onError = vi.fn();
	const result = await uploadFiles(files(3), { onError });

	expect(result).toEqual([{ id: 'f0.txt' }, { id: 'f2.txt' }]);
	expect(onError).toHaveBeenCalledWith(expect.objectContaining({ name: 'f1.txt' }), { status: 413 });
});
