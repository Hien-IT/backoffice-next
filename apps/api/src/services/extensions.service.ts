// Backoffice: no extension manager (Principle XI, D-37). Only the read of directus_extensions from
// directus/api/src/services/extensions.ts: no extension is loaded, so `schema` is null; a bundled row is dropped like
// Directus drops it when its parent bundle has no schema. install, reinstall, uninstall, updateOne and deleteOne do
// not exist (the controller answers 503 or 403).
import type { AbstractServiceOptions } from '@backoffice/types';
import { ItemsService } from './items.service.js';

/**
 * The app extension bundle Directus builds with rollup from an entrypoint that registers no extension (research R6
 * of spec 010), byte for byte.
 */
export const EMPTY_APP_EXTENSION_BUNDLE =
	'const interfaces = [];const displays = [];const layouts = [];const modules = [];const panels = [];const themes = [];const operations = [];\n\nexport { displays, interfaces, layouts, modules, operations, panels, themes };\n';

export class ExtensionsService {
	extensionsItemService: ItemsService;

	constructor(options: AbstractServiceOptions) {
		this.extensionsItemService = new ItemsService('directus_extensions', {
			knex: options.knex,
			schema: options.schema,
			accountability: options.accountability || null,
		});
	}

	async readAll() {
		const settings = await this.extensionsItemService.readByQuery({ limit: -1 });

		return settings
			.filter(({ bundle }) => bundle === null)
			.map((meta) => ({ id: meta['id'], bundle: meta['bundle'], meta, schema: null }));
	}
}
