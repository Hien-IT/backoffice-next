// Backoffice (spec 020, D-141): the MailService of the extension context runs the email.send filter, then logs instead
// of sending; getDefaultTemplateData reads the settings like DR.
import { beforeEach, expect, test, vi } from 'vitest';
import emitter from '../emitter.js';
import { MailService } from './mail.service.js';

const warn = vi.fn();

vi.mock('@backoffice/env', () => ({ useEnv: () => ({ PUBLIC_URL: 'http://example.com/' }) }));
vi.mock('../logger/index.js', () => ({ useLogger: () => ({ warn }) }));
vi.mock('../database/index.js', () => ({ default: vi.fn() }));
vi.mock('../emitter.js', () => ({ default: { emitFilter: vi.fn() } }));

const first = vi.fn();
const knex = { select: () => ({ from: () => ({ first }) }) } as any;
const service = () => new MailService({ knex, schema: {} as any });

beforeEach(() => {
	vi.clearAllMocks();
});

test('send runs the email.send filter, logs and sends nothing', async () => {
	vi.mocked(emitter.emitFilter).mockImplementation(async (_event, data: any) => ({ ...data, subject: 'Changed' }));

	await expect(service().send({ to: ['a@x.io', 'b@x.io'], subject: 'Hi' })).resolves.toBeNull();

	expect(emitter.emitFilter).toHaveBeenCalledWith('email.send', { to: ['a@x.io', 'b@x.io'], subject: 'Hi' }, {});
	expect(warn).toHaveBeenCalledWith(expect.stringContaining('"Changed" to a@x.io, b@x.io not sent'));
});

test('a filter returning nothing cancels the mail without a log line', async () => {
	vi.mocked(emitter.emitFilter).mockResolvedValue(undefined);

	await expect(service().send({ to: 'a@x.io' })).resolves.toBeNull();
	expect(warn).not.toHaveBeenCalled();
});

test('getDefaultTemplateData', async () => {
	first.mockResolvedValueOnce(undefined);

	await expect(service().getDefaultTemplateData()).resolves.toEqual({
		projectName: 'Directus',
		projectColor: '#171717',
		projectLogo: 'http://example.com/admin/img/directus-white.png',
		projectUrl: '',
	});

	first.mockResolvedValueOnce({ project_name: 'P', project_logo: 'f1', project_color: '#000000', project_url: 'u' });

	await expect(service().getDefaultTemplateData()).resolves.toEqual({
		projectName: 'P',
		projectColor: '#000000',
		projectLogo: 'http://example.com/assets/f1',
		projectUrl: 'u',
	});
});
