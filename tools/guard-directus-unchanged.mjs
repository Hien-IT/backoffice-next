// FR-111: fails when the branch changes anything under directus/ (the reference source is read-only).
// Usage: node tools/guard-directus-unchanged.mjs [base]   (base defaults to origin/main)
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Paths under directus/ changed between `base` and HEAD (three-dot diff: changes made on this branch). */
export function changedDirectusFiles(base, cwd = process.cwd()) {
	const output = execFileSync('git', ['diff', '--name-only', '--no-renames', `${base}...HEAD`], {
		cwd,
		encoding: 'utf8',
	});
	return output.split('\n').filter((path) => path.startsWith('directus/'));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const base = process.argv[2] ?? 'origin/main';
	const changed = changedDirectusFiles(base);

	for (const path of changed) console.error(`directus/ must not change: ${path}`);
	console.log(`guard-directus-unchanged: ${changed.length} changed file(s) under directus/ since ${base}`);
	process.exit(changed.length ? 1 : 0);
}
