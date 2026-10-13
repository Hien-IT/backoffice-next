// Backoffice: no test in Directus. CommentsService (spec FR-040, FR-041, contracts/history-api.md §3): the order of
// the checks, mentions that notify readers of the item, and those that cannot read it.
import { ForbiddenError } from '@backoffice/errors';
import { SchemaBuilder } from '@backoffice/schema-builder';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { validateAccess } from '../permissions/modules/validate-access/validate-access.js';
import { CommentsService } from './comments.service.js';
import { ItemsService } from './items.service.js';
import { NotificationsService } from './notifications.service.js';
import { UsersService } from './users.service.js';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../logger/index.js', () => ({ useLogger: () => ({ warn, trace: vi.fn(), error: vi.fn() }) }));
vi.mock('@backoffice/env', () => ({ useEnv: () => ({ PUBLIC_URL: 'http://example.com' }) }));
vi.mock('../permissions/modules/validate-access/validate-access.js', () => ({ validateAccess: vi.fn() }));
vi.mock('../permissions/lib/fetch-roles-tree.js', () => ({ fetchRolesTree: vi.fn(async () => ['r1']) }));

vi.mock('../permissions/modules/fetch-global-access/fetch-global-access.js', () => ({
	fetchGlobalAccess: vi.fn(async () => ({ admin: false, app: true })),
}));

vi.mock('./items.service.js', async () => {
	const { mockItemsService } = await import('../test-utils/services/items-service.js');
	return mockItemsService();
});

vi.mock('./users.service.js', () => {
	const UsersService = vi.fn(function (this: any, options: any) {
		this.options = options;
	});
	UsersService.prototype.readOne = vi.fn();
	UsersService.prototype.readByQuery = vi.fn();
	return { UsersService };
});

vi.mock('./notifications.service.js', () => {
	const NotificationsService = vi.fn();
	NotificationsService.prototype.createOne = vi.fn();
	return { NotificationsService };
});

const schema = new SchemaBuilder()
	.collection('posts', (c) => {
		c.field('id').id();
	})
	.build();

const SENDER = '2b1c3d4e-0000-4000-8000-000000000001';
const READER = '3c1c3d4e-0000-4000-8000-000000000002';
const accountability = { user: SENDER, role: null, roles: [], admin: false, app: true, ip: null } as any;
const service = () => new CommentsService({ schema, accountability });

afterEach(() => {
	vi.clearAllMocks();
});

describe('createOne checks', () => {
	test('no user is Forbidden, before the payload checks', async () => {
		const anonymous = new CommentsService({ schema, accountability: { ...accountability, user: null } });

		await expect(anonymous.createOne({})).rejects.toBeInstanceOf(ForbiddenError);
	});

	test.each([
		[{}, '"comment" is required'],
		[{ comment: 'x' }, '"collection" is required'],
		[{ comment: 'x', collection: 'posts' }, '"item" is required'],
		[{ comment: '', collection: 'posts', item: '1' }, '"comment" is required'],
	])('%j is invalid: %s', async (data, reason) => {
		await expect(service().createOne(data as any)).rejects.toMatchObject({
			code: 'INVALID_PAYLOAD',
			extensions: { reason },
		});
	});

	test('the author must read the item; nothing is written otherwise', async () => {
		vi.mocked(validateAccess).mockRejectedValueOnce(new ForbiddenError());

		await expect(service().createOne({ comment: 'x', collection: 'posts', item: '1' })).rejects.toBeInstanceOf(
			ForbiddenError,
		);

		expect(validateAccess).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'read', collection: 'posts', primaryKeys: ['1'] }),
			expect.anything(),
		);
		expect(ItemsService.prototype.createOne).not.toHaveBeenCalled();
	});

	test('without a mention: the comment is written and no user is read', async () => {
		await expect(service().createOne({ comment: 'hello', collection: 'posts', item: '1' })).resolves.toBe(1);
		expect(UsersService.prototype.readOne).not.toHaveBeenCalled();
	});

	test('update and delete without a user are Forbidden', async () => {
		const anonymous = new CommentsService({ schema, accountability: null });

		expect(() => anonymous.updateOne('c1', { comment: 'x' })).toThrow(ForbiddenError);
		expect(() => anonymous.deleteOne('c1')).toThrow(ForbiddenError);
	});
});

describe('mentions', () => {
	const sender = { id: SENDER, first_name: 'Ann', last_name: 'Lee', email: 'ann@example.com' };
	const reader = { id: READER, first_name: 'Bo', last_name: null, email: 'bo@example.com', role: { id: 'r1' } };

	test('a reader of the item gets a notification; the same uuid in other case counts again, like Directus', async () => {
		vi.mocked(UsersService.prototype.readOne)
			.mockResolvedValueOnce(sender)
			.mockResolvedValueOnce(reader)
			.mockResolvedValueOnce(reader);
		vi.mocked(UsersService.prototype.readByQuery).mockResolvedValue([reader]);

		await service().createOne({
			comment: `hi @${READER}\nsee @${READER.toUpperCase()} and @${READER}`,
			collection: 'posts',
			item: '1',
		});

		// The regex ignores case but uniq() compares the strings as written: two spellings, two notifications.
		expect(NotificationsService.prototype.createOne).toHaveBeenCalledTimes(2);
		expect(NotificationsService.prototype.createOne).toHaveBeenCalledWith({
			recipient: READER,
			sender: SENDER,
			subject: 'You were mentioned in posts',
			message: expect.stringContaining('Ann Lee has mentioned you in a comment:'),
			collection: 'posts',
			item: '1',
		});

		const { message } = vi.mocked(NotificationsService.prototype.createOne).mock.calls[0]![0] as any;
		// The names are keyed by the stored (lower case) id: the upper case spelling prints "@Unknown User".
		expect(message).toContain(`> hi <em>Bo</em>\n> see @Unknown User and <em>Bo</em>`);
		expect(message).toContain('<a href="http://example.com/admin/content/posts/1">Click here to view.</a>');
		expect(message).toContain('Hello Bo,');
	});

	test('a mentioned user who cannot read the item gets a warning, not a notification', async () => {
		vi.mocked(UsersService.prototype.readOne).mockResolvedValueOnce(sender).mockResolvedValueOnce(reader);
		vi.mocked(validateAccess).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new ForbiddenError());

		await expect(service().createOne({ comment: `@${READER}`, collection: 'posts', item: '1' })).resolves.toBe(1);

		expect(NotificationsService.prototype.createOne).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith(
			`User ${READER} doesn't have proper permissions to receive notification for this item.`,
		);
	});

	test('a mentioned user that does not exist fails after the comment was written', async () => {
		vi.mocked(UsersService.prototype.readOne).mockResolvedValueOnce(sender).mockRejectedValueOnce(new ForbiddenError());

		await expect(service().createOne({ comment: `@${READER}`, collection: 'posts', item: '1' })).rejects.toBeInstanceOf(
			ForbiddenError,
		);

		expect(ItemsService.prototype.createOne).toHaveBeenCalledTimes(1);
	});

	test('another error while notifying is thrown', async () => {
		vi.mocked(UsersService.prototype.readOne).mockResolvedValueOnce(sender).mockResolvedValueOnce(reader);
		vi.mocked(UsersService.prototype.readByQuery).mockRejectedValueOnce(new Error('db down'));

		await expect(service().createOne({ comment: `@${READER}`, collection: 'posts', item: '1' })).rejects.toThrow(
			'db down',
		);
	});
});
