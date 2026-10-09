// Real-filesystem tests (the ported Directus tests mock node:fs): list and the TUS chunked-upload methods.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, test } from 'vitest';
import { DriverLocal } from './index.js';

let root: string;
let driver: DriverLocal;

const text = async (stream: NodeJS.ReadableStream) => {
	let out = '';
	for await (const chunk of stream) out += chunk;
	return out;
};

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'driver-local-'));
	driver = new DriverLocal({ root });
});

test('write, read, stat, exists, copy, move, delete', async () => {
	await driver.write('a/b.txt', Readable.from(['hello']));
	expect(await text(await driver.read('a/b.txt'))).toBe('hello');
	expect((await driver.stat('a/b.txt')).size).toBe(5);
	expect(await driver.exists('a/b.txt')).toBe(true);
	await driver.copy('a/b.txt', 'c.txt');
	await driver.move('c.txt', 'd/e.txt');
	expect(await driver.exists('c.txt')).toBe(false);
	expect(await text(await driver.read('d/e.txt', { range: { start: 1, end: 3 } }))).toBe('ell');
	await driver.delete('d/e.txt');
	expect(await driver.exists('d/e.txt')).toBe(false);
});

test('list walks directories and filters by prefix', async () => {
	await driver.write('img/one.png', Readable.from(['1']));
	await driver.write('img/sub/two.png', Readable.from(['2']));
	await driver.write('doc/three.txt', Readable.from(['3']));

	const all: string[] = [];
	for await (const file of driver.list()) all.push(file);
	expect(all.sort()).toEqual(['doc/three.txt', 'img/one.png', 'img/sub/two.png']);

	const images: string[] = [];
	for await (const file of driver.list('img/')) images.push(file);
	expect(images.sort()).toEqual(['img/one.png', 'img/sub/two.png']);

	const prefixed: string[] = [];
	for await (const file of driver.list('img/o')) prefixed.push(file);
	expect(prefixed).toEqual(['img/one.png']);
});

describe('chunked uploads (TUS)', () => {
	const context = { metadata: undefined };

	test('extensions', () => {
		expect(driver.tusExtensions).toEqual(['creation', 'termination', 'expiration']);
	});

	test('create, write chunks at offsets, finish', async () => {
		await driver.createChunkedUpload('up/file.bin', context);
		expect(readFileSync(join(root, 'up/file.bin'), 'utf8')).toBe('');

		const first = await driver.writeChunk('up/file.bin', Readable.from(['abc']), 0, context);
		expect(first).toBe(3);
		const second = await driver.writeChunk('up/file.bin', Readable.from(['def']), first, context);
		expect(second).toBe(6);

		await driver.finishChunkedUpload('up/file.bin', context);
		expect(readFileSync(join(root, 'up/file.bin'), 'utf8')).toBe('abcdef');
	});

	test('a failing stream rejects', async () => {
		await driver.createChunkedUpload('up/bad.bin', context);

		const failing = new Readable({
			read() {
				this.destroy(new Error('broken'));
			},
		});

		await expect(driver.writeChunk('up/bad.bin', failing, 0, context)).rejects.toBeUndefined();
	});

	test('delete removes the partial file', async () => {
		await driver.createChunkedUpload('up/tmp.bin', context);
		await driver.deleteChunkedUpload('up/tmp.bin', context);
		expect(await driver.exists('up/tmp.bin')).toBe(false);
	});
});
