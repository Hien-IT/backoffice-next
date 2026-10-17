// Ported from directus/app/src/panels/pie-chart/color-generator.ts
// Backoffice: `color` (already a dependency, feature 013) instead of chroma-js; same Lab steps (research R1).
import Color from 'color';

export function monoThemeGenerator(baseColor: string, length: number): string[] {
	const theme: string[] = [baseColor];
	const lab = Color(baseColor).lab().array() as [number, number, number];

	// Lighten or darken the next color in the theme
	const getUpdatedLightness = (lightness: number, index: number) =>
		lightness < 0 ? lab[0] + index + 20 : lightness - (index + 10);

	let newLightness = lab[0] - 15;

	// Starts at 1 because the 0-indexed first color in the theme array is the base color
	for (let index = 1; index < length; index++) {
		newLightness = getUpdatedLightness(newLightness, index);
		let proposedColor = toHex(newLightness, lab[1], lab[2]);

		let round = 0;

		// Regenerate a new color if it already exists and retry whenever it is still the same color until a set amount of time
		while (theme.includes(proposedColor)) {
			newLightness = getUpdatedLightness(newLightness, index);

			if (newLightness > 0 && newLightness < 255) {
				proposedColor = toHex(newLightness, lab[1], lab[2]);
			}

			round++;

			if (round > 600) {
				break;
			}
		}

		theme.push(proposedColor);
	}

	return theme;
}

/** chroma.lab(...).hex(): lowercase #rrggbb, channels clamped. */
function toHex(l: number, a: number, b: number): string {
	return Color.lab(l, a, b).hex().toLowerCase();
}
