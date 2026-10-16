// Feature 015 (FR-001, data-model §1): the routes of directus/app/src/modules/files/index.ts.
import { describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';
import files from './files.ts';

// router.push loads the lazy route components; their module graph can take over 5 s on a loaded CI runner.
vi.mock('./files/routes/FilesCollectionRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./files/routes/AddNewFile.vue', () => ({ default: { render: () => null } }));
vi.mock('./files/routes/FileItemRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./content/routes/ContentNotFound.vue', () => ({ default: { render: () => null } }));

function router() {
	return createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/files', children: files.routes as RouteRecordRaw[], component: { render: () => null } }],
	});
}

async function resolve(path: string) {
	const r = router();
	await r.push(path);
	return r.currentRoute.value;
}

describe('files module routes', () => {
	test('library, add file, folder and folder add file', async () => {
		expect((await resolve('/files')).name).toBe('files-collection');
		expect((await resolve('/files/+')).name).toBe('add-file');
		expect((await resolve('/files/+')).meta['isFloatingView']).toBe(true);
		expect((await resolve('/files/folders/f1')).name).toBe('folders-collection');
		expect((await resolve('/files/folders/f1')).params['folder']).toBe('f1');
		expect((await resolve('/files/folders/f1/+')).name).toBe('add-file-folder');
	});

	test('/files/folders redirects to the library; special views pass `special`', async () => {
		expect((await resolve('/files/folders')).fullPath).toBe('/files');

		for (const special of ['all', 'mine', 'recent']) {
			const route = await resolve(`/files/${special}`);
			expect(route.matched.at(-1)!.props['default']).toEqual({ special });
		}
	});

	test('a key opens the file; deeper paths are the module not-found page', async () => {
		const item = await resolve('/files/abc');
		expect(item.name).toBe('files-item');
		expect(item.params['primaryKey']).toBe('abc');

		const missing = await resolve('/files/abc/def');
		expect(missing.name).toBe('files-not-found');
		expect(missing.matched.at(-1)!.props['default']).toEqual({ module: 'files' });
	});

	test('module entry: id, icon, name and the read check of directus_files', () => {
		expect(files).toMatchObject({ id: 'files', icon: 'folder', name: '$t:file_library' });
		const check = files.preRegisterCheck!;
		expect(check({ admin_access: false } as never, { directus_files: { read: { access: 'partial' } } } as never)).toBe(true);
		expect(check({ admin_access: false } as never, {} as never)).toBe(false);
		expect(check({ admin_access: true } as never, {} as never)).toBe(true);
	});
});
