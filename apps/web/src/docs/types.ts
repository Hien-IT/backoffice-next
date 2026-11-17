// Backoffice (spec 033, data-model §1–§4): the types of the documentation area (/admin/docs). No DR counterpart (D-215).

export type DocsSectionId = 'guides' | 'api' | 'configuration';

export interface DocsPage {
	/** Unique, the URL after `/docs/`: '' (introduction), 'guides/files', 'api/files', 'configuration/general'. */
	path: string;
	/** Shown in the left menu, the breadcrumb and as the page title. */
	title: string;
	/** One sentence under the title. */
	lead: string;
	kind: 'markdown' | 'api' | 'configuration';
	/** markdown: file under `content/` without `.md`; api: name of the generated file; configuration: group id. */
	source: string;
	/** The page describes something only Backoffice has (FR-019, FR-027). */
	backofficeOnly?: boolean;
}

export interface DocsGroup {
	/** Group title (content, Vietnamese); none: the pages sit straight under the section. */
	title?: string;
	pages: DocsPage[];
}

export interface DocsSection {
	id: DocsSectionId;
	/** i18n key of the frame: docs_guides, docs_api, docs_configuration. */
	titleKey: string;
	groups: DocsGroup[];
}

export interface DocsNav {
	intro: DocsPage;
	sections: DocsSection[];
}

export interface DocsHeading {
	/** Slug without diacritics, unique in the page. */
	id: string;
	text: string;
	level: 2 | 3;
}

export type JsonSchema = Record<string, unknown>;

export interface DocsApiParameter {
	name: string;
	type: string;
	required: boolean;
	description: string;
	/** `en` when the text comes from the static API description (FR-038), `vi` from the supplement. */
	lang: 'en' | 'vi';
}

export interface DocsApiOperation {
	id: string;
	anchor: string;
	method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD' | 'SEARCH';
	path: string;
	summary: string;
	description: string;
	lang: 'en' | 'vi';
	query: DocsApiParameter[];
	pathParams: DocsApiParameter[];
	body?: { contentType: string; required: boolean; schema: JsonSchema };
	responses: { status: string; description: string; schema?: JsonSchema }[];
	rest: string;
	graphql: string | false;
	responseExample?: unknown;
	backofficeOnly: boolean;
	/** Who may call it; required when `backofficeOnly` (FR-027). */
	access?: 'admin' | 'authenticated' | 'public';
	/** More on `access` (e.g. per the caller's permissions). */
	accessNote?: string;
}

export interface DocsApiResource {
	$source: string;
	id: string;
	name: string;
	description: string;
	lang: 'en' | 'vi';
	collection?: string;
	backofficeOnly: boolean;
	operations: DocsApiOperation[];
	schemas: Record<string, JsonSchema>;
}

/** `configuration/supported.generated.json`, written by scripts/sync-docs-config.mjs. */
export interface SupportedGenerated {
	$source: string;
	variables: SupportedVariable[];
}

export interface SupportedVariable {
	/** Source of the RegExp in SUPPORTED_VARIABLES without `^` and `$`. */
	pattern: string;
	/** A plain name, not a pattern. */
	exact: boolean;
	default?: string;
}

export interface ConfigRow {
	/** Shown name: the variable, or a pattern such as `DB_*`. */
	name: string;
	/** Matches exactly one entry of supported.generated.json. */
	pattern: string;
	description: string;
	note?: string;
}

export interface ConfigTable {
	title?: string;
	note?: string;
	rows: ConfigRow[];
}

export interface ConfigGroupMeta {
	/** Also the page path: configuration/<id>. */
	id: string;
	title: string;
	lead: string;
}
