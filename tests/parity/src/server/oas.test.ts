// T048: /server/specs/oas for the public user (FR-043, FR-105). Directus is compared with CACHE_SCHEMA as configured;
// info.version and ETag are excluded, tags and paths are sorted by name before comparing.
import { afterAll, describe, expect, it } from 'vitest';
import { directusRequest } from '../directus-api.js';
import { assertParity, parity } from '../parity.js';

describe('/server/specs/oas (public)', () => {
	it('default database: tags Assets, Authentication, Server; Query and x-metadata schemas', async () => {
		const result = await parity({ path: '/server/specs/oas' });
		assertParity(result);
		const spec = result.backoffice.json as any;
		expect(spec.tags.map((t: any) => t.name).sort()).toEqual(['Assets', 'Authentication', 'Server']);
		expect(Object.keys(spec.components.schemas)).toEqual(['Query', 'x-metadata']);
		expect(spec.servers[0].description).toBe('Your current Backoffice instance.');
		expect(result.accepted.some((d) => d.id === 'D-02')).toBe(true);
	});

	it('invalid token: Directus 401, Backoffice public spec (D-10)', async () => {
		const result = await parity({ path: '/server/specs/oas', headers: { authorization: 'Bearer invalid' } });
		assertParity(result);
		expect(result.directus.status).toBe(401);
	});

	describe('a collection readable by the public policy (created through the Directus REST API)', () => {
		const collection = 'parity_articles';
		let permissionId: number | undefined;

		afterAll(async () => {
			if (permissionId) await directusRequest('DELETE', `/permissions/${permissionId}`).catch(() => undefined);
			await directusRequest('DELETE', `/collections/${collection}`).catch(() => undefined);
		});

		it('paths, tags and components match', async () => {
			await directusRequest('POST', '/collections', {
				collection,
				meta: { note: 'Articles for parity tests' },
				schema: {},
				fields: [
					{
						field: 'id',
						type: 'integer',
						meta: { hidden: true },
						schema: { is_primary_key: true, has_auto_increment: true },
					},
					{ field: 'title', type: 'string', schema: { is_nullable: false } },
					{ field: 'published', type: 'boolean', schema: { default_value: false } },
					{ field: 'secret', type: 'string' },
				],
			});

			const policies = (await directusRequest('GET', '/policies?filter[name][_eq]=$t:public_label&fields=id')).data;
			const publicPolicy =
				policies[0]?.id ??
				(await directusRequest('GET', '/access?filter[role][_null]=true&filter[user][_null]=true&fields=policy'))
					.data[0].policy;

			permissionId = (
				await directusRequest('POST', '/permissions', {
					policy: publicPolicy,
					collection,
					action: 'read',
					fields: ['id', 'title', 'published'],
				})
			).data.id;

			const result = await parity({ path: '/server/specs/oas' });
			assertParity(result);
			const spec = result.backoffice.json as any;
			expect(spec.tags.map((t: any) => t.name)).toContain('ItemsParityArticles');
			expect(spec.paths).toHaveProperty(`/items/${collection}`);
			expect(Object.keys(spec.components.schemas.ItemsParityArticles.properties)).toEqual(['id', 'title', 'published']);
		});
	});
});

describe('OPENAPI_ENABLED=false', () => {
	it.todo(
		'404 ROUTE_NOT_FOUND on both: needs a profile pair with OPENAPI_ENABLED=false (covered by apps/api unit tests)',
	);
});
