// FR-002: every workspace package (apps/*, libs/*, tests/*) is named @backoffice/*, and no package.json depends on
// @directus/* except the third-party packages allowed below.
// Usage: node tools/check-package-names.mjs [root]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** @directus/* packages a Backoffice app may use as ordinary third-party libraries. */
export const ALLOWED_DIRECTUS_PACKAGES = ['@directus/sdk', '@directus/format-title'];

/** apps/web only: same versions as Directus 11.17.4 so the shared helpers and types behave like the Directus app
 * (feature 013 plan, research R1); the split panel of the live preview (feature 014, research R1). */
export const WEB_ONLY_DIRECTUS_PACKAGES = ['@directus/utils', '@directus/types', '@directus/vue-split-panel'];

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

export function checkPackageNames(root) {
	const errors = [];
	const files = ['package.json'];

	for (const group of ['apps', 'libs', 'tests']) {
		if (!existsSync(join(root, group))) continue;

		for (const entry of readdirSync(join(root, group), { withFileTypes: true })) {
			if (entry.isDirectory() && existsSync(join(root, group, entry.name, 'package.json'))) {
				files.push(join(group, entry.name, 'package.json'));
			}
		}
	}

	for (const file of files) {
		const pkg = JSON.parse(readFileSync(join(root, file), 'utf8'));

		if (file !== 'package.json' && !pkg.name?.startsWith('@backoffice/')) {
			errors.push(`${file}: name "${pkg.name}" must start with @backoffice/`);
		}

		for (const field of DEPENDENCY_FIELDS) {
			for (const dep of Object.keys(pkg[field] ?? {})) {
				const allowed =
					ALLOWED_DIRECTUS_PACKAGES.includes(dep) ||
					(file === join('apps', 'web', 'package.json') && WEB_ONLY_DIRECTUS_PACKAGES.includes(dep));

				if (dep.startsWith('@directus/') && !allowed) {
					errors.push(`${file}: ${field} must not use ${dep}`);
				}
			}
		}
	}

	return { count: files.length, errors };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const { count, errors } = checkPackageNames(resolve(process.argv[2] ?? '.'));

	for (const e of errors) console.error(e);
	console.log(`check-package-names: ${count} package.json file(s), ${errors.length} error(s)`);
	process.exit(errors.length ? 1 : 0);
}
