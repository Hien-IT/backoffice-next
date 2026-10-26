// Sends the same request to Directus and to Backoffice, then compares status, the FR-104 header set and
// the body under FR-103..FR-105 (the blackbox helpers of directus/tests/blackbox, rewritten for two servers).
import { createHash } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import type { AcceptedDifference, Matcher } from '../accepted-differences.js';
import { normalizeBody, normalizeHeader, normalizeText, sortIntrospectionTypes } from './normalizers.js';

export interface ParityRequest {
	method?: string;
	path: string;
	headers?: Record<string, string>;
	/** A Buffer is sent as is (feature 007: multipart bodies); set its content-type in `headers`. */
	body?: string | Buffer | Record<string, unknown> | unknown[];
	/** Give up after this many ms; no answer is captured as status 0 (compared like any status). */
	timeoutMs?: number;
	/** Applied to both responses before the comparison, for values only this request knows how to compare. */
	normalize?: (captured: Captured) => Captured;
}

export interface Captured {
	status: number;
	headers: Record<string, string>;
	text: string;
	json: unknown;
	isJson: boolean;
	/** Raw body (feature 007): binary responses (images, zip) are compared by their bytes. */
	bytes?: Buffer;
}

/** Feature 007: a body that is not text (image, zip, PDF, octet-stream) is compared by sha256, not decoded. */
export function isBinary(captured: Pick<Captured, 'headers'>): boolean {
	const type = captured.headers['content-type'] ?? '';
	return type !== '' && !/^text\/|json|xml|javascript|x-www-form-urlencoded/i.test(type);
}

/** `sha256:<hex> (<n> bytes)` of the raw body. */
export function bodyDigest(captured: Captured): string {
	const bytes = captured.bytes ?? Buffer.from(captured.text, 'utf8');
	return `sha256:${createHash('sha256').update(bytes).digest('hex')} (${bytes.length} bytes)`;
}

export interface Difference {
	kind: 'status' | 'header' | 'body';
	/** Header name, JSON pointer ('' = whole body) or '' for status. */
	location: string;
	directus: unknown;
	backoffice: unknown;
}

export interface ParityResult {
	endpoint: string;
	directus: Captured;
	backoffice: Captured;
	/** Differences that are not covered by an accepted difference. */
	differences: Difference[];
	/** Differences covered by an accepted difference, with its id. */
	accepted: (Difference & { id: string })[];
}

export interface ParityOptions {
	directusUrl?: string;
	backofficeUrl?: string;
	accepted?: AcceptedDifference[];
	/**
	 * Feature 007 (R-17): Directus first, then Backoffice. A new derived asset is written to the shared storage by the
	 * first request; sent at once, one app can stream the object the other is still writing.
	 */
	sequential?: boolean;
}

/** FR-104: headers compared. `etag` is skipped for OAS and /metrics (FR-105); x-powered-by is D-01. */
export const COMPARED_HEADERS = [
	'content-type',
	'cache-control',
	'vary',
	'etag',
	'allow',
	'location',
	'retry-after',
	'set-cookie',
	'content-security-policy',
	'cross-origin-opener-policy',
	'strict-transport-security',
	'x-powered-by',
	// Feature 005 (FR-044): export file names.
	'content-disposition',
	// Feature 005 (research R4): CACHE_STATUS_HEADER of the env files, HIT or MISS at both apps.
	'x-cache-status',
	// Feature 007 (contracts/assets.md §1): ranges of /assets.
	'accept-ranges',
	'content-range',
];

const NO_ETAG = [/^\/server\/specs\/oas$/i, /^\/metrics$/i];

export function endpointOf(req: ParityRequest): string {
	return `${(req.method ?? 'GET').toUpperCase()} ${req.path.split('?')[0]}`;
}

export function capture(baseUrl: string, req: ParityRequest): Promise<Captured> {
	const url = new URL(req.path, baseUrl);
	const headers: Record<string, string> = { ...req.headers };
	const method = (req.method ?? 'GET').toUpperCase();

	// Feature 005 (research R4): fresh reads at both apps, the env files set CACHE_SKIP_ALLOWED=true; a request that sets
	// its own Cache-Control (the cache tests) keeps it. POST /graphql(/system) is cached too (011): the two apps were sent
	// the same query at once and one could read the other's entry (x-cache-status HIT vs MISS, graphql-nointro, CI).
	const cachedRead =
		method === 'GET' || method === 'HEAD' || (method === 'POST' && /^\/graphql(\/system)?(\?|$)/.test(req.path));
	if (cachedRead && !Object.keys(headers).some((h) => h.toLowerCase() === 'cache-control')) {
		headers['cache-control'] = 'no-store';
	}
	let body: string | Buffer | undefined;

	if (Buffer.isBuffer(req.body)) {
		body = req.body;
		headers['content-length'] = String(body.length);
	} else if (req.body !== undefined) {
		body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
		headers['content-type'] ??= 'application/json';
		headers['content-length'] = String(Buffer.byteLength(body));
	}

	// node:http rather than fetch: fetch forbids a custom Host header, which FR-105 needs.
	const client = url.protocol === 'https:' ? https : http;

	return new Promise((resolve, reject) => {
		const request = client.request(url, { method, headers }, (res) => {
			const chunks: Buffer[] = [];
			res.on('data', (chunk: Buffer) => chunks.push(chunk));
			res.on('error', reject);

			res.on('end', () => {
				const bytes = Buffer.concat(chunks);
				const text = bytes.toString('utf8');
				const out: Record<string, string> = {};

				for (const [name, value] of Object.entries(res.headers)) {
					// Set-Cookie values contain ", " (Expires), so they are joined with a newline instead.
					const separator = name.toLowerCase() === 'set-cookie' ? '\n' : ', ';
					if (value !== undefined) out[name.toLowerCase()] = Array.isArray(value) ? value.join(separator) : value;
				}

				let json: unknown = undefined;
				let isJson = false;

				if (/json/.test(out['content-type'] ?? '') && text.length > 0) {
					try {
						json = JSON.parse(text);
						isJson = true;
					} catch {
						// Compared as text.
					}
				}

				resolve({ status: res.statusCode ?? 0, headers: out, text, json, isJson, bytes });
			});
		});

		request.on('error', reject);

		if (req.timeoutMs !== undefined) {
			request.setTimeout(req.timeoutMs, () => {
				request.destroy();
				resolve({ status: 0, headers: {}, text: '', json: undefined, isJson: false });
			});
		}

		if (body !== undefined) request.write(body);
		request.end();
	});
}

export function compare(endpoint: string, directus: Captured, backoffice: Captured): Difference[] {
	const differences: Difference[] = [];
	const path = endpoint.split(' ')[1] ?? '';

	if (directus.status !== backoffice.status) {
		differences.push({ kind: 'status', location: '', directus: directus.status, backoffice: backoffice.status });
	}

	const names = new Set<string>(COMPARED_HEADERS);

	for (const name of [...Object.keys(directus.headers), ...Object.keys(backoffice.headers)]) {
		if (name.startsWith('access-control-')) names.add(name);
	}

	// A body holding time-dependent values (FR-105) has a time-dependent ETag: compare its length part only.
	const timeDependent = [directus, backoffice].some(
		(c) => c.isJson && JSON.stringify(normalizeBody(path, c.json)) !== JSON.stringify(c.json),
	);

	// Spec 022 D-181: Directus lists backoffice_migrations (collections, fields, GraphQL items, SDL) where Backoffice
	// does not; the bodies are compared without it, so the ETags of the raw bodies cannot match (a HEAD of the SDL
	// route has no body to look at).
	const backofficeCollections =
		[directus, backoffice].some((c) => c.text.includes('backoffice_migrations')) ||
		(/^\/server\/specs\/graphql(\/system)?$/.test(path) && directus.text === '' && backoffice.text === '');

	for (const name of [...names].sort()) {
		if (name === 'etag' && NO_ETAG.some((r) => r.test(path))) continue;
		if (name === 'etag' && backofficeCollections) continue;

		let a = normalizeHeader(name, directus.headers[name]);
		let b = normalizeHeader(name, backoffice.headers[name]);

		if (name === 'etag' && timeDependent) {
			a = a?.replace(/-[^-"]+"$/, '-<hash>"');
			b = b?.replace(/-[^-"]+"$/, '-<hash>"');
		}

		if (a !== b) differences.push({ kind: 'header', location: name, directus: a, backoffice: b });
	}

	if (directus.isJson && backoffice.isJson) {
		let a = normalizeBody(path, directus.json);
		let b = normalizeBody(path, backoffice.json);

		// D-181: graphql-js lists introspection types in traversal order from Query, whose first fields at Directus are
		// the backoffice_migrations ones: with them left out, the types are compared by name.
		if (backofficeCollections && /^\/graphql(\?|$)/.test(path)) {
			a = sortIntrospectionTypes(a);
			b = sortIntrospectionTypes(b);
		}

		diffJson(a, b, '', differences);
	} else if (/^\/server\/specs\/graphql(\/system)?$/.test(path)) {
		// D-181: the SDL download (application/octet-stream) is text; compared byte for byte without backoffice_migrations.
		if (normalizeText(directus.text) !== normalizeText(backoffice.text)) {
			differences.push({ kind: 'body', location: '', directus: bodyDigest(directus), backoffice: bodyDigest(backoffice) });
		}
	} else if (isBinary(directus) || isBinary(backoffice)) {
		const a = bodyDigest(directus);
		const b = bodyDigest(backoffice);
		if (a !== b) differences.push({ kind: 'body', location: '', directus: a, backoffice: b });
	} else if (normalizeText(directus.text) !== normalizeText(backoffice.text)) {
		differences.push({ kind: 'body', location: '', directus: directus.text, backoffice: backoffice.text });
	}

	return differences;
}

/** Structural JSON comparison: object key order is ignored, array order is not (FR-103). */
export function diffJson(a: unknown, b: unknown, pointer: string, out: Difference[]): void {
	if (isPlainObject(a) && isPlainObject(b)) {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

		for (const key of [...keys].sort()) {
			const child = `${pointer}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;

			if (!(key in a)) out.push({ kind: 'body', location: child, directus: undefined, backoffice: b[key] });
			else if (!(key in b)) out.push({ kind: 'body', location: child, directus: a[key], backoffice: undefined });
			else diffJson(a[key], b[key], child, out);
		}

		return;
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) {
			out.push({ kind: 'body', location: pointer, directus: a, backoffice: b });
			return;
		}

		a.forEach((item, i) => diffJson(item, b[i], `${pointer}/${i}`, out));
		return;
	}

	if (!Object.is(a, b)) out.push({ kind: 'body', location: pointer, directus: a, backoffice: b });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function matches(matcher: Matcher | undefined, value: unknown): boolean {
	if (matcher === undefined) return true;
	if (matcher instanceof RegExp) return typeof value === 'string' && matcher.test(value);
	if (typeof matcher === 'object' && matcher !== null && 'absent' in matcher) return value === undefined;
	if (typeof matcher === 'object' && matcher !== null && 'any' in matcher) return true;
	return Object.is(matcher, value) || JSON.stringify(matcher) === JSON.stringify(value);
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function endpointMatches(patterns: string[] | undefined, endpoint: string): boolean {
	if (!patterns) return false;

	const lower = endpoint.toLowerCase();
	const path = lower.slice(lower.indexOf(' ') + 1);

	return patterns.some((pattern) => {
		if (pattern === '*') return true;

		// '* /path' matches every method.
		const p = pattern.toLowerCase();
		const [subject, target] = p.startsWith('* ') ? [path, p.slice(2)] : [lower, p];

		// '*' matches any run of characters (a trailing one: a prefix; '/users/*/tfa/disable': any user).
		const regex = new RegExp(`^${target.split('*').map(escapeRegExp).join('.*')}$`);
		return regex.test(subject);
	});
}

export function findAccepted(
	accepted: AcceptedDifference[],
	endpoint: string,
	difference: Difference,
	directus?: Pick<Captured, 'status' | 'json'>,
	backoffice?: Pick<Captured, 'status' | 'json'>,
): AcceptedDifference | undefined {
	return accepted.find((d) => {
		if (d.kind !== 'http' || !d.location || !endpointMatches(d.endpoints, endpoint)) return false;
		if (endpointMatches(d.excludeEndpoints, endpoint)) return false;

		if (d.when?.directusStatus !== undefined && directus?.status !== d.when.directusStatus) return false;
		if (d.when?.directusCode !== undefined && errorCode(directus?.json) !== d.when.directusCode) return false;
		if (d.when?.backofficeCode !== undefined && errorCode(backoffice?.json) !== d.when.backofficeCode) return false;

		const loc = d.location;

		if ('any' in loc) return true;

		if ('status' in loc) {
			if (difference.kind !== 'status') return false;
		} else if ('header' in loc) {
			if (difference.kind !== 'header' || difference.location !== loc.header.toLowerCase()) return false;
		} else if (difference.kind !== 'body' || !pointerMatches(loc.jsonPointer, difference.location)) {
			return false;
		}

		return matches(d.directus, difference.directus) && matches(d.backoffice, difference.backoffice);
	});
}

function pointerMatches(pointer: string | RegExp, location: string): boolean {
	if (pointer instanceof RegExp) return pointer.test(location);
	return location === pointer || location.startsWith(`${pointer}/`);
}

function errorCode(json: unknown): string | undefined {
	return (json as { errors?: { extensions?: { code?: string } }[] } | undefined)?.errors?.[0]?.extensions?.code;
}

export function classify(
	endpoint: string,
	differences: Difference[],
	accepted: AcceptedDifference[],
	directus?: Pick<Captured, 'status' | 'json'>,
	backoffice?: Pick<Captured, 'status' | 'json'>,
): Pick<ParityResult, 'differences' | 'accepted'> {
	const result: Pick<ParityResult, 'differences' | 'accepted'> = { differences: [], accepted: [] };

	for (const difference of differences) {
		const hit = findAccepted(accepted, endpoint, difference, directus, backoffice);
		if (hit) result.accepted.push({ ...difference, id: hit.id });
		else result.differences.push(difference);
	}

	return result;
}

/** Sends the same request to both servers (same Host header) and compares the responses. */
export async function parity(req: ParityRequest, options: ParityOptions = {}): Promise<ParityResult> {
	const directusUrl = options.directusUrl ?? process.env['DIRECTUS_URL'];
	const backofficeUrl = options.backofficeUrl ?? process.env['BACKOFFICE_URL'];

	if (!directusUrl || !backofficeUrl) throw new Error('DIRECTUS_URL and BACKOFFICE_URL must be set');

	const accepted = options.accepted ?? (await import('../accepted-differences.js')).acceptedDifferences;
	const endpoint = endpointOf(req);

	// Same Host on both sides so URLs built from it (OAS servers[0].url) can match (FR-105).
	const withHost: ParityRequest = { ...req, headers: { host: new URL(directusUrl).host, ...req.headers } };

	const captured = options.sequential
		? [await capture(directusUrl, withHost), await capture(backofficeUrl, withHost)]
		: await Promise.all([capture(directusUrl, withHost), capture(backofficeUrl, withHost)]);
	const [directus, backoffice] = req.normalize ? captured.map(req.normalize) : captured;

	return {
		endpoint,
		directus: directus!,
		backoffice: backoffice!,
		...classify(endpoint, compare(endpoint, directus!, backoffice!), accepted, directus, backoffice),
	};
}

/** Human-readable report of unaccepted differences (US4.2): endpoint, location, both values. */
export function report(result: Pick<ParityResult, 'endpoint' | 'differences'>): string {
	if (result.differences.length === 0) return '';

	const lines = result.differences.map((d) => {
		const where =
			d.kind === 'status' ? 'status' : d.kind === 'header' ? `header ${d.location}` : `body ${d.location || '(whole)'}`;
		return `  ${where}\n    Directus:   ${JSON.stringify(d.directus)}\n    Backoffice: ${JSON.stringify(d.backoffice)}`;
	});

	return `${result.endpoint}: ${result.differences.length} unaccepted difference(s)\n${lines.join('\n')}`;
}

/** Throws with the report when there is any unaccepted difference. */
export function assertParity(result: ParityResult): void {
	const text = report(result);
	if (text) throw new Error(text);
}

/**
 * For timing-dependent responses only (/server/health compares response times with thresholds): retries while
 * the two sides differ, so a slow first answer of either app does not fail the comparison.
 */
export async function parityStable(
	req: ParityRequest,
	options: ParityOptions = {},
	attempts = 3,
): Promise<ParityResult> {
	let result = await parity(req, options);

	for (let i = 1; i < attempts && result.differences.length > 0; i++) {
		await new Promise((resolve) => setTimeout(resolve, 1000));
		result = await parity(req, options);
	}

	return result;
}
