// Feature 010 (T050): ExtensionsService.readAll without an extension manager (D-37).
import { beforeEach, expect, test, vi } from 'vitest';
import { ExtensionsService } from './extensions.service.js';
import { ItemsService } from './items.service.js';

vi.mock('./items.service.js', () => ({
	ItemsService: vi.fn(function () {
		return { readByQuery: vi.fn() };
	}),
}));

const schema = { collections: {}, relations: [] } as any;

beforeEach(() => vi.clearAllMocks());

const service = (accountability: any = null) => new ExtensionsService({ knex: {} as any, schema, accountability });
const rows = (s: ExtensionsService) => vi.mocked(s.extensionsItemService.readByQuery);

test('the rows of directus_extensions are read with the caller accountability, all of them', async () => {
	const accountability = { user: 'u', role: null, admin: false } as any;
	const s = service(accountability);
	rows(s).mockResolvedValue([]);

	expect(await s.readAll()).toEqual([]);
	expect(ItemsService).toHaveBeenCalledWith('directus_extensions', { knex: {}, schema, accountability });
	expect(rows(s)).toHaveBeenCalledWith({ limit: -1 });
});

test('a row without bundle → schema null (no extension is loaded); a bundled row is dropped', async () => {
	const s = service();
	const regular = { id: 'a', enabled: true, folder: 'x', source: 'registry', bundle: null };
	const bundled = { id: 'b', enabled: true, folder: 'y', source: 'registry', bundle: 'a' };
	rows(s).mockResolvedValue([regular, bundled]);

	expect(await s.readAll()).toEqual([{ id: 'a', bundle: null, meta: regular, schema: null }]);
});
