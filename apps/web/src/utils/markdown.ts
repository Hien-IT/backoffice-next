// Idea from directus/app/src/utils/md.ts (v-md): marked, then DOMPurify with its default config. Backoffice: links to
// another origin open in a new tab with rel="noopener noreferrer"; the hook lives on an own DOMPurify instance
// (Directus adds a hook to the global one on every call).
import DOMPurify from 'dompurify';
import { marked } from 'marked';

const purify = DOMPurify(window);

purify.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName !== 'A' || !node.hasAttribute('href')) return;

	let url: URL;

	try {
		url = new URL(node.getAttribute('href')!, window.location.href);
	} catch {
		return;
	}

	if (url.origin === window.location.origin || !['http:', 'https:'].includes(url.protocol)) return;

	node.setAttribute('target', '_blank');
	node.setAttribute('rel', 'noopener noreferrer');
});

/** Render a markdown string to sanitized HTML (the only HTML the app may put in v-html, spec "Bảo mật"). */
export function md(value: string): string {
	return purify.sanitize(marked.parse(value, { async: false }));
}
