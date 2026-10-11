// FR-105: values that cannot match between two servers, and how they are compared instead.

/** Retry-After: compare the format only (seconds or HTTP date). */
export function normalizeHeader(name: string, value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	if (name === 'set-cookie') return normalizeSetCookie(value);
	if (name === 'location') return normalizeLocation(value);
	if (name === 'retry-after')
		return /^\d+$/.test(value) ? '<seconds>' : Number.isNaN(Date.parse(value)) ? value : '<http-date>';
	if (name === 'content-disposition') return normalizeContentDisposition(value);
	return value;
}

/**
 * Feature 005 (contracts/export.md §2): export file names end with getDateTimeFormatted() (YYYYMMDD-HMS, hours, minutes
 * and seconds not padded), which differs between two requests; also inside the `filename*=` part (names outside ASCII).
 */
export function normalizeContentDisposition(value: string): string {
	return value.replace(/( |%20)\d{8}-\d{1,6}(?=\.\w+"?(;|$))/g, '$1<timestamp>');
}

export function normalizeBody(path: string, body: unknown): unknown {
	if (/^\/server\/specs\/oas$/i.test(path)) return normalizeOas(body);
	return normalizeDeep(body);
}

/** OAS: info.version is a hash of the request time; tags and paths follow catalog order (no ORDER BY). */
export function normalizeOas(body: unknown): unknown {
	if (!isObject(body)) return body;

	const out: Record<string, unknown> = { ...body };

	if (isObject(out['info'])) {
		const { version: _version, ...info } = out['info'];
		out['info'] = info;
	}

	if (Array.isArray(out['tags'])) {
		out['tags'] = [...out['tags']].sort((a, b) => String(nameOf(a)).localeCompare(String(nameOf(b))));
	}

	if (isObject(out['paths'])) {
		out['paths'] = Object.fromEntries(Object.entries(out['paths']).sort(([a], [b]) => a.localeCompare(b)));
	}

	return out;
}

/** extensions.reset, observedValue and the REQUESTS_EXCEEDED message depend on time: keep their type or shape. */
export function normalizeDeep(value: unknown, key?: string): unknown {
	if (key === 'access_token' && typeof value === 'string') return normalizeJwt(value);
	if (key === 'refresh_token' && typeof value === 'string') return tokenKind(value);
	// TFA secrets are random (POST /users/me/tfa/generate): keep the base32 shape and the otpauth URL around them.
	if (key === 'secret' && typeof value === 'string' && /^[A-Z2-7]+$/.test(value)) return '<base32>';
	if (key === 'otpauth_url' && typeof value === 'string') return value.replace(/secret=[A-Z2-7]+/, 'secret=<base32>');
	if (key === 'reset' && typeof value === 'number') return '<number>';
	// The Redis store answers with a date (ISO string) instead of a number.
	if (key === 'reset' && typeof value === 'string' && !Number.isNaN(Date.parse(value))) return '<date>';
	if (key === 'observedValue') return `<${typeof value}>`;

	if (key === 'message' && typeof value === 'string' && value.startsWith('Too many requests, retry after ')) {
		return 'Too many requests, retry after <duration>.';
	}

	if (Array.isArray(value)) return value.map((item) => normalizeDeep(item));
	if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeDeep(v, k)]));
	return value;
}

function nameOf(value: unknown): unknown {
	return isObject(value) ? value['name'] : value;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Feature 003 (research R4, R11): tokens are random, cookies carry them, SSO redirects carry PKCE values.

const TOKEN64 = /^[A-Za-z0-9_-]{64}$/;

/** Payload of a JWT, or undefined when the value is not one. */
export function decodeJwt(value: string): Record<string, unknown> | undefined {
	const parts = value.split('.');
	if (parts.length !== 3) return undefined;

	try {
		const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
		return isObject(payload) ? payload : undefined;
	} catch {
		return undefined;
	}
}

/** `<empty>`, `<jwt>`, `<token64>` (nanoid(64) refresh/session token) or the value itself. */
export function tokenKind(value: string): string {
	if (value === '') return '<empty>';
	if (decodeJwt(value)) return '<jwt>';
	if (TOKEN64.test(value)) return '<token64>';
	return value;
}

/** Access token: its claims without iat/exp, plus ttl = exp - iat; random claims (session) as their kind. */
export function normalizeJwt(value: string): unknown {
	const payload = decodeJwt(value);
	if (!payload) return tokenKind(value);

	const { iat, exp, ...claims } = payload;
	if (typeof claims['session'] === 'string') claims['session'] = tokenKind(claims['session']);

	return { claims, ttl: typeof iat === 'number' && typeof exp === 'number' ? exp - iat : null };
}

/** Each cookie as `name=<kind>; attributes`; Expires as <past> or <future>; cookies sorted by name. */
export function normalizeSetCookie(header: string, now = Date.now()): string {
	return header
		.split('\n')
		.map((cookie) => {
			const [pair = '', ...attributes] = cookie.split(';').map((part) => part.trim());
			const index = pair.indexOf('=');
			const name = index === -1 ? pair : pair.slice(0, index);
			const value = index === -1 ? '' : pair.slice(index + 1);

			const attrs = attributes.map((attribute) => {
				const [key = '', ...rest] = attribute.split('=');
				if (key.toLowerCase() !== 'expires') return attribute;
				const time = Date.parse(rest.join('='));
				return `Expires=${Number.isNaN(time) ? '<invalid>' : time <= now ? '<past>' : '<future>'}`;
			});

			return [`${name}=${tokenKind(decodeURIComponent(value))}`, ...attrs].join('; ');
		})
		.sort()
		.join('\n');
}

const RANDOM_PARAMS = ['state', 'nonce', 'code_challenge', 'code'];

/** Location of SSO redirects: PKCE and state values are random, keep the parameter, not its value. */
export function normalizeLocation(value: string): string {
	const absolute = /^[a-z][a-z0-9+.-]*:/i.test(value);
	const url = new URL(value, 'http://relative.invalid');
	let changed = false;

	for (const param of RANDOM_PARAMS) {
		if (url.searchParams.has(param)) {
			url.searchParams.set(param, `<${param}>`);
			changed = true;
		}
	}

	if (!changed) return value;
	return absolute
		? url.toString()
		: `${url.pathname}${url.search}${url.hash}`.replace(/^\//, value.startsWith('./') ? './' : '/');
}

/** Text body of an Express redirect ("Found. Redirecting to <url>"): the URL like the Location header. */
export function normalizeText(text: string): string {
	return text.replace(
		/^(.+\. Redirecting to )(\S+)$/,
		(_m, prefix: string, url: string) => prefix + normalizeLocation(url),
	);
}
