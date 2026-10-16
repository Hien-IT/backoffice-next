// The committed interface previews equal the Directus 11.17.4 sources (spec 016 FR-033, CHK001).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { previewIds, SOURCE, TARGET } from './sync-interface-previews.mjs';

describe('sync-interface-previews', () => {
	test('every Directus preview of a ported interface is committed unchanged', () => {
		const ids = previewIds();

		expect(ids).toHaveLength(40);
		for (const id of ids) {
			expect(readFileSync(join(TARGET, id, 'preview.svg'), 'utf8'), id).toBe(
				readFileSync(join(SOURCE, id, 'preview.svg'), 'utf8'),
			);
		}
	});
});
