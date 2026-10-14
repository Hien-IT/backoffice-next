// Theme overrides of settings and user (Directus theme rule keys, `DeepPartial<Theme['rules']>` of @directus/themes)
// turned into theme variables of the design-system (FR-063, D-43). Keys without a token and values that are not plain CSS
// values are dropped, with one console warning per key.
import { isPlainObject } from 'lodash-es';

// Directus keys mapped to the TailAdmin theme variables of design-system/tokens/theme.css (spec FR-063, D-43).
export const OVERRIDE_MAP: Readonly<Record<string, string>> = {
	primary: '--color-brand-500',
	success: '--color-success-500',
	warning: '--color-warning-500',
	danger: '--color-error-500',
	'fonts.sans.fontFamily': '--font-outfit',
};

// No `;`, `{`, `}`, `<`, `/`, `:` or `_`: a value cannot close the declaration or the style element (CHK077).
const SAFE_VALUE = /^[#a-zA-Z0-9(),.%\s"'-]+$/;

const warned = new Set<string>();

function warnOnce(key: string, reason: string) {
	if (warned.has(key)) return;
	warned.add(key);
	// eslint-disable-next-line no-console
	console.warn(`[theme] override "${key}" ignored: ${reason}`);
}

/** Leaves of nested objects as [dot.path, value]; arrays and scalars are leaves. */
function flatten(value: unknown, prefix = ''): [string, unknown][] {
	if (!isPlainObject(value)) return [];

	return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
		const path = prefix + key;
		return isPlainObject(child) ? flatten(child, `${path}.`) : [[path, child] as [string, unknown]];
	});
}

/**
 * CSS rule setting the mapped tokens of `overrides` on `scope`, or '' when nothing applies. The light scope is
 * `:root.light` (not `:root`) so light overrides do not leak into the dark theme for tokens it does not redefine.
 */
export function overridesToCss(overrides: unknown, scope: ':root.light' | ':root.dark'): string {
	const declarations: string[] = [];

	for (const [key, value] of flatten(overrides)) {
		const token = OVERRIDE_MAP[key];

		if (!token) {
			warnOnce(key, 'no design-system theme variable');
			continue;
		}

		const text = typeof value === 'number' ? String(value) : value;

		if (typeof text !== 'string' || !text.trim() || text.includes('var(--theme--') || !SAFE_VALUE.test(text)) {
			warnOnce(key, 'unsupported value');
			continue;
		}

		declarations.push(`${token}: ${text.trim()};`);
	}

	return declarations.length ? `${scope} { ${declarations.join(' ')} }` : '';
}
