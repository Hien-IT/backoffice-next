// Backoffice: no test in DR. OperationsService reloads the flows after every write (spec FR-002).
import { SchemaBuilder } from '@backoffice/schema-builder';
import { afterEach, expect, test, vi } from 'vitest';
import { ItemsService } from './items.service.js';
import { OperationsService } from './operations.service.js';

const { reload } = vi.hoisted(() => ({ reload: vi.fn() }));
vi.mock('../flows.js', () => ({ getFlowManager: () => ({ reload }) }));

vi.mock('./items.service.js', async () => {
	const { mockItemsService } = await import('../test-utils/services/items-service.js');
	return mockItemsService();
});

const service = () => new OperationsService({ schema: new SchemaBuilder().build() });

afterEach(() => {
	vi.clearAllMocks();
});

test('createOne, updateMany and deleteMany each reload the flows once after the write', async () => {
	await expect(service().createOne({ key: 'a' })).resolves.toBe(1);
	expect(reload).toHaveBeenCalledTimes(1);

	vi.mocked(ItemsService.prototype.updateMany).mockResolvedValueOnce(['o1']);
	await expect(service().updateMany(['o1'], { name: 'b' })).resolves.toEqual(['o1']);
	expect(reload).toHaveBeenCalledTimes(2);

	vi.mocked(ItemsService.prototype.deleteMany).mockResolvedValueOnce(['o1']);
	await expect(service().deleteMany(['o1'])).resolves.toEqual(['o1']);
	expect(reload).toHaveBeenCalledTimes(3);
});

test('a failed write does not reload', async () => {
	vi.mocked(ItemsService.prototype.createOne).mockRejectedValueOnce(new Error('invalid'));

	await expect(service().createOne({})).rejects.toThrow('invalid');
	expect(reload).not.toHaveBeenCalled();
});
