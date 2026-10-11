// Ported from directus/tests/blackbox/common/transport.ts (requestGraphQL only).
// Backoffice: GraphQL comes with feature 011, so every GraphQL request goes to the Directus of the blackbox pair
// (getSetupUrl), whatever host the test passes; the WebSocket helpers are left out (Principle XI, D-17).
import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import request, { type Response } from 'supertest';
import { getSetupUrl } from './config';

export function processGraphQLJson(jsonQuery: any) {
	return jsonToGraphQLQuery(jsonQuery);
}

export async function requestGraphQL(
	_host: string,
	isSystemCollection: boolean,
	token: string | null,
	jsonQuery: any,
	options?: { variables?: any; cookies?: string[] },
): Promise<Response> {
	const req = request(getSetupUrl())
		.post(isSystemCollection ? '/graphql/system' : '/graphql')
		.send({
			query: processGraphQLJson(jsonQuery),
			variables: options?.variables,
		});

	if (token) req.set('Authorization', `Bearer ${token}`);
	if (options?.cookies) req.set('Cookie', options.cookies);

	return await req;
}
