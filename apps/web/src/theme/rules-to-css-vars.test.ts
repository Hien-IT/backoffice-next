// Same output as rulesToCssVars of @directus/themes (flat with `--`, decamelize with `-`).
import { expect, test } from 'vitest';
import { rulesToCssVars } from './rules-to-css-vars.ts';

test('nested rules become --theme-- variables in kebab case', () => {
	expect(rulesToCssVars({ fonts: { display: { fontFamily: '"Inter", system-ui' } } } as never)).toEqual({
		'--theme--fonts--display--font-family': '"Inter", system-ui',
	});

	expect(
		rulesToCssVars({
			navigation: { modules: { button: { backgroundActive: '#fff' } } },
			borderColorAccent: 'x',
		} as never),
	).toEqual({
		'--theme--navigation--modules--button--background-active': '#fff',
		'--theme--border-color-accent': 'x',
	});
});

test('numbers and var() values are kept as they are', () => {
	expect(rulesToCssVars({ form: { columnGap: 32, field: { input: { height: 60 } } } } as never)).toEqual({
		'--theme--form--column-gap': 32,
		'--theme--form--field--input--height': 60,
	});

	expect(
		rulesToCssVars({
			primary: 'var(--project-color)',
			primaryAccent: 'color-mix(in srgb, var(--theme--primary), #2e3c43 25%)',
		}),
	).toEqual({
		'--theme--primary': 'var(--project-color)',
		'--theme--primary-accent': 'color-mix(in srgb, var(--theme--primary), #2e3c43 25%)',
	});
});
