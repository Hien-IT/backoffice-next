import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { KEEP, OUT_DIR, rebrand, syncTranslations } from './sync-translations.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'sync-translations-'));
const kept: string[] = syncTranslations({ outDir: tmp });

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const files = (dir: string, prefix = ''): string[] =>
	readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? files(dir, join(prefix, e.name)) : [join(prefix, e.name)],
	);

function strings(value: unknown, path: string[], out: [string, string][] = []): [string, string][] {
	if (typeof value === 'string') out.push([path.join('.'), value]);
	else if (value && typeof value === 'object') {
		for (const [k, v] of Object.entries(value)) strings(v, [...path, k], out);
	}

	return out;
}

describe('sync-translations', () => {
	test('a new run gives the committed files byte for byte', () => {
		const generated = files(tmp).sort();
		const committed = files(OUT_DIR)
			.filter((f) => f.endsWith('.json'))
			.sort();

		expect(generated).toEqual(committed);

		for (const file of generated) {
			expect(readFileSync(join(tmp, file), 'utf8'), file).toBe(readFileSync(join(OUT_DIR, file), 'utf8'));
		}
	});

	test('no "Directus" left outside the kept list, and each kept value is a technical name or the license', () => {
		for (const locale of ['en-US', 'vi-VN']) {
			const data = JSON.parse(readFileSync(join(tmp, `translations/${locale}.json`), 'utf8'));

			for (const [key, value] of strings(data, [locale])) {
				if (!value.includes('Directus')) continue;
				expect(kept, key).toContain(key);
				expect(/\.theme_directus_/.test(key) || KEEP.some((re) => re.test(value)), key).toBe(true);
			}
		}

		const meta = JSON.parse(readFileSync(join(tmp, 'translations/translations.meta.json'), 'utf8'));
		expect(meta.kept).toEqual(kept);
		expect(meta.version).toBe('11.17.4');
	});

	test('a value with a kept pattern is kept whole, others are replaced everywhere', () => {
		const out: string[] = [];
		const result = rebrand(
			{ a: 'Launch Directus', b: { c: 'Your Directus data in directus_users' }, theme_directus_x: 'Directus X', n: 1 },
			['en-US'],
			out,
		);

		expect(result).toEqual({
			a: 'Launch Backoffice',
			b: { c: 'Your Directus data in directus_users' },
			theme_directus_x: 'Directus X',
			n: 1,
		});

		expect(out).toEqual(['en-US.b.c', 'en-US.theme_directus_x']);
	});
});
