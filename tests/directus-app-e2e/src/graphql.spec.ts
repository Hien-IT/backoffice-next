// Feature 011 (spec FR-063, contracts/parity.md §6): the two places where the Directus app 11.17.4 sends GraphQL.
// Insights (stores/insights.ts) loads every panel of a dashboard with one POST /graphql and one POST /graphql/system;
// "Save as Copy" of an item (composables/use-item) reads the item through `<collection>_by_id` before it creates the
// copy. Through the proxy both requests go to the new app; the screens and the rows written match Directus alone.
import { expect, type Page, test } from '@playwright/test';
import { field } from './helpers/app.js';
import { closeHostDb } from './helpers/db-rows.js';
import { ADMIN } from './helpers/login.js';
import { containerAddress, proxyLog, upstreamOf } from './helpers/proxy-log.js';
import { bothRuns, DIRECTUS_URL } from './helpers/scenario.js';

const CATEGORIES = 'e2e_gql_categories';
const ARTICLES = 'e2e_gql_articles';

let dashboard: string;
let article: number;

async function admin(method: string, path: string, body?: unknown) {
	const login = await fetch(`${DIRECTUS_URL}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(ADMIN),
	});
	const token = ((await login.json()) as any).data.access_token as string;

	const res = await fetch(`${DIRECTUS_URL}${path}`, {
		method,
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});

	const text = await res.text();
	return text ? JSON.parse(text) : undefined;
}

const id = {
	field: 'id',
	type: 'integer',
	meta: { hidden: true },
	schema: { is_primary_key: true, has_auto_increment: true },
};

test.beforeAll(async () => {
	await admin('DELETE', `/collections/${ARTICLES}`);
	await admin('DELETE', `/collections/${CATEGORIES}`);

	await admin('POST', '/collections', {
		collection: CATEGORIES,
		schema: {},
		meta: { icon: 'category', display_template: '{{name}}' },
		fields: [id, { field: 'name', type: 'string', meta: { interface: 'input' } }],
	});

	await admin('POST', '/collections', {
		collection: ARTICLES,
		schema: {},
		meta: { icon: 'article', item_duplication_fields: ['title', 'rating', 'category'] },
		fields: [
			id,
			{ field: 'title', type: 'string', meta: { interface: 'input' } },
			{ field: 'rating', type: 'integer', meta: { interface: 'input' } },
			{ field: 'category', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
		],
	});

	await admin('POST', '/relations', { collection: ARTICLES, field: 'category', related_collection: CATEGORIES });

	const categories = (await admin('POST', `/items/${CATEGORIES}`, [{ name: 'news' }, { name: 'tech' }])).data;
	const articles = (
		await admin('POST', `/items/${ARTICLES}`, [
			{ title: 'alpha', rating: 5, category: categories[0].id },
			{ title: 'beta', rating: 3, category: categories[1].id },
			{ title: 'gamma', rating: 4, category: categories[1].id },
		])
	).data;

	article = articles[0].id;

	dashboard = (await admin('POST', '/dashboards', { name: 'e2e graphql', icon: 'insights' })).data.id;

	await admin('POST', '/panels', [
		{
			dashboard,
			type: 'metric',
			name: 'articles',
			show_header: true,
			position_x: 1,
			position_y: 1,
			width: 12,
			height: 6,
			options: { collection: ARTICLES, field: 'id', function: 'count' },
		},
		{
			dashboard,
			type: 'list',
			name: 'latest',
			show_header: true,
			position_x: 13,
			position_y: 1,
			width: 12,
			height: 10,
			options: {
				collection: ARTICLES,
				sortField: 'id',
				sortDirection: 'asc',
				limit: 5,
				displayTemplate: '{{title}} ({{category.name}})',
			},
		},
		{
			dashboard,
			type: 'metric',
			name: 'users',
			show_header: true,
			position_x: 1,
			position_y: 8,
			width: 12,
			height: 6,
			options: { collection: 'directus_users', field: 'id', function: 'count' },
		},
	]);
});

test.afterAll(async () => {
	await admin('DELETE', `/dashboards/${dashboard}`);
	await admin('DELETE', `/collections/${ARTICLES}`);
	await admin('DELETE', `/collections/${CATEGORIES}`);
	await closeHostDb();
});

const graphqlCall = (page: Page, path: string) =>
	page.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() === 'POST');

test('Insights: the panels of a dashboard load through /graphql and /graphql/system like at Directus', async ({
	browser,
}) => {
	const since = new Date().toISOString();
	const tiles: Record<string, string[]> = {};

	await bothRuns(browser, async (page, url, tag) => {
		const items = graphqlCall(page, '/graphql');
		const system = graphqlCall(page, '/graphql/system');
		await page.goto(`${url}/admin/insights/${dashboard}`);

		expect((await items).status()).toBe(200);
		expect((await system).status()).toBe(200);

		const tile = page.locator('.v-workspace-tile');
		await expect(tile).toHaveCount(3);
		await expect(tile.filter({ hasText: 'gamma' })).toHaveCount(1);
		tiles[tag.slice(-3)] = (await tile.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
	});

	expect(tiles['prx']).toEqual(tiles['dir']);
	expect(tiles['prx']!.join(' ')).toContain('alpha (news)');

	const addresses = {
		directus: containerAddress('parity-postgres-directus-1'),
		backoffice: containerAddress('parity-postgres-backoffice-api-1'),
	};

	const graphql = proxyLog(since).filter((e) => e.path.startsWith('/graphql'));
	expect(graphql.map((e) => e.path).sort()).toEqual(['/graphql', '/graphql/system']);
	expect(graphql.map((e) => upstreamOf(e, addresses))).toEqual(['backoffice', 'backoffice']);
});

test('Save as Copy: the item is read through GraphQL and copied with its duplication fields', async ({ browser }) => {
	const changes = await bothRuns(
		browser,
		async (page, url, tag) => {
			await page.goto(`${url}/admin/content/${ARTICLES}/${article}`);
			await field(page, 'Title').getByRole('textbox').fill(`${tag} copy`);

			const read = graphqlCall(page, '/graphql');
			const created = page.waitForResponse(
				(r) => new URL(r.url()).pathname === `/items/${ARTICLES}` && r.request().method() === 'POST',
			);

			await page.locator('header').locator('i[data-icon="more_vert"]').first().click();
			await page.getByText('Save as Copy').click();

			const answer = await read;
			expect(answer.status()).toBe(200);
			expect(((await answer.json()) as any).data.item).toMatchObject({ rating: 5, category: expect.anything() });
			expect((await created).status()).toBe(200);
		},
		[ARTICLES],
	);

	expect(changes['prx']).toEqual(changes['dir']);
});
