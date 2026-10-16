// Copies the preview images of the Directus 11.17.4 interfaces (`directus/app/src/interfaces/<id>/preview.svg`, the
// `preview` of their index.ts) next to the ported interfaces (`src/interfaces/<id>/preview.svg`), for the interface
// cards of the field drawer (spec 016 FR-033, CHK001). The files are copied as they are: their colors are the Directus
// theme variables `--theme--primary` and `--theme--background`, which the cards map to theme tokens; the black and white
// fills are mask values. `node scripts/sync-interface-previews.mjs`; scripts/sync-interface-previews.test.ts checks that
// the committed files equal the sources.
import { copyFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const SOURCE = join(ROOT, 'directus/app/src/interfaces');
export const TARGET = join(ROOT, 'apps/web/src/interfaces');

/** Ids that have a Directus preview and a ported interface folder. */
export function previewIds() {
	return readdirSync(SOURCE)
		.filter((id) => existsSync(join(SOURCE, id, 'preview.svg')) && existsSync(join(TARGET, id, 'index.ts')))
		.sort();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	for (const id of previewIds()) copyFileSync(join(SOURCE, id, 'preview.svg'), join(TARGET, id, 'preview.svg'));
	process.stdout.write(`sync-interface-previews: ${previewIds().length} preview(s)\n`);
}
