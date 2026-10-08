// Ported from directus/packages/env/src/utils/read-configuration-from-javascript.ts
import { createRequire } from 'node:module';
import { isPlainObject } from 'lodash-es';

export const readConfigurationFromJavaScript = (path: string): Record<string, unknown> => {
	const require = createRequire(import.meta.url);

	const module = require(path);

	if (typeof module === 'object' || typeof module === 'function') {
		const exported = 'default' in module ? module.default : module;

		if (typeof exported === 'function') {
			return exported(process.env) as Record<string, unknown>;
		}

		if (isPlainObject(exported)) {
			return exported as Record<string, unknown>;
		}
	}

	// Directus reads `typeof exported` outside the block where it is declared, which is always "undefined";
	// keep that exact message (measured, contracts/config.md §4).
	throw new Error(
		`Invalid JS configuration file export type. Requires one of "function", "object", received: "undefined"`,
	);
};
