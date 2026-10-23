// Backoffice: no test in DR. NotificationsService without mail (spec FR-042, D-33, Principle X): the row is
// written, a recipient who wants mail gets a warning line instead.
import { SchemaBuilder } from '@backoffice/schema-builder';
import { afterEach, expect, test, vi } from 'vitest';
import { ItemsService } from './items.service.js';
import { NotificationsService } from './notifications.service.js';
import { UsersService } from './users.service.js';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../logger/index.js', () => ({ useLogger: () => ({ warn, trace: vi.fn(), error: vi.fn() }) }));

vi.mock('./items.service.js', async () => {
	const { mockItemsService } = await import('../test-utils/services/items-service.js');
	return mockItemsService();
});

vi.mock('./users.service.js', () => {
	const UsersService = vi.fn();
	UsersService.prototype.readOne = vi.fn();
	return { UsersService };
});

const schema = new SchemaBuilder().build();
const service = () => new NotificationsService({ schema });

afterEach(() => {
	vi.clearAllMocks();
});

test('writes the row, then warns instead of mailing a recipient who wants mail', async () => {
	vi.mocked(UsersService.prototype.readOne).mockResolvedValueOnce({
		id: 'u2',
		email: 'bo@example.com',
		email_notifications: true,
		role: null,
	});

	await expect(service().createOne({ recipient: 'u2', subject: 'You were mentioned in posts' })).resolves.toBe(1);

	expect(ItemsService.prototype.createOne).toHaveBeenCalledWith(
		{ recipient: 'u2', subject: 'You were mentioned in posts' },
		undefined,
	);
	expect(UsersService.prototype.readOne).toHaveBeenCalledWith('u2', {
		fields: ['id', 'email', 'email_notifications', 'role'],
	});
	expect(warn).toHaveBeenCalledWith(
		'Backoffice: mail sending is out of scope; notification "You were mentioned in posts" for bo@example.com not sent',
	);
});

test.each([
	['email notifications off', { id: 'u2', email: 'bo@example.com', email_notifications: false }],
	['no email', { id: 'u2', email: null, email_notifications: true }],
])('no warning when %s', async (_label, user) => {
	vi.mocked(UsersService.prototype.readOne).mockResolvedValueOnce(user);

	await service().createOne({ recipient: 'u2', subject: 's' });

	expect(warn).not.toHaveBeenCalled();
});

test('no recipient: no user is read', async () => {
	await service().sendEmail({ subject: 's' });

	expect(UsersService.prototype.readOne).not.toHaveBeenCalled();
});
