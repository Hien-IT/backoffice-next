// Feature 003 (research R11): stateful flows cannot use parity(), which sends the same request to both apps at
// once (one refresh token would be used twice). A scenario runs the same steps against Directus, then against
// Backoffice, each with its own fixture, and compares the two transcripts after normalization.
import { capture, COMPARED_HEADERS, type Captured, type Difference, diffJson, type ParityRequest } from '../parity.js';
import { normalizeBody, normalizeHeader } from '../normalizers.js';
import { type App, APPS, type Urls } from './fixtures.js';

export interface Snapshot {
	status: number;
	headers: Record<string, string | undefined>;
	body: unknown;
}

/** Status, compared headers and body of a response, normalized like parity() does. */
export function snapshotOf(path: string, captured: Captured): Snapshot {
	const headers: Record<string, string | undefined> = {};

	for (const name of COMPARED_HEADERS) {
		// ETag hashes random tokens; X-Powered-By is the accepted difference D-01.
		if (name === 'etag' || name === 'x-powered-by') continue;
		const value = normalizeHeader(name, captured.headers[name]);
		if (value !== undefined) headers[name] = value;
	}

	return {
		status: captured.status,
		headers,
		body: captured.isJson ? normalizeBody(path, captured.json) : captured.text,
	};
}

/** Sends a request (same Host header for both apps, like parity()) and returns the raw response. */
export function send(url: string, req: ParityRequest, host: string): Promise<Captured> {
	return capture(url, { ...req, headers: { host, ...req.headers } });
}

/** Replaces each key of `aliases` (user ids, emails of the per-app fixture) by its placeholder, everywhere. */
export function alias<T>(value: T, aliases: Record<string, string>): T {
	if (typeof value === 'string') {
		let out: string = value;
		for (const [from, to] of Object.entries(aliases)) out = out.split(from).join(to);
		return out as T;
	}

	if (Array.isArray(value)) return value.map((item) => alias(item, aliases)) as T;

	if (typeof value === 'object' && value !== null) {
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [alias(k, aliases), alias(v, aliases)])) as T;
	}

	return value;
}

export interface ScenarioContext {
	app: App;
	url: string;
	/** Host header to send, the Directus one for both apps (URLs built from it can then match). */
	host: string;
}

export type Transcripts<T> = Record<App, T>;

/** Runs `run` against Directus, then Backoffice (in that order, never at the same time). */
export async function scenario<T>(urls: Urls, run: (ctx: ScenarioContext) => Promise<T>): Promise<Transcripts<T>> {
	const host = new URL(urls.directus).host;
	const out: Partial<Transcripts<T>> = {};
	for (const app of APPS) out[app] = await run({ app, url: urls[app], host });
	return out as Transcripts<T>;
}

/** Differences between the two transcripts (object key order ignored, array order kept). */
export function compareTranscripts<T>(transcripts: Transcripts<T>): Difference[] {
	const out: Difference[] = [];
	diffJson(transcripts.directus, transcripts.backoffice, '', out);
	return out;
}

export function assertSameTranscripts<T>(transcripts: Transcripts<T>, label = 'scenario'): void {
	const differences = compareTranscripts(transcripts);
	if (differences.length === 0) return;

	const lines = differences.map(
		(d) =>
			`  ${d.location || '(whole)'}\n    Directus:   ${JSON.stringify(d.directus)}\n    Backoffice: ${JSON.stringify(d.backoffice)}`,
	);

	throw new Error(`${label}: ${differences.length} difference(s)\n${lines.join('\n')}`);
}

/** One pair of the cross-use matrix (FR-101): token issued by `issuer`, used at `consumer`. */
export interface MatrixCell<T> {
	issuer: App;
	consumer: App;
	result: T;
}

/** Runs issue at each app and use at each app: the 4 pairs of FR-101. */
export async function matrix<Token, T>(
	urls: Urls,
	issue: (ctx: ScenarioContext) => Promise<Token>,
	use: (ctx: ScenarioContext, token: Token) => Promise<T>,
): Promise<MatrixCell<T>[]> {
	const host = new URL(urls.directus).host;
	const cells: MatrixCell<T>[] = [];

	for (const issuer of APPS) {
		for (const consumer of APPS) {
			const token = await issue({ app: issuer, url: urls[issuer], host });
			cells.push({ issuer, consumer, result: await use({ app: consumer, url: urls[consumer], host }, token) });
		}
	}

	return cells;
}
