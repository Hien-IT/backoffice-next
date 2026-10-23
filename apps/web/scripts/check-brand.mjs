// FR-030, FR-082 (feature 012): no "DR" the user could see in apps/web/src. Comments (`Ported from`, notes
// about DR behaviour), identifiers such as createDirectus and tests are ignored; translations/*.json are checked by sync-translations.test.ts.
// JSON data is checked too (feature 015), except the files in PATH_EXCEPTIONS.
// Usage: node scripts/check-brand.mjs [srcDir]
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const keepLines = (comment) => comment.replace(/[^\n]/g, '');

/** Removes block, HTML and line comments, keeping line numbers (a `//` preceded by `:` is a URL, not a comment). */
export function stripComments(source) {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, keepLines)
		.replace(/<!--[\s\S]*?-->/g, keepLines)
		.replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

// Paths relative to srcDir. lang/translations/: sync-translations.test.ts checks them. theme/theme-presets.json:
// generated theme data whose ids ("DR Default"...) are stored in directus_users and directus_settings (spec 015
// D-88, D-89, principle IX); the labels shown come from the theme_directus_* translation keys.
export const PATH_EXCEPTIONS = [
	/^lang\/translations\//,
	/^theme\/theme-presets\.json$/,
	/^permissions\/app-permissions-data\.json$/,
];

function* files(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else if (/\.(vue|ts|css|html|svg|json)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) yield path;
	}
}

export function checkBrand(srcDir) {
	const errors = [];

	for (const file of files(srcDir)) {
		if (PATH_EXCEPTIONS.some((re) => re.test(relative(srcDir, file).split(sep).join('/')))) continue;

		const source = readFileSync(file, 'utf8');
		const original = source.split('\n');

		stripComments(source)
			.split('\n')
			.forEach((line, index) => {
				// A line that compares API data with a DR value says so with `brand-allowed: <reason>`.
				if (original[index]?.includes('brand-allowed:')) return;
				if (/(?<![A-Za-z])Directus(?![A-Za-z])/.test(line))
					errors.push(`${relative(srcDir, file)}:${index + 1}: ${line.trim()}`);
			});
	}

	return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const srcDir = resolve(process.argv[2] ?? join(fileURLToPath(new URL('.', import.meta.url)), '../src'));
	const errors = checkBrand(srcDir);

	for (const e of errors) process.stderr.write(`${e}\n`);
	process.stdout.write(`check-brand: ${errors.length} line(s) with "Directus"\n`);
	process.exit(errors.length ? 1 : 0);
}
