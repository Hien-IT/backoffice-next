// Spec 033 T053 (FR-024..FR-027, FR-039, FR-046, Q-50): an endpoint card of the API part.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { DocsApiOperation, JsonSchema } from '../../../docs/types.ts';
import { i18n } from '../../../lang/index.ts';
import DocsEndpoint from './DocsEndpoint.vue';

enableAutoUnmount(afterEach);

const writeText = vi.fn();

beforeEach(() => {
	writeText.mockReset().mockResolvedValue(undefined);
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

const SCHEMAS: Record<string, JsonSchema> = {
	Files: {
		type: 'object',
		properties: {
			id: { type: 'string', description: 'Unique identifier.' },
			folder: { oneOf: [{ type: 'string' }, { $ref: '#/schemas/Folders' }], description: 'Folder <script>x</script>.' },
		},
	},
};

const LIST: DocsApiOperation = {
	id: 'getFiles',
	anchor: 'list-files',
	method: 'GET',
	path: '/files',
	summary: 'List Files',
	description: 'List the `files`.',
	lang: 'en',
	query: [{ name: 'limit', type: 'integer', required: false, description: 'A limit.', lang: 'en' }],
	pathParams: [],
	responses: [
		{
			status: '200',
			description: 'Successful request',
			schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/schemas/Files' } } } },
		},
		{ status: '401', description: 'Error: Unauthorized request' },
	],
	rest: 'curl "https://backoffice.example.com/files?limit=2" \\\n  -H "Authorization: Bearer <token>"',
	graphql: '# POST /graphql/system\nquery {\n  files(limit: 2) {\n    id\n  }\n}',
	responseExample: { data: [{ id: 'a' }] },
	backofficeOnly: false,
};

const CREATE_INDEX: DocsApiOperation = {
	id: 'createIndex',
	anchor: 'tao-index-cho-mot-collection',
	method: 'POST',
	path: '/backoffice/collections/{collection}/indexes',
	summary: 'Tạo index cho một collection',
	description: '',
	lang: 'vi',
	query: [],
	pathParams: [{ name: 'collection', type: 'string', required: true, description: 'Tên collection.', lang: 'vi' }],
	body: {
		contentType: 'application/json',
		required: true,
		schema: {
			type: 'object',
			required: ['fields'],
			'x-lang': 'vi',
			properties: { fields: { type: 'array', items: { type: 'string' }, description: 'Các field.' } },
		},
	},
	responses: [{ status: '202', description: 'Đã nhận' }],
	rest: 'curl -X POST "https://backoffice.example.com/backoffice/collections/articles/indexes"',
	graphql: false,
	backofficeOnly: true,
	access: 'admin',
};

async function card(operation: DocsApiOperation) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
	});
	await router.push('/docs/api/files');
	const wrapper = mount(DocsEndpoint, {
		props: { operation, schemas: SCHEMAS },
		attachTo: document.body,
		global: { plugins: [i18n, router] },
	});
	await flushPromises();
	return { wrapper, router };
}

describe('DocsEndpoint', () => {
	test('heading with its anchor, the method written in its chip, the path; English text marked', async () => {
		const { wrapper } = await card(LIST);
		const heading = wrapper.find('h2');

		expect(heading.attributes('id')).toBe('list-files');
		expect(heading.attributes('lang')).toBe('en');
		expect(heading.text()).toContain('List Files');
		expect(wrapper.find('[data-method]').text()).toBe('GET');
		expect(wrapper.find('[data-method]').classes()).toContain('bg-success-50');
		expect(wrapper.find('[data-path]').text()).toBe('/files');
		expect(wrapper.find('section').attributes('aria-labelledby')).toBe('list-files');
		expect(wrapper.find('[data-access]').exists()).toBe(false);
	});

	test('parameters and parts are third-level headings over scoped tables; backticks become code', async () => {
		const { wrapper } = await card(LIST);

		expect(wrapper.findAll('h3').map((h3) => h3.text())).toEqual([
			'Query parameters',
			'Responses',
			'Examples',
			'Response example',
		]);
		const table = wrapper.find('.docs-table');
		expect(table.attributes('role')).toBe('region');
		expect(table.findAll('th').map((th) => th.attributes('scope'))).toEqual(['col', 'col', 'col']);
		expect(table.find('tbody td').text()).toBe('limit');
		expect(wrapper.find('p[lang="en"] code').text()).toBe('files');
	});

	test('responses by status; the structure of the success answer in a closed detail, markup kept as text', async () => {
		const { wrapper } = await card(LIST);

		expect(
			wrapper.findAll('[data-responses] li').map((li) => [li.find('code').text(), li.find('span').text()]),
		).toEqual([
			['200', 'Successful request'],
			['401', 'Error: Unauthorized request'],
		]);

		const detail = wrapper.findAll('button').find((button) => button.text().includes('Structure of the answer'))!;
		expect(detail.text()).toContain('Files[]');
		expect(detail.attributes('aria-expanded')).toBe('false');

		await detail.trigger('click');
		const rows = wrapper.findAll('tbody tr').slice(1);
		expect(rows.map((row) => row.findAll('td').map((td) => td.text()))).toEqual([
			['id', 'string', 'Unique identifier.'],
			['folder', 'string | Folders', 'Folder <script>x</script>.'],
		]);
		expect(wrapper.find('script').exists()).toBe(false);
	});

	test('REST and GraphQL in tabs; the response example as JSON', async () => {
		const { wrapper } = await card(LIST);

		expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['REST', 'GraphQL']);
		expect(wrapper.find('[role="tabpanel"] code').attributes('data-lang')).toBe('bash');
		expect(wrapper.findAll('code[data-lang="json"]').at(-1)!.text()).toContain('"id": "a"');
	});

	test('a Backoffice-only route: no GraphQL tab, who may call it, the body and path parameters in Vietnamese', async () => {
		const { wrapper } = await card(CREATE_INDEX);

		expect(wrapper.find('[role="tab"]').exists()).toBe(false);
		expect(wrapper.find('code[data-lang="bash"]').exists()).toBe(true);
		expect(wrapper.find('[data-access]').text()).toBe('Available only when the server is Backoffice. Admin only.');
		expect(wrapper.find('[data-method]').classes()).toContain('bg-blue-light-50');
		expect(wrapper.findAll('h3').map((h3) => h3.text())).toEqual([
			'Path parameters',
			'Request body',
			'Responses',
			'Examples',
		]);

		const body = wrapper.findAll('.docs-table')[1]!;
		expect(body.find('tbody td').text()).toContain('fields');
		expect(body.find('tbody td').text()).toContain('required');
		expect(body.findAll('tbody td')[2]!.attributes('lang')).toBe('vi');
		// No success schema, no example: those parts are not shown empty.
		expect(wrapper.text()).not.toContain('Structure of the answer');
		expect(wrapper.text()).not.toContain('Response example');
	});

	test('the sign of the heading copies the link and puts the anchor in the URL', async () => {
		const { wrapper, router } = await card(LIST);

		await wrapper.find('h2 a.docs-anchor').trigger('click');
		await flushPromises();

		expect(String(writeText.mock.calls[0]![0])).toMatch(/#list-files$/);
		expect(router.currentRoute.value.hash).toBe('#list-files');
	});
});
