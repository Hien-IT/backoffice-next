// Backoffice (spec 031, D-212): the folders of extensions/.upload form the `upload` map; the hidden folder is never read
// as a local extension (DR skips folders starting with a dot).
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const root = vi.hoisted(() => ({ dir: '' }));

vi.mock('@backoffice/env', () => ({
	useEnv: vi.fn(() => ({ PACKAGE_FILE_LOCATION: join(root.dir, 'none') })),
}));
vi.mock('./get-extensions-path.js', () => ({ getExtensionsPath: vi.fn(() => join(root.dir, 'extensions')) }));

const manifest = (name: string) =>
	JSON.stringify({
		name,
		version: '1.0.0',
		'directus:extension': { type: 'display', path: 'dist/index.js', source: 'src/index.js', host: '^11.0.0' },
	});

async function extension(folder: string, name: string) {
	await mkdir(join(root.dir, 'extensions', folder), { recursive: true });
	await writeFile(join(root.dir, 'extensions', folder, 'package.json'), manifest(name));
}

beforeEach(async () => {
	root.dir = await mkdtemp(join(tmpdir(), 'bo-get-ext-'));
	await mkdir(join(root.dir, 'none'));
	await writeFile(join(root.dir, 'none', 'package.json'), '{"name":"host"}');
});

afterEach(async () => {
	await rm(root.dir, { recursive: true, force: true });
});

test('a folder of .upload is in the upload map, keyed by its folder, and not in local', async () => {
	await extension('plain', 'plain-display');
	await extension('.upload/5c1f6c80-0000-4000-8000-000000000001', 'uploaded-display');

	const { getExtensions } = await import('./get-extensions.js');
	const { local, registry, upload } = await getExtensions();

	expect([...local.keys()]).toEqual(['plain']);
	expect(registry.size).toBe(0);
	expect([...upload.keys()]).toEqual(['5c1f6c80-0000-4000-8000-000000000001']);
	expect(upload.get('5c1f6c80-0000-4000-8000-000000000001')?.name).toBe('uploaded-display');
});

test('no .upload folder: an empty upload map', async () => {
	await extension('plain', 'plain-display');

	const { getExtensions } = await import('./get-extensions.js');
	const { upload } = await getExtensions();

	expect(upload.size).toBe(0);
});

test('a folder without package.json is not an extension (a package being copied, its package.json comes last)', async () => {
	await mkdir(join(root.dir, 'extensions', '.upload', 'partial', 'dist'), { recursive: true });

	const { getExtensions } = await import('./get-extensions.js');
	const { upload } = await getExtensions();

	expect(upload.size).toBe(0);
});
