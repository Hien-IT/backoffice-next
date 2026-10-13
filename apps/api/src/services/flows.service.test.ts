// Backoffice: no test in Directus. FlowsService reloads the flows after every write and unlinks the operations of the
// deleted flows first (spec FR-002, R-22).
import { SchemaBuilder } from '@backoffice/schema-builder';
import { afterEach, expect, test, vi } from 'vitest';
import { getFlowManager } from '../flows.js';
import { FlowsService } from './flows.service.js';
import { ItemsService } from './items.service.js';

const { reload } = vi.hoisted(() => ({ reload: vi.fn() }));
vi.mock('../flows.js', () => ({ getFlowManager: vi.fn(() => ({ reload })) }));

vi.mock('./items.service.js', async () => {
	const { mockItemsService } = await import('../test-utils/services/items-service.js');
	return mockItemsService();
});

const schema = new SchemaBuilder().build();

const knexWith = (calls: string[]) => {
	const whereIn = vi.fn(async () => {
		calls.push('unlink');
	});

	const update = vi.fn(() => ({ whereIn }));
	const knex = vi.fn(() => ({ update })) as any;
	return { knex, update, whereIn };
};

afterEach(() => {
	vi.clearAllMocks();
});

test('createOne and updateMany reload the flows once after the write', async () => {
	const service = new FlowsService({ schema, knex: knexWith([]).knex });

	await expect(service.createOne({ name: 'a' })).resolves.toBe(1);
	expect(reload).toHaveBeenCalledTimes(1);

	vi.mocked(ItemsService.prototype.updateMany).mockResolvedValueOnce(['f1']);
	await expect(service.updateMany(['f1'], { status: 'inactive' })).resolves.toEqual(['f1']);
	expect(reload).toHaveBeenCalledTimes(2);
	expect(getFlowManager).toHaveBeenCalled();
});

test('deleteMany unlinks resolve and reject of the operations of the flows, then deletes and reloads', async () => {
	const calls: string[] = [];
	const { knex, update, whereIn } = knexWith(calls);

	vi.mocked(ItemsService.prototype.deleteMany).mockImplementationOnce(async (keys: any) => {
		calls.push('delete');
		return keys;
	});

	await expect(new FlowsService({ schema, knex }).deleteMany(['f1', 'f2'])).resolves.toEqual(['f1', 'f2']);

	expect(knex).toHaveBeenCalledWith('directus_operations');
	expect(update).toHaveBeenCalledWith({ resolve: null, reject: null });
	expect(whereIn).toHaveBeenCalledWith('flow', ['f1', 'f2']);
	expect(calls).toEqual(['unlink', 'delete']);
	expect(reload).toHaveBeenCalledTimes(1);
});

test('R-22: the operations stay unlinked when the delete itself fails (no permission), and nothing reloads', async () => {
	const calls: string[] = [];
	const { knex } = knexWith(calls);
	vi.mocked(ItemsService.prototype.deleteMany).mockRejectedValueOnce(new Error('forbidden'));

	await expect(new FlowsService({ schema, knex }).deleteMany(['f1'])).rejects.toThrow('forbidden');

	expect(calls).toEqual(['unlink']);
	expect(reload).not.toHaveBeenCalled();
});
