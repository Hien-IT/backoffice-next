// Backoffice (spec 033, research R5): Markdown of the documentation area → sanitized HTML plus the headings of the
// page. An own `Marked` instance (the app-wide `md()` keeps its plain renderer), the shared DOMPurify (`sanitize`), then
// a DOM pass that gives the headings their anchors. Ids are set after sanitizing: DOMPurify drops ids that shadow DOM
// properties (`cookie`, `location`), and these come from our own slugs, not from the content.
import slugify from '@sindresorhus/slugify';
import { Marked, type Tokens } from 'marked';
import { sanitize } from '../utils/markdown.ts';
import { escapeHtml, highlight } from './highlight.ts';
import type { DocsHeading } from './types.ts';

export interface RenderLabels {
	copy: string;
	copyLink: string;
	note: string;
	warning: string;
}

export interface RenderOptions {
	/** `images/<file>` (the Markdown writes `./images/<file>`) → URL of the built asset. */
	images?: Record<string, string>;
	/** Base of the router; the content writes internal links as `/docs/...`. */
	base?: string;
	labels?: Partial<RenderLabels>;
}

export interface RenderedDoc {
	html: string;
	headings: DocsHeading[];
}

const DEFAULT_LABELS: RenderLabels = { copy: 'Copy', copyLink: 'Copy link to this section', note: 'Note', warning: 'Warning' };

/** Slugs without diacritics, unique per page: a repeated heading gets `-2`, `-3` (FR-006). */
export function createSlugger(): (text: string) => string {
	const used = new Map<string, number>();

	return (text) => {
		const base = slugify(text) || 'section';
		const count = (used.get(base) ?? 0) + 1;
		used.set(base, count);
		return count === 1 ? base : `${base}-${count}`;
	};
}

const fileName = (path: string) => path.split('/').pop() ?? path;

export function renderDoc(markdown: string, options: RenderOptions = {}): RenderedDoc {
	const images = options.images ?? {};
	const base = (options.base ?? '/').replace(/\/$/, '');
	const labels = { ...DEFAULT_LABELS, ...options.labels };

	const marked = new Marked({
		gfm: true,
		renderer: {
			code({ text, lang }: Tokens.Code) {
				const language = (lang ?? '').trim().split(/\s+/)[0] ?? '';
				const attr = language ? ` data-lang="${escapeHtml(language)}"` : '';

				return (
					`<div class="docs-code"><pre tabindex="0"><code class="hljs"${attr}>${highlight(text, language)}</code></pre>` +
					`<button type="button" class="docs-copy" data-copy>${escapeHtml(labels.copy)}</button></div>\n`
				);
			},
			// `> [!NOTE]` and `> [!WARNING]` open a note box; any other quote stays a quote.
			blockquote(token: Tokens.Blockquote) {
				const match = /^\[!(NOTE|WARNING)\][ \t]*\n?/.exec(token.text);
				if (!match) return `<blockquote>\n${this.parser.parse(token.tokens)}</blockquote>\n`;

				const warning = match[1] === 'WARNING';
				const body = this.parser.parse(marked.lexer(token.text.slice(match[0].length)));

				return (
					`<div class="docs-note ${warning ? 'docs-note-warning' : 'docs-note-info'}" role="note">` +
					`<p class="docs-note-title">${escapeHtml(warning ? labels.warning : labels.note)}</p>${body}</div>\n`
				);
			},
			image({ href, text }: Tokens.Image) {
				const key = href.replace(/^\.\//, '');
				const src = images[key];
				const alt = text.trim();

				if (!src) throw new Error(`docs: image "${href}" does not exist`);

				if (!alt || alt === fileName(key) || alt === fileName(key).replace(/\.[a-z]+$/, '')) {
					throw new Error(`docs: image "${href}" needs a description of what it shows`);
				}

				return `<img class="docs-image" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
			},
			link({ href, title, tokens }: Tokens.Link) {
				const url = href.startsWith('/docs') ? `${base}${href}` : href;
				const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
				return `<a href="${escapeHtml(url)}"${titleAttr}>${this.parser.parseInline(tokens)}</a>`;
			},
			table(token: Tokens.Table) {
				const head = token.header.map((cell) => `<th scope="col">${this.parser.parseInline(cell.tokens)}</th>`).join('');
				const body = token.rows
					.map((row) => `<tr>${row.map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`)
					.join('');
				const label = escapeHtml(token.header.map((cell) => cell.text).join(', '));

				return (
					`<div class="docs-table" role="region" aria-label="${label}" tabindex="0">` +
					`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>\n`
				);
			},
		},
	});

	const template = document.createElement('template');
	template.innerHTML = sanitize(marked.parse(markdown, { async: false }));

	const slug = createSlugger();
	const headings: DocsHeading[] = [];

	for (const heading of template.content.querySelectorAll('h2, h3')) {
		const text = heading.textContent?.trim() ?? '';
		const id = slug(text);

		heading.id = id;
		heading.setAttribute('tabindex', '-1');

		const anchor = document.createElement('a');
		anchor.className = 'docs-anchor';
		anchor.setAttribute('href', `#${id}`);
		anchor.setAttribute('aria-label', `${labels.copyLink}: ${text}`);
		anchor.textContent = '#';
		heading.append(' ', anchor);

		headings.push({ id, text, level: heading.tagName === 'H2' ? 2 : 3 });
	}

	return { html: template.innerHTML, headings };
}
