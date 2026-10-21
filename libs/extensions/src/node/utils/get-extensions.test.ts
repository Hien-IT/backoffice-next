import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { getExtensionDefinition, resolveFsExtensions, resolveModuleExtensions } from './get-extensions.js';

let root: string;

function write(dir: string, manifest: unknown) {
	mkdirSync(join(root, dir), { recursive: true });
	writeFileSync(join(root, dir, 'package.json'), JSON.stringify(manifest));
}

const hook = {
	name: 'demo-hook',
	version: '1.0.0',
	'directus:extension': { type: 'hook', path: 'dist/index.js', source: 'src/index.ts', host: '^11.0.0' },
};

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'extensions-'));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('getExtensionDefinition', () => {
	test('maps each extension type like Directus', () => {
		const meta = { path: '/x', local: true };

		expect(getExtensionDefinition(hook as never, meta)).toEqual({
			path: '/x',
			name: 'demo-hook',
			version: '1.0.0',
			type: 'hook',
			entrypoint: 'dist/index.js',
			host: '^11.0.0',
			sandbox: undefined,
			local: true,
		});

		const operation = getExtensionDefinition(
			{
				name: 'op',
				version: '1.0.0',
				'directus:extension': {
					type: 'operation',
					path: { app: 'dist/app.js', api: 'dist/api.js' },
					source: { app: 'src/app.ts', api: 'src/api.ts' },
					host: '^11.0.0',
					sandbox: { enabled: true, requestedScopes: { log: {} } },
				},
			} as never,
			meta,
		);

		expect(operation).toMatchObject({
			type: 'operation',
			entrypoint: { app: 'dist/app.js', api: 'dist/api.js' },
			sandbox: { enabled: true, requestedScopes: { log: {} } },
		});

		const bundle = getExtensionDefinition(
			{
				name: 'bundle',
				version: '1.0.0',
				'directus:extension': {
					type: 'bundle',
					partial: true,
					path: { app: 'dist/app.js', api: 'dist/api.js' },
					entries: [{ type: 'interface', name: 'one', source: 'src/one' }],
					host: '^11.0.0',
				},
			} as never,
			meta,
		);

		expect(bundle).toMatchObject({ type: 'bundle', partial: true, entries: [{ type: 'interface', name: 'one' }] });

		const app = getExtensionDefinition(
			{
				name: 'iface',
				version: '1.0.0',
				'directus:extension': { type: 'interface', path: 'dist/index.js', source: 'src/index.ts', host: '^11.0.0' },
			} as never,
			meta,
		);

		expect(app).toMatchObject({ type: 'interface', entrypoint: 'dist/index.js' });
	});
});

describe('resolveFsExtensions', () => {
	test('returns an empty map for a missing folder', async () => {
		expect((await resolveFsExtensions(join(root, 'missing'))).size).toBe(0);
	});

	test('reads folders, skips hidden folders and folders without package.json', async () => {
		write('demo-hook', hook);
		write('.registry/abc', hook);
		mkdirSync(join(root, 'empty'));

		const map = await resolveFsExtensions(root);

		expect([...map.keys()]).toEqual(['demo-hook']);
		expect(map.get('demo-hook')).toMatchObject({ name: 'demo-hook', local: true, path: join(root, 'demo-hook') });
	});

	test('throws on an invalid manifest', async () => {
		write('broken', { name: 'broken', version: '1.0.0', 'directus:extension': { type: 'hook' } });

		await expect(resolveFsExtensions(root)).rejects.toThrow('The manifest of the extension "broken"');
	});
});

describe('resolveModuleExtensions', () => {
	test('throws without package.json', async () => {
		await expect(resolveModuleExtensions(root)).rejects.toThrow('does not contain a package.json file');
	});

	test('keeps dependencies with a directus:extension key', async () => {
		writeFileSync(
			join(root, 'package.json'),
			JSON.stringify({ dependencies: { 'demo-hook': '1.0.0', 'plain-lib': '1.0.0', missing: '1.0.0' } }),
		);

		write('node_modules/demo-hook', hook);
		write('node_modules/plain-lib', { name: 'plain-lib', version: '1.0.0' });

		const map = await resolveModuleExtensions(root);

		expect([...map.keys()]).toEqual(['demo-hook']);
	});

	test('throws on an invalid package extension manifest', async () => {
		writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { bad: '1.0.0' } }));
		write('node_modules/bad', { name: 'bad', version: '1.0.0', 'directus:extension': { type: 'nope' } });

		await expect(resolveModuleExtensions(root)).rejects.toThrow('The manifest of the package extension "bad"');
	});
});
