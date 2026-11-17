// Backoffice (spec 033, FR-010a, research R6): syntax colours of the documentation code blocks. highlight.js core with
// the three languages the documentation uses; the result is HTML with `hljs-*` classes (colours in docs.css, from
// theme tokens) and goes through `sanitize` before it reaches the page (FR-046). Lazy chunk only (check-bundle).
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import graphql from 'highlight.js/lib/languages/graphql';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('graphql', graphql);
hljs.registerLanguage('json', json);

export function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Highlighted HTML for a known language; escaped text for an unknown or missing one. */
export function highlight(code: string, language?: string | null): string {
	if (!language || !hljs.getLanguage(language)) return escapeHtml(code);
	return hljs.highlight(code, { language }).value;
}
