// Backoffice: stands in for `decode` of html-entities (not a dependency of apps/web), used by the formatted-value
// display on DOMPurify output (text without tags). DOMParser builds an inert document (nothing loads or runs); the
// `<body>` prefix keeps leading whitespace.
export function decode(value: string): string {
	return new DOMParser().parseFromString(`<body>${value}`, 'text/html').body.textContent ?? '';
}
