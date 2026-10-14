// Copies the Directus 11.17.4 app strings into apps/web/src/lang as JSON and replaces the "Directus" brand with
// "Backoffice" (spec FR-062, FR-080, research R4). Run once with `nx run web:sync-translations`; the output is
// committed and sync-translations.test.ts checks that a new run gives the same bytes.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export const SOURCE_DIR = join(ROOT, 'directus/app/src/lang');
export const OUT_DIR = join(ROOT, 'apps/web/src/lang');
export const VERSION = '11.17.4';
export const LOCALES = ['en-US', 'vi-VN'];

// A value that names a technical identifier, a package, the directus.io site or the license is kept whole
// (no partial replacement), and so are the theme names of the shared theme_light/theme_dark data. `\s` because the
// source writes the license name with no-break spaces ("Directus\u00a0BSL\u00a01.1").
export const KEEP = [/directus_/, /@directus/, /directus\.io/, /Directus\sBSL/];
const KEEP_KEY = /^theme_directus_/;

/** Replaces "Directus" in every string of `value`; pushes the dotted keys it keeps unchanged into `kept`. */
export function rebrand(value, path, kept) {
	if (typeof value === 'string') {
		if (!value.includes('Directus')) return value;
		const key = path.at(-1) ?? '';

		if (KEEP_KEY.test(key) || KEEP.some((re) => re.test(value))) {
			kept.push(path.join('.'));
			return value;
		}

		return value.replaceAll('Directus', 'Backoffice');
	}

	if (Array.isArray(value)) return value.map((v, i) => rebrand(v, [...path, String(i)], kept));

	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebrand(v, [...path, k], kept)]));
	}

	return value;
}

const toJson = (data) => JSON.stringify(data, null, '\t') + '\n';

/** Converts the source YAML files into `outDir`; returns the kept keys ("<locale>.<dotted key>"). */
export function syncTranslations({ sourceDir = SOURCE_DIR, outDir = OUT_DIR } = {}) {
	const kept = [];
	const sha256 = {};

	const read = (file) => {
		const text = readFileSync(join(sourceDir, file), 'utf8');
		sha256[`directus/app/src/lang/${file}`] = createHash('sha256').update(text).digest('hex');
		return yaml.load(text);
	};

	const write = (file, data) => {
		mkdirSync(dirname(join(outDir, file)), { recursive: true });
		writeFileSync(join(outDir, file), toJson(data));
	};

	for (const locale of LOCALES) {
		write(`translations/${locale}.json`, rebrand(read(`translations/${locale}.yaml`), [locale], kept));
	}

	// Language names and Intl formats hold no brand: copied as they are.
	for (const name of ['available-languages', 'date-formats', 'number-formats']) {
		write(`${name}.json`, read(`${name}.yaml`));
	}

	write('translations/translations.meta.json', {
		source: 'directus/app/src/lang/translations',
		version: VERSION,
		sha256,
		kept,
	});

	return kept;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const kept = syncTranslations();
	/* eslint-disable no-console */
	console.log(`Kept unchanged (contain "Directus"), ${kept.length} key(s):`);
	for (const key of kept) console.log(`  ${key}`);
}
