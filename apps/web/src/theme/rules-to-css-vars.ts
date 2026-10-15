// Ported from directus/packages/themes/src/utils/rules-to-css-vars.ts
// Backoffice: `flat` and `decamelize` are not dependencies of apps/web (research R6); the rules are flattened with `--`
// by a small recursion and decamelized with the two decamelize regexes (separator `-`).
import type { DeepPartial, Theme } from '@directus/types';

const decamelize = (text: string) =>
	text
		.replace(/([\p{Ll}\d])(\p{Lu})/gu, '$1-$2')
		.replace(/(\p{Lu})(\p{Lu}\p{Ll}+)/gu, '$1-$2')
		.toLowerCase();

function flatten(value: Record<string, unknown>, prefix: string, out: Record<string, string | number>) {
	for (const [key, child] of Object.entries(value)) {
		const path = prefix ? `${prefix}--${key}` : key;

		if (child && typeof child === 'object') flatten(child as Record<string, unknown>, path, out);
		else out[path] = child as string | number;
	}

	return out;
}

export const rulesToCssVars = (rules: DeepPartial<Theme['rules']>): Record<string, string | number> => {
	const flattened = flatten(rules as Record<string, unknown>, '', {});

	return Object.fromEntries(Object.entries(flattened).map(([key, value]) => [`--theme--${decamelize(key)}`, value]));
};
