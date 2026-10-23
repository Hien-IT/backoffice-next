// Ported from directus/app/src/interfaces/input-rich-text-html/get-editor-styles.ts
// Backoffice: the content iframe does not inherit the page CSS, so the theme tokens are read with cssVar() (light, or
// dark when `html.dark` is set, FR-095); the body is transparent, with the page's color-scheme, so the EditorFrame
// background (and its disabled state) shows through. Fonts: Outfit + Noto Sans (Vietnamese) are self-hosted for the
// iframe; serif and monospace use the system stacks of the other editors (no Merriweather / Fira Mono in the
// design-system). As in DR, the content CSS is read when the editor starts (a theme switch applies on the next
// mount).
import outfit400 from '@fontsource/outfit/files/outfit-latin-400-normal.woff2?url';
import outfit500 from '@fontsource/outfit/files/outfit-latin-500-normal.woff2?url';
import outfit700 from '@fontsource/outfit/files/outfit-latin-700-normal.woff2?url';
import notoSansVietnamese from '@fontsource/noto-sans/files/noto-sans-vietnamese-400-normal.woff2?url';
import { cssVar } from '../../utils/css-var.ts';

// shortcut: the theme only defines font-outfit; serif and monospace use generic system stacks (as the other editors)
// until the design-system adds font tokens for them.
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const FONTS = {
	'sans-serif': () => cssVar('--font-outfit'),
	serif: () => 'ui-serif, Georgia',
	monospace: () => MONOSPACE,
};

const mix = (token: string, percent: number) => `color-mix(in oklab, ${cssVar(token)} ${percent}%, transparent)`;

/** DR theme variables of the content CSS on the design-system tokens, light and dark. */
function tokens() {
	const dark = document.documentElement.classList.contains('dark');

	return {
		// Same color scheme as the page (base.css), else chromium paints the iframe opaque.
		scheme: dark ? 'dark' : 'light',
		selection: cssVar(dark ? '--color-gray-700' : '--color-brand-100'),
		foreground: dark ? mix('--color-white', 90) : cssVar('--color-gray-800'),
		foregroundAccent: cssVar(dark ? '--color-white' : '--color-gray-900'),
		foregroundSubdued: cssVar(dark ? '--color-gray-400' : '--color-gray-500'),
		primary: cssVar(dark ? '--color-brand-400' : '--color-brand-500'),
		backgroundNormal: dark ? mix('--color-white', 5) : cssVar('--color-gray-100'),
		border: cssVar(dark ? '--color-gray-800' : '--color-gray-200'),
		success: cssVar(dark ? '--color-success-400' : '--color-success-700'),
		successBackground: dark ? mix('--color-success-500', 15) : cssVar('--color-success-50'),
		danger: cssVar(dark ? '--color-error-400' : '--color-error-700'),
		dangerBackground: dark ? mix('--color-error-500', 15) : cssVar('--color-error-50'),
		radius: '0.5rem',
	};
}

export default function getEditorStyles(
	font: 'sans-serif' | 'serif' | 'monospace',
	includeDiffStyles?: boolean,
): string {
	const userFontFamily = (FONTS[font] ?? FONTS['sans-serif'])();
	const theme = tokens();

	return `
@font-face {
	font-family: 'Outfit';
	font-style: normal;
	font-weight: 400;
	src: url(${outfit400}) format('woff2');
}

@font-face {
	font-family: 'Outfit';
	font-style: normal;
	font-weight: 500;
	src: url(${outfit500}) format('woff2');
}

@font-face {
	font-family: 'Outfit';
	font-style: normal;
	font-weight: 700;
	src: url(${outfit700}) format('woff2');
}

@font-face {
	font-family: 'Noto Sans';
	font-style: normal;
	font-weight: 400;
	src: url(${notoSansVietnamese}) format('woff2');
}

:root {
	color-scheme: ${theme.scheme};
}
::selection {
	background: ${theme.selection};
}
body {
	color: ${theme.foreground};
	background-color: transparent;
	margin: 1.125rem;
	font-family: ${cssVar('--font-outfit')};
	-webkit-font-smoothing: antialiased;
	text-rendering: optimizeLegibility;
	-moz-osx-font-smoothing: grayscale;
}
body.mce-content-readonly:not(.non-editable) {
	color: ${theme.foregroundSubdued};
	background-color: transparent;
}
.mce-offscreen-selection {
	display: none;
}
h1, h2, h3, h4, h5, h6 {
	font-family: ${userFontFamily}, serif;
	color: ${theme.foregroundAccent};
	font-weight: 700;
	margin-block-end: 0;
}
h1 + p, h2 + p, h3 + p, h4 + p, h5 + p, h6 + p {
	margin-block-start: 0.5em;
}
h1 {
	font-size: 2rem;
	line-height: 1.2813;
	margin-block-start: 1em;
}
h2 {
	font-size: 1.375rem;
	line-height: 1.4091;
	margin-block-start: 1.25em;
}
h3 {
	font-size: 1.0625rem;
	line-height: 1.5294;
	margin-block-start: 1.25em;
}
h4 {
	font-size: 0.875rem;
	line-height: 1.6429;
	margin-block-start: 1.5em;
}
h5 {
	font-size: 0.8125rem;
	line-height: 1.6923;
	margin-block-start: 2em;
}
h6 {
	font-size: 0.6875rem;
	line-height: 1.8182;
	margin-block-start: 2em;
}
p {
	font-family: ${userFontFamily}, serif;
	font-size: 0.875rem;
	line-height: 1.5714;
	font-weight: 500;
	margin: 1.5em 0;
}
a {
	color: ${theme.primary};
	text-decoration: underline;
	cursor: pointer;
}
ul, ol {
	font-family: ${userFontFamily}, serif;
	font-size: 0.875rem;
	line-height: 1.5714;
	font-weight: 500;
	margin: 1.5em 0;
}
ul ul,
	ol ol,
		ul ol,
			ol ul {
	margin: 0;
}
b, strong {
	font-weight: 700;
}
code {
	font-size: 0.875rem;
	line-height: 1.5714;
	font-weight: 500;
	padding: 0.125rem 0.25rem;
	font-family: ${MONOSPACE};
	background-color: ${theme.backgroundNormal};
	border-radius: ${theme.radius};
	overflow-wrap: break-word;
}
pre {
	font-size: 0.875rem;
	line-height: 1.5714;
	font-weight: 500;
	padding: 1em;
	font-family: ${MONOSPACE};
	background-color: ${theme.backgroundNormal};
	border-radius: ${theme.radius};
	overflow: auto;
}
blockquote {
	font-family: ${userFontFamily}, serif;
	font-size: 0.875rem;
	line-height: 1.5714;
	font-weight: 500;
	border-inline-start: 2px solid ${theme.border};
	padding-inline-start: 1em;
	margin-inline-start: 0;
}
video,
img {
	max-inline-size: 100%;
	border-radius: ${theme.radius};
	block-size: auto;
}
iframe {
	max-inline-size: 100%;
	border-radius: ${theme.radius};
}
hr {
	background-color: ${theme.border};
	block-size: 0.0625rem;
	border: none;
	margin-block-start: 2em;
	margin-block-end: 2em;
}
table {
	border-collapse: collapse;
	font-size: 0.875rem;
	line-height: 1.5714;
	font-weight: 500;
}
table th,
table td {
	border: 1px solid ${theme.border};
	padding: 0.3125rem;
}
figure {
	display: table;
	margin: 0.8125rem auto;
}
figure figcaption {
	color: ${theme.foregroundSubdued};
	display: block;
	margin-block-start: 0.1875rem;
	text-align: center;
}${
		includeDiffStyles
			? `
.comparison-diff--added {
	color: ${theme.success};
	background-color: ${theme.successBackground};
	padding: 0.125rem;
	border-radius: ${theme.radius};
}

.comparison-diff--removed {
	color: ${theme.danger};
	background-color: ${theme.dangerBackground};
	padding: 0.125rem;
	border-radius: ${theme.radius};
}`
			: ''
	}`;
}
