// FR-105: values that cannot match between two servers, and how they are compared instead.

/** Retry-After: compare the format only (seconds or HTTP date). */
export function normalizeHeader(name: string, value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	if (name === 'retry-after')
		return /^\d+$/.test(value) ? '<seconds>' : Number.isNaN(Date.parse(value)) ? value : '<http-date>';
	return value;
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
	if (key === 'reset' && typeof value === 'number') return '<number>';
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
