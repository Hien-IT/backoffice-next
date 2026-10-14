// Ported from directus/tests/blackbox/common/transport.ts (requestGraphQL only).
// Backoffice: the GraphQL request goes to the host the test passes, the app under test, since feature 011; the
// WebSocket helpers are left out (Principle XI, D-17).
import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import request, { type Response } from 'supertest';

export function processGraphQLJson(jsonQuery: any) {
	return jsonToGraphQLQuery(jsonQuery);
}

export async function requestGraphQL(
	host: string,
	isSystemCollection: boolean,
	token: string | null,
	jsonQuery: any,
	options?: { variables?: any; cookies?: string[] },
): Promise<Response> {
	const req = request(host)
		.post(isSystemCollection ? '/graphql/system' : '/graphql')
		.send({
			query: processGraphQLJson(jsonQuery),
			variables: options?.variables,
		});

	if (token) req.set('Authorization', `Bearer ${token}`);
	if (options?.cookies) req.set('Cookie', options.cookies);

	return await req;
}
