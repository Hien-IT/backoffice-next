// Spec 033 (FR-034, FR-037): the sample data the screenshots show, created through the API of the configuration and
// reused when it is already there (same names, so a second run shows the same screens). Every value is made up: no real
// person, company, address or secret.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AdminApi } from '../helpers/api.js';
import { L, LOCALE } from './lang.js';

export const COLLECTION = 'products';
export const SOURCE_URL = process.env['DOCS_SYNC_SOURCE_URL'] ?? 'http://127.0.0.1:8167';
export const SOURCE_TOKEN = process.env['DOCS_SYNC_SOURCE_TOKEN'] ?? '';

const ROOT = join(import.meta.dirname, '../../../..');

export interface Seeded {
	adminId: string;
	productIds: number[];
	roleId: string;
	policyId: string;
	userIds: string[];
	folderId: string;
	fileIds: string[];
	flowId: string;
	dashboardId: string;
	jsonPathBookmark: number;
	fieldCompareBookmark: number;
}

type Row = Record<string, unknown> & { id: string };

/** A field label in the language of the run. */
const vi = (translation: string) => [{ language: LOCALE, translation: L(translation) }];

const FIELDS = [
	{
		field: 'id',
		type: 'integer',
		schema: { is_primary_key: true, has_auto_increment: true },
		meta: { hidden: true, readonly: true, interface: 'input' },
	},
	{
		field: 'status',
		type: 'string',
		schema: { default_value: 'draft' },
		meta: {
			interface: 'select-dropdown',
			display: 'labels',
			width: 'half',
			translations: vi('Trạng thái'),
			options: {
				choices: [
					{ text: L('Đang bán'), value: 'published' },
					{ text: L('Bản nháp'), value: 'draft' },
					{ text: L('Ngừng bán'), value: 'archived' },
				],
			},
			display_options: {
				choices: [
					{ text: L('Đang bán'), value: 'published', foreground: '#FFFFFF', background: '#039855' },
					{ text: L('Bản nháp'), value: 'draft', foreground: '#344054', background: '#F2F4F7' },
					{ text: L('Ngừng bán'), value: 'archived', foreground: '#FFFFFF', background: '#667085' },
				],
			},
		},
	},
	{
		field: 'name',
		type: 'string',
		schema: {},
		meta: { interface: 'input', required: true, width: 'half', translations: vi('Tên sản phẩm') },
	},
	{ field: 'sku', type: 'string', schema: {}, meta: { interface: 'input', width: 'half', translations: vi('Mã SKU') } },
	{
		field: 'price',
		type: 'integer',
		schema: {},
		meta: { interface: 'input', width: 'half', translations: vi('Giá (đồng)') },
	},
	{
		field: 'stock',
		type: 'integer',
		schema: {},
		meta: { interface: 'input', width: 'half', translations: vi('Tồn kho') },
	},
	{
		field: 'min_stock',
		type: 'integer',
		schema: {},
		meta: { interface: 'input', width: 'half', translations: vi('Tồn tối thiểu') },
	},
	{
		field: 'specs',
		type: 'json',
		schema: {},
		meta: { interface: 'input-code', options: { language: 'JSON' }, translations: vi('Thông số') },
	},
];

const PRODUCTS = [
	{
		status: 'published',
		name: L('Áo thun cotton'),
		sku: 'AT-001',
		price: 189000,
		stock: 42,
		min_stock: 10,
		specs: { color: L('trắng'), weight: 180, tags: ['cotton', L('mùa hè')] },
	},
	{
		status: 'published',
		name: L('Áo sơ mi linen'),
		sku: 'SM-014',
		price: 459000,
		stock: 6,
		min_stock: 8,
		specs: { color: L('be'), weight: 220, tags: ['linen'] },
	},
	{
		status: 'published',
		name: L('Quần jean ống đứng'),
		sku: 'QJ-203',
		price: 529000,
		stock: 18,
		min_stock: 5,
		specs: { color: L('xanh'), weight: 640, tags: ['denim'] },
	},
	{
		status: 'draft',
		name: L('Váy hoa nhí'),
		sku: 'VH-031',
		price: 389000,
		stock: 3,
		min_stock: 6,
		specs: { color: L('đỏ'), weight: 260, tags: [L('mùa hè'), L('hoa')] },
	},
	{
		status: 'published',
		name: L('Mũ lưỡi trai'),
		sku: 'ML-007',
		price: 129000,
		stock: 55,
		min_stock: 15,
		specs: { color: L('đen'), weight: 90, tags: [L('phụ kiện')] },
	},
	{
		status: 'archived',
		name: L('Khăn len'),
		sku: 'KL-002',
		price: 159000,
		stock: 0,
		min_stock: 4,
		specs: { color: L('xám'), weight: 150, tags: [L('mùa đông')] },
	},
];

async function findOne(api: AdminApi, path: string): Promise<Row | undefined> {
	return (await api.call<Row[]>('GET', path))[0];
}

async function ensureCollection(api: AdminApi): Promise<number[]> {
	const existing = await api.call<{ collection: string }[]>('GET', '/collections');

	if (!existing.some((row) => row.collection === COLLECTION)) {
		await api.call('POST', '/collections', {
			data: {
				collection: COLLECTION,
				schema: {},
				meta: {
					icon: 'inventory_2',
					note: L('Danh mục sản phẩm của cửa hàng'),
					display_template: '{{name}}',
					translations: [{ language: LOCALE, translation: L('Sản phẩm'), singular: L('Sản phẩm'), plural: L('Sản phẩm') }],
				},
				fields: FIELDS,
			},
		});
		await api.call('POST', `/items/${COLLECTION}`, { data: PRODUCTS });
	}

	return (await api.call<{ id: number }[]>('GET', `/items/${COLLECTION}?fields=id&sort=id`)).map((row) => row.id);
}

async function ensurePolicyAndRole(api: AdminApi): Promise<{ roleId: string; policyId: string }> {
	let policy = await findOne(api, `/policies?filter[name][_eq]=${encodeURIComponent(L('Biên tập'))}&fields=id`);
	if (!policy) {
		policy = await api.createPolicy({
			name: L('Biên tập'),
			icon: 'edit_note',
			description: L('Sửa sản phẩm và file'),
			admin_access: false,
			app_access: true,
			enforce_tfa: false,
		});
		for (const action of ['read', 'update']) {
			await api.call('POST', '/permissions', {
				data: { policy: policy.id, collection: COLLECTION, action, fields: ['*'], permissions: {}, validation: {} },
			});
		}
		await api.call('POST', '/permissions', {
			data: {
				policy: policy.id,
				collection: 'directus_files',
				action: 'read',
				fields: ['*'],
				permissions: {},
				validation: {},
			},
		});
		await api.call('POST', '/backoffice/permissions', {
			data: {
				policy: policy.id,
				collection: COLLECTION,
				action: 'export',
				fields: ['*'],
				permissions: {},
				options: { formats: ['csv', 'json'] },
			},
		});
	}

	let role = await findOne(api, `/roles?filter[name][_eq]=${encodeURIComponent(L('Biên tập viên'))}&fields=id`);
	if (!role) {
		role = await api.createRole({ name: L('Biên tập viên'), icon: 'badge', description: L('Quản lý danh mục sản phẩm') });
		await api.call('POST', '/access', { data: { role: role.id, policy: policy.id } });
	}

	return { roleId: role.id, policyId: policy.id };
}

async function ensureUsers(api: AdminApi, roleId: string): Promise<string[]> {
	const people = [
		{ first_name: 'Lan', last_name: L('Nguyễn'), email: 'lan.nguyen@example.com', title: L('Biên tập viên') },
		{ first_name: 'Minh', last_name: L('Trần'), email: 'minh.tran@example.com', title: L('Quản lý kho') },
	];
	const ids: string[] = [];

	for (const person of people) {
		const found = await findOne(api, `/users?filter[email][_eq]=${encodeURIComponent(person.email)}&fields=id`);
		ids.push(
			found?.id ??
				(await api.createUser({ ...person, role: roleId, status: 'active', password: `docs-${Date.now()}-Aa1` })).id,
		);
	}

	return ids;
}

async function ensureFiles(api: AdminApi): Promise<{ folderId: string; fileIds: string[] }> {
	let folder = await findOne(api, `/folders?filter[name][_eq]=${encodeURIComponent(L('Ảnh sản phẩm'))}&fields=id`);
	if (!folder) {
		folder = await api.call<Row>('POST', '/folders', { data: { name: L('Ảnh sản phẩm') } });
		await api.call('POST', '/folders', { data: { name: L('Tài liệu') } });
	}

	const files = [
		['ao-thun-cotton.jpg', L('Áo thun cotton'), 'tests/parity/fixtures/assets/image.jpg'],
		['quan-jean.jpg', L('Quần jean ống đứng'), 'tests/parity/fixtures/assets/files-image.jpg'],
		['khan-len.jpg', L('Khăn len'), 'tests/parity/fixtures/assets/img_grayscale.jpg'],
	] as const;
	const ids: string[] = [];

	for (const [name, title, source] of files) {
		const found = await findOne(api, `/files?filter[filename_download][_eq]=${name}&fields=id`);
		ids.push(
			found?.id ??
				(
					await api.uploadFile(
						{ name, mimeType: 'image/jpeg', buffer: readFileSync(join(ROOT, source)) },
						{ title, folder: folder.id },
					)
				).id,
		);
	}

	return { folderId: folder.id, fileIds: ids };
}

async function ensureFlow(api: AdminApi): Promise<string> {
	const name = L('Cảnh báo hàng sắp hết');
	const found = await findOne(api, `/flows?filter[name][_eq]=${encodeURIComponent(name)}&fields=id`);
	if (found) return found.id;

	const flow = await api.call<Row>('POST', '/flows?fields=id', {
		data: {
			name,
			icon: 'notifications_active',
			color: null,
			description: L('Ghi log khi một sản phẩm được sửa còn ít hơn 5 cái'),
			status: 'active',
			accountability: 'all',
			trigger: 'event',
			options: { type: 'action', scope: ['items.update'], collections: [COLLECTION] },
		},
	});
	const log = await api.call<Row>('POST', '/operations?fields=id', {
		data: {
			flow: flow.id,
			key: 'ghi_log',
			name: L('Ghi log'),
			type: 'log',
			position_x: 37,
			position_y: 1,
			options: { message: L('Sản phẩm {{$trigger.keys}} sắp hết hàng') },
		},
	});
	const check = await api.call<Row>('POST', '/operations?fields=id', {
		data: {
			flow: flow.id,
			key: 'kiem_tra_ton',
			name: L('Kiểm tra tồn kho'),
			type: 'condition',
			position_x: 19,
			position_y: 1,
			resolve: log.id,
			options: { filter: { $trigger: { payload: { stock: { _lt: 5 } } } } },
		},
	});
	await api.call('PATCH', `/flows/${flow.id}`, { data: { operation: check.id } });
	return flow.id;
}

async function ensureDashboard(api: AdminApi): Promise<string> {
	const name = L('Bán hàng');
	const found = await findOne(api, `/dashboards?filter[name][_eq]=${encodeURIComponent(name)}&fields=id`);
	if (found) return found.id;

	const dashboard = await api.call<Row>('POST', '/dashboards?fields=id', {
		data: { name, icon: 'storefront', note: L('Tình hình bán hàng và tồn kho') },
	});
	await api.call('POST', '/panels', {
		data: [
			{
				dashboard: dashboard.id,
				name: L('Sản phẩm đang bán'),
				icon: 'inventory_2',
				type: 'metric',
				show_header: true,
				position_x: 1,
				position_y: 1,
				width: 12,
				height: 6,
				options: { collection: COLLECTION, field: 'id', function: 'count', filter: { status: { _eq: 'published' } } },
			},
			{
				dashboard: dashboard.id,
				name: L('Tổng tồn kho'),
				icon: 'warehouse',
				type: 'metric',
				show_header: true,
				position_x: 13,
				position_y: 1,
				width: 12,
				height: 6,
				options: { collection: COLLECTION, field: 'stock', function: 'sum' },
			},
			{
				dashboard: dashboard.id,
				name: L('Sắp hết hàng'),
				icon: 'warning',
				type: 'list',
				show_header: true,
				position_x: 1,
				position_y: 7,
				width: 24,
				height: 12,
				options: {
					collection: COLLECTION,
					limit: 5,
					sortField: 'stock',
					sortDirection: 'asc',
					displayTemplate: L('{{name}} — còn {{stock}}'),
				},
			},
		],
	});
	return dashboard.id;
}

async function ensureNotification(api: AdminApi, adminId: string): Promise<void> {
	const subject = L('Sản phẩm Váy hoa nhí sắp hết hàng');
	if (await findOne(api, `/notifications?filter[subject][_eq]=${encodeURIComponent(subject)}&fields=id`)) return;
	await api.call('POST', '/notifications', {
		data: {
			recipient: adminId,
			subject,
			message: L('Còn 3 cái, dưới mức tối thiểu 6.'),
			collection: COLLECTION,
			item: '4',
		},
	});
}

async function ensureIndex(api: AdminApi): Promise<void> {
	const indexes = await api.call<{ fields: string[] }[]>('GET', `/backoffice/collections/${COLLECTION}/indexes`);
	if (indexes.some((index) => index.fields.join() === 'status,stock')) return;
	await api.call('POST', `/backoffice/collections/${COLLECTION}/indexes`, { data: { fields: ['status', 'stock'] } });
}

async function ensureExtension(api: AdminApi): Promise<void> {
	const extensions = await api.call<
		{ schema: { name?: string } | null; bundle: string | null; meta?: { source?: string } }[]
	>('GET', '/extensions');
	if (extensions.some((extension) => extension.meta?.source === 'upload')) return;

	const file = join(ROOT, 'tests/fixtures/extensions/parity-panel-counter/parity-panel-counter-1.0.0.tgz');
	await api.call('POST', '/backoffice/extensions/upload', {
		multipart: {
			file: { name: 'parity-panel-counter-1.0.0.tgz', mimeType: 'application/gzip', buffer: readFileSync(file) },
		},
	});
}

async function ensureBookmark(api: AdminApi, adminId: string, bookmark: string, filter: unknown): Promise<number> {
	const found = await findOne(api, `/presets?filter[bookmark][_eq]=${encodeURIComponent(bookmark)}&fields=id`);
	if (found) return Number(found.id);
	const row = await api.call<{ id: number }>('POST', '/presets?fields=id', {
		data: { bookmark, collection: COLLECTION, user: adminId, layout: 'tabular', filter },
	});
	return row.id;
}

/** The source of the environment sync page: a second API with a flow and a collection the target lacks. */
async function ensureSyncSource(): Promise<void> {
	if (!SOURCE_TOKEN) return;
	const call = async (method: string, path: string, data?: unknown) => {
		const response = await fetch(`${SOURCE_URL}${path}`, {
			method,
			headers: { authorization: `Bearer ${SOURCE_TOKEN}`, 'content-type': 'application/json' },
			...(data ? { body: JSON.stringify(data) } : {}),
		});
		if (!response.ok) throw new Error(`source ${method} ${path}: ${response.status} ${await response.text()}`);
		return response.status === 204 ? undefined : ((await response.json()) as { data: unknown }).data;
	};

	const collections = (await call('GET', '/collections')) as { collection: string }[];
	if (!collections.some((row) => row.collection === 'orders')) {
		await call('POST', '/collections', {
			collection: 'orders',
			schema: {},
			meta: { icon: 'receipt_long', note: L('Đơn hàng') },
			fields: [
				{
					field: 'id',
					type: 'integer',
					schema: { is_primary_key: true, has_auto_increment: true },
					meta: { hidden: true },
				},
				{ field: 'code', type: 'string', schema: {}, meta: { interface: 'input' } },
				{ field: 'total', type: 'integer', schema: {}, meta: { interface: 'input' } },
			],
		});
	}

	const flows = (await call('GET', `/flows?filter[name][_eq]=${encodeURIComponent(L('Gửi hóa đơn'))}&fields=id`)) as Row[];
	if (!flows.length) {
		await call('POST', '/flows', {
			name: L('Gửi hóa đơn'),
			icon: 'mail',
			status: 'inactive',
			trigger: 'manual',
			accountability: 'all',
			options: { collections: ['orders'] },
		});
	}
}

export async function seed(api: AdminApi): Promise<Seeded> {
	const admin = await api.call<{ id: string }>('GET', '/users/me?fields=id');
	const productIds = await ensureCollection(api);
	const { roleId, policyId } = await ensurePolicyAndRole(api);
	const userIds = await ensureUsers(api, roleId);
	const { folderId, fileIds } = await ensureFiles(api);
	const flowId = await ensureFlow(api);
	const dashboardId = await ensureDashboard(api);
	await ensureNotification(api, admin.id);
	await ensureIndex(api);
	await ensureExtension(api);
	await ensureSyncSource();
	const jsonPathBookmark = await ensureBookmark(api, admin.id, L('Màu đỏ'), { 'json(specs, color)': { _eq: L('đỏ') } });
	const fieldCompareBookmark = await ensureBookmark(api, admin.id, L('Dưới mức tối thiểu'), {
		stock: { _lt: '$FIELD(min_stock)' },
	});

	return {
		adminId: admin.id,
		productIds,
		roleId,
		policyId,
		userIds,
		folderId,
		fileIds,
		flowId,
		dashboardId,
		jsonPathBookmark,
		fieldCompareBookmark,
	};
}
