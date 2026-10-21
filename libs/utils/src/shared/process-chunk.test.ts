import { expect, test } from 'vitest';
import { processChunk } from './process-chunk.js';

test('calls the callback once per chunk, in order, awaiting each', async () => {
	const seen: number[][] = [];
	const done: number[] = [];

	await processChunk([1, 2, 3, 4, 5], 2, async (chunk) => {
		seen.push(chunk);
		await new Promise((resolve) => setTimeout(resolve, 1));
		done.push(chunk[0]!);
	});

	expect(seen).toEqual([[1, 2], [3, 4], [5]]);
	expect(done).toEqual([1, 3, 5]);
});

test('an empty array never calls the callback', async () => {
	let calls = 0;
	await processChunk([], 3, async () => void calls++);
	expect(calls).toBe(0);
});
