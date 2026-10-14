// Ported from directus/app/src/utils/generate-favicon.ts
// Backoffice: the white mark is the temporary Backoffice "B" (Q-7 tạm) instead of the Directus logo (FR-036); the
// fallback color is the design-system primary.
import { cssVar } from './css-var.ts';

/** Letter B of src/assets/logo-*.svg (viewBox 0 0 32 32), scaled to the 200 × 200 favicon. */
const BACKOFFICE_MARK =
	'<path transform="scale(6.25)" fill="#FFF" fill-rule="evenodd" d="M10 8H17.5A4 4 0 0 1 20.2 15.1A4.25 4.25 0 0 1 18 24H10ZM13.5 11H17A1.5 1.5 0 0 1 17 14H13.5ZM13.5 17H17.5A2 2 0 0 1 17.5 21H13.5Z"/>'; // raw-color-allowed: white mark of the favicon, like Directus

const svg = (color: string, addLogo: boolean) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
	<style>
		circle {
			fill: ${color};
		}
	</style>

	<circle cx="100" cy="100" r="100"/>

	${addLogo ? BACKOFFICE_MARK : ''}
</svg>`;

export const generateFavicon = (color: string, addLogo = true) => {
	color = color || cssVar('--color-brand-500');

	// Backoffice: the SVG string is already serialized markup; Directus' innerHTML/XMLSerializer round trip only
	// normalized it (and loses the <style> in happy-dom).
	return 'data:image/svg+xml;base64,' + window.btoa(svg(color, addLogo).trim());
};
