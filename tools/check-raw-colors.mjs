// FR-092 (feature 012, constitution XII 2.0.0): apps/web takes colors from the TailAdmin theme of the design-system
// only. Fails on raw hex, rgb()/hsl() and classes of the Tailwind palette the theme does not define (red-*, sky-*...;
// the theme's brand, gray, blue-light, orange, success, warning, error, white and black are fine) in
// apps/web/src/**/*.{vue,css,ts}, except the theme file and tests.
// A line may opt out with a `raw-color-allowed: <reason>` comment (for example a canvas color that is data).
// Usage: node tools/check-raw-colors.mjs [root]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Tailwind's default palette minus the names the TailAdmin theme redefines (gray, orange); `blue-light-*` is a theme
// color and does not match `blue-<number>`.
const PALETTE =
	'slate|zinc|neutral|stone|red|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const UTILITY = 'bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|shadow|accent|caret|decoration';

export const RULES = [
	{ name: 'hex color', pattern: /#[0-9a-fA-F]{3,8}\b/ },
	{ name: 'rgb()/hsl() color', pattern: /\b(rgba?|hsla?)\(/ },
	{
		name: 'Tailwind palette class',
		pattern: new RegExp(`(?<![\\w-])(${UTILITY})-(${PALETTE})-\\d{2,3}(?![\\w-])`),
	},
];

const EXCLUDED = ['src/styles/theme.css'];

function* files(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else if (/\.(vue|css|ts)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) yield path;
	}
}

export function checkRawColors(root) {
	const app = join(root, 'apps/web');
	const errors = [];
	let count = 0;

	if (!existsSync(join(app, 'src'))) return { count, errors };

	for (const file of files(join(app, 'src'))) {
		const name = relative(app, file);
		if (EXCLUDED.includes(name)) continue;
		count++;

		readFileSync(file, 'utf8')
			.split('\n')
			.forEach((line, index) => {
				if (line.includes('raw-color-allowed:')) return;

				for (const rule of RULES) {
					const match = rule.pattern.exec(line);
					if (match) errors.push(`apps/web/${name}:${index + 1}: ${rule.name} "${match[0]}"`);
				}
			});
	}

	return { count, errors };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const { count, errors } = checkRawColors(resolve(process.argv[2] ?? '.'));

	for (const e of errors) console.error(e);
	console.log(`check-raw-colors: ${count} file(s), ${errors.length} error(s)`);
	process.exit(errors.length ? 1 : 0);
}
