// Backoffice (spec 031, D-212, contracts/tests.md §1): installFromStream on real tarballs (the committed fixtures of
// tests/fixtures/extensions and tarballs built here) in a temporary folder: the package lands in .upload/<folder>, every
// rejected package is a 400 with its reason and leaves no folder, nothing is written outside the temporary folder, the
// shared storage gets package.json last, and uninstall(folder, 'upload') removes the local and the shared copy.
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { create } from 'tar';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const root = vi.hoisted(() => ({ dir: '', location: undefined as string | undefined }));
const remote = vi.hoisted(() => ({ writes: [] as string[], deletes: [] as string[], files: new Map<string, string>() }));

// Getters: manager.ts reads the env once when it loads, the folder changes per test.
vi.mock('@backoffice/env', () => ({
	useEnv: vi.fn(() => ({
		get TEMP_PATH() {
			return join(root.dir, 'temp');
		},
		EXTENSIONS_PATH: 'extensions',
		get EXTENSIONS_LOCATION() {
			return root.location;
		},
	})),
}));
vi.mock('../../registry/index.js', () => ({ download: vi.fn() }));
vi.mock('../../../logger/index.js', () => ({ useLogger: vi.fn(() => ({ warn: vi.fn() })) }));
vi.mock('../get-extensions-path.js', () => ({ getExtensionsPath: vi.fn(() => join(root.dir, 'extensions')) }));
vi.mock('../../../storage/index.js', () => ({
	getStorage: vi.fn(async () => ({
		location: () => ({
			write: async (path: string, stream: Readable) => {
				const chunks: Buffer[] = [];
				for await (const chunk of stream) chunks.push(Buffer.from(chunk));
				remote.writes.push(path);
				remote.files.set(path, Buffer.concat(chunks).toString('utf-8'));
			},
			read: async (path: string) => {
				const text = remote.files.get(path);
				if (text === undefined) throw Object.assign(new Error('NoSuchKey'), { code: 'NoSuchKey' });
				return Readable.from([text]);
			},
			async *list(prefix: string) {
				for (const path of remote.files.keys()) if (path.startsWith(prefix)) yield path;
			},
			delete: async (path: string) => {
				remote.deletes.push(path);
				remote.files.delete(path);
			},
		}),
	})),
}));

const FIXTURES = join(import.meta.dirname, '../../../../../../tests/fixtures/extensions');
const ENDPOINT_TGZ = join(FIXTURES, 'parity-upload-endpoint', 'parity-upload-endpoint-1.0.0.tgz');
const BUNDLE_TGZ = join(FIXTURES, 'parity-upload-bundle', 'parity-upload-bundle-1.0.0.tgz');
const FOLDER = '5c1f6c80-0000-4000-8000-000000000031';

beforeEach(async () => {
	root.dir = await mkdtemp(join(tmpdir(), 'bo-upload-'));
	root.location = undefined;
	remote.writes = [];
	remote.deletes = [];
	remote.files.clear();
});

afterEach(async () => {
	await rm(root.dir, { recursive: true, force: true });
});

async function manager() {
	const { InstallationManager } = await import('./manager.js');
	return new InstallationManager();
}

// `any`: a manifest when it resolves, the error when it rejects (each test knows which).
async function upload(file: string, check?: (manifest: any) => void): Promise<any> {
	return (await manager()).installFromStream(createReadStream(file), FOLDER, check).catch((error: unknown) => error);
}

const installed = () => join(root.dir, 'extensions', '.upload', FOLDER);
/** Where an upload waits, hidden from the scan, until its row exists (activateUpload). */
const staged = () => join(root.dir, 'extensions', '.upload', `.${FOLDER}`);
/** What is left of the temp folders of uploads (their shared parent may stay, empty). */
const tempLeft = async () => {
	const parent = join(root.dir, 'temp', 'upload-extensions');
	return existsSync(parent) ? readdir(parent) : [];
};

/** A gzipped tarball of the `package/` folder written by `files` (relative path → content). */
async function tarball(files: Record<string, string>, entries = ['package']): Promise<string> {
	const src = join(root.dir, 'src');
	for (const [path, content] of Object.entries(files)) {
		await mkdir(join(src, path, '..'), { recursive: true });
		await writeFile(join(src, path), content);
	}
	const file = join(root.dir, 'built.tgz');
	await create({ file, cwd: src, gzip: true, portable: true, preservePaths: true }, entries);
	return file;
}

describe('a valid package', () => {
	test('is staged hidden in .upload/.<folder>, then activateUpload makes it .upload/<folder>; temp folder gone', async () => {
		const manifest = await upload(ENDPOINT_TGZ);

		expect(manifest).toMatchObject({ name: 'parity-upload-endpoint', 'directus:extension': { type: 'endpoint' } });
		expect(existsSync(join(staged(), 'package.json'))).toBe(true);
		expect(existsSync(installed())).toBe(false);
		expect(existsSync(join(root.dir, 'extensions', '.registry'))).toBe(false);
		expect(await tempLeft()).toEqual([]);

		await (await manager()).activateUpload(FOLDER);

		expect(existsSync(staged())).toBe(false);
		expect(existsSync(join(installed(), 'package.json'))).toBe(true);
		expect(existsSync(join(installed(), 'dist', 'index.js'))).toBe(true);
	});

	test('a bundle: the manifest lists its entries', async () => {
		const manifest = await upload(BUNDLE_TGZ);

		expect(manifest['directus:extension'].type).toBe('bundle');
		expect(manifest['directus:extension'].entries.map((entry: { name: string }) => entry.name)).toEqual([
			'upload-iface',
			'upload-display',
		]);
	});

	test('with a shared storage: every file is written under extensions/.upload/<folder>, package.json last', async () => {
		root.location = 's3';

		await upload(ENDPOINT_TGZ);

		expect(remote.writes.at(-1)).toBe(join('extensions', '.upload', FOLDER, 'package.json'));
		expect(remote.writes).toEqual(
			expect.arrayContaining([join('extensions', '.upload', FOLDER, 'dist', 'index.js')]),
		);
		expect(existsSync(join(staged(), 'package.json'))).toBe(true);
	});

	test('readUploadedName reads the name from the shared storage, or undefined when the folder is gone', async () => {
		root.location = 's3';
		await upload(ENDPOINT_TGZ);
		const installation = await manager();

		expect(await installation.readUploadedName(FOLDER)).toBe('parity-upload-endpoint');
		expect(await installation.readUploadedName('missing')).toBeUndefined();
	});

	test('uninstall(folder, "upload") removes the local folder, staged or not, and every shared file', async () => {
		root.location = 's3';
		await upload(ENDPOINT_TGZ);

		await (await manager()).uninstall(FOLDER, 'upload');

		expect(existsSync(staged())).toBe(false);
		expect(existsSync(installed())).toBe(false);
		expect([...remote.files.keys()]).toEqual([]);
		expect(remote.deletes.length).toBeGreaterThan(1);
	});
});

describe('a rejected package: a 400 with its reason, no folder, the temp folder removed', () => {
	async function rejected(file: string, reason: RegExp, check?: (manifest: any) => void) {
		root.location = 's3';
		const error = (await upload(file, check)) as { status?: number; extensions?: { reason: string } };

		expect(error.status).toBe(400);
		expect(error.extensions?.reason).toMatch(reason);
		expect(existsSync(installed())).toBe(false);
		expect(existsSync(staged())).toBe(false);
		expect(remote.writes).toEqual([]);
		expect(await tempLeft()).toEqual([]);
	}

	test('a file that is not a tar', async () => {
		await rejected(join(FIXTURES, 'parity-upload-endpoint', 'package.json'), /not a gzipped tar archive/);
	});

	test('a tarball without package/package.json', async () => {
		await rejected(await tarball({ 'other/package.json': '{}' }, ['other']), /package\/package\.json is missing/);
	});

	test('a package.json that is not JSON', async () => {
		await rejected(await tarball({ 'package/package.json': '{' }), /not valid JSON/);
	});

	test('a manifest without a valid directus:extension', async () => {
		const file = await tarball({
			'package/package.json': JSON.stringify({ name: 'x', version: '1.0.0', 'directus:extension': { path: 'a' } }),
		});
		await rejected(file, /^Invalid extension manifest: /);
	});

	test('the check of the caller (name, sandbox, limit) runs before anything is copied', async () => {
		const { InvalidPayloadError } = await import('@backoffice/errors');
		await rejected(ENDPOINT_TGZ, /already installed/, () => {
			throw new InvalidPayloadError({ reason: 'An extension named "parity-upload-endpoint" is already installed' });
		});
	});
});

describe('nothing is written outside the temporary folder (research T001a)', () => {
	test('a `..` entry is refused or kept inside: nothing appears where it points', async () => {
		const outside = join(root.dir, 'outside.txt');
		await writeFile(outside, 'x');
		const file = await tarball(
			{
				'package/package.json': JSON.stringify({
					name: 'evil',
					version: '1.0.0',
					'directus:extension': { type: 'display', path: 'dist/index.js', source: 'src/index.js', host: '^11.0.0' },
				}),
			},
			['package', '../outside.txt'],
		);
		await rm(outside);

		await upload(file);

		expect(existsSync(outside)).toBe(false);
	});

	test('a symlink in the package is dropped, so no later copy follows it out of the folder', async () => {
		const src = join(root.dir, 'src');
		const outside = join(root.dir, 'secret');
		await mkdir(outside);
		await writeFile(join(outside, 'secret.txt'), 'secret');
		await mkdir(join(src, 'package', 'dist'), { recursive: true });
		await writeFile(
			join(src, 'package', 'package.json'),
			JSON.stringify({
				name: 'linked',
				version: '1.0.0',
				'directus:extension': { type: 'display', path: 'dist/index.js', source: 'src/index.js', host: '^11.0.0' },
			}),
		);
		await writeFile(join(src, 'package', 'dist', 'index.js'), 'export default {};');
		await symlink(outside, join(src, 'package', 'link'));
		const file = join(root.dir, 'linked.tgz');
		await create({ file, cwd: src, gzip: true, portable: true }, ['package']);
		root.location = 's3';

		await upload(file);

		expect(existsSync(join(installed(), 'link'))).toBe(false);
		expect([...remote.files.keys()].some((path) => path.includes('secret'))).toBe(false);
	});
});
