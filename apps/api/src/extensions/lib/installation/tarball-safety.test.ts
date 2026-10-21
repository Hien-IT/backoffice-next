// Spec 020 (R-68, T172): a registry tarball cannot write outside the temporary folder of the install. The real
// InstallationManager and tar 7 extract run on tarballs with an absolute path, a `..` path and a symlink pointing out of
// the folder followed by a file through it; the download is mocked, the files live in a temporary directory.
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { create, list, replace } from 'tar';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { download } from '../../registry/index.js';

const root = vi.hoisted(() => ({ dir: '' }));

// Getters: manager.ts reads the env once when it loads, the folder changes per test.
vi.mock('@backoffice/env', () => ({
	useEnv: vi.fn(() => ({
		get TEMP_PATH() {
			return join(root.dir, 'temp');
		},
		get EXTENSIONS_PATH() {
			return join(root.dir, 'extensions');
		},
	})),
}));
vi.mock('../../registry/index.js', () => ({ download: vi.fn() }));
vi.mock('../../../logger/index.js', () => ({ useLogger: vi.fn(() => ({ warn: vi.fn() })) }));
vi.mock('../get-extensions-path.js', () => ({ getExtensionsPath: vi.fn(() => join(root.dir, 'extensions')) }));

const MANIFEST = JSON.stringify({
	name: 'evil',
	version: '1.0.0',
	'directus:extension': { type: 'hook', path: 'dist/index.js', source: 'src/index.js', host: '^11.0.0' },
});

beforeEach(async () => {
	root.dir = await mkdtemp(join(tmpdir(), 'bo-tar-'));
});

afterEach(async () => {
	await rm(root.dir, { recursive: true, force: true });
});

/** A gzipped tarball of `entries` (paths relative to `cwd`, `..` and absolute paths kept), appended in order. */
async function tarball(parts: { cwd: string; entries: string[] }[]): Promise<string> {
	const file = join(root.dir, 'evil.tar');
	for (const [index, { cwd, entries }] of parts.entries()) {
		const options = { file, cwd, preservePaths: true, portable: true };
		if (index === 0) await create(options, entries);
		else await replace(options, entries);
	}
	return file;
}

/** The entry paths of `file` (to check the tarball holds the hostile entries). */
async function entries(file: string): Promise<string[]> {
	const paths: string[] = [];
	await list({ file, onReadEntry: (entry) => void paths.push(entry.path) });
	return paths;
}

async function install(file: string) {
	const { createReadStream } = await import('node:fs');
	const { createGzip } = await import('node:zlib');
	vi.mocked(download).mockResolvedValue(Readable.toWeb(createReadStream(file).pipe(createGzip())) as never);
	const { InstallationManager } = await import('./manager.js');
	return new InstallationManager().install('5c1f6c80-0000-4000-8000-000000000000').catch((error: unknown) => error);
}

async function packageDir() {
	const src = join(root.dir, 'src');
	await mkdir(join(src, 'package', 'dist'), { recursive: true });
	await writeFile(join(src, 'package', 'package.json'), MANIFEST);
	await writeFile(join(src, 'package', 'dist', 'index.js'), 'export default () => {};');
	return src;
}

test('an absolute path and a `..` path are written inside the temporary folder, not where they point', async () => {
	const src = await packageDir();
	const outside = join(root.dir, 'outside');
	await mkdir(join(src, 'nested'), { recursive: true });
	await writeFile(join(root.dir, 'dotdot.txt'), 'x');
	await mkdir(outside);
	await writeFile(join(outside, 'absolute.txt'), 'x');

	const file = await tarball([
		{ cwd: src, entries: ['package'] },
		{ cwd: join(src, 'nested'), entries: ['../../dotdot.txt'] },
		{ cwd: src, entries: [join(outside, 'absolute.txt')] },
	]);
	expect(await entries(file)).toEqual(expect.arrayContaining(['../../dotdot.txt', join(outside, 'absolute.txt')]));
	await rm(join(root.dir, 'dotdot.txt'));
	await rm(join(outside, 'absolute.txt'));

	await install(file);

	expect(existsSync(join(root.dir, 'dotdot.txt'))).toBe(false);
	expect(existsSync(join(outside, 'absolute.txt'))).toBe(false);
	expect(existsSync(join(root.dir, 'extensions', '.registry'))).toBe(true);
});

test('a symlink out of the folder, then a file through it: nothing is written outside', async () => {
	const src = await packageDir();
	const outside = join(root.dir, 'outside');
	await mkdir(outside);
	await symlink(outside, join(src, 'package', 'link'));

	const through = join(root.dir, 'through');
	await mkdir(join(through, 'package', 'link'), { recursive: true });
	await writeFile(join(through, 'package', 'link', 'evil.txt'), 'x');

	const file = await tarball([
		{ cwd: src, entries: ['package'] },
		{ cwd: through, entries: ['package/link/evil.txt'] },
	]);

	expect(await entries(file)).toEqual(expect.arrayContaining(['package/link', 'package/link/evil.txt']));

	await install(file);

	expect(existsSync(join(outside, 'evil.txt'))).toBe(false);
});
