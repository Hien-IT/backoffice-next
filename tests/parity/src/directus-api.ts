// Writes test data through the REST API of the reference Directus (admin from env/<vendor>.env), so Directus
// purges its own cache like for any real change. The API under test never writes.
let token: string | undefined;

async function login(): Promise<string> {
	if (token) return token;

	const res = await fetch(new URL('/auth/login', process.env['DIRECTUS_URL']), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: 'admin@example.com', password: 'password' }),
	});

	if (!res.ok) throw new Error(`Directus login failed: ${res.status} ${await res.text()}`);
	token = ((await res.json()) as { data: { access_token: string } }).data.access_token;
	return token;
}

export async function directusRequest(
	method: string,
	path: string,
	body?: unknown,
	baseUrl = process.env['DIRECTUS_URL'],
): Promise<any> {
	const res = await fetch(new URL(path, baseUrl), {
		method,
		headers: {
			authorization: `Bearer ${await login()}`,
			...(body !== undefined && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
		},
		...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
	});

	const text = await res.text();
	if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`);
	return text ? JSON.parse(text) : undefined;
}
