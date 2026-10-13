// Backoffice: rewrite of directus/api/src/operations/mail/index.test.ts. The seven option sets of the Directus test,
// which spy on MailService.send and md(); here no mail is sent (spec D-34, FR-036): each one writes the same warning
// line once, after the rate limiter, and resolves to undefined.
import { EmailLimitExceededError } from '@backoffice/errors';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Options } from './index.js';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
const limiter = vi.hoisted(() => vi.fn(async (_flow: string) => undefined));

vi.mock('../../logger/index.js', () => ({ useLogger: () => ({ warn }) }));
vi.mock('./rate-limiter.js', () => ({ useFlowsEmailRateLimiter: limiter }));

const { default: config } = await import('./index.js');
const context = { flow: { id: 'flow-1' } } as any;
const base = { to: 'test@example.com', subject: 'Test' };

beforeEach(() => {
	vi.clearAllMocks();
});

test.each<[string, Options]>([
	['template without a template name', { ...base, type: 'template' }],
	['a custom template', { ...base, type: 'template', template: 'custom' }],
	['template data', { ...base, type: 'template', data: { var: 'value' } }],
	['a custom template with data', { ...base, type: 'template', template: 'custom', data: { var: 'value' } }],
	['a wysiwyg body', { ...base, type: 'wysiwyg', body: '<p>test</p>' }],
	['a markdown body', { ...base, type: 'markdown', body: '# test' }],
	[
		'cc, bcc and replyTo',
		{ ...base, type: 'wysiwyg', body: 'x', cc: 'cc@example.com', bcc: 'bcc@example.com', replyTo: 'r@example.com' },
	],
])('%s: one warning line instead of the mail, after the rate limiter', async (_label, options) => {
	await expect(config.handler(options, context)).resolves.toBeUndefined();

	expect(limiter).toHaveBeenCalledWith('flow-1');
	expect(warn).toHaveBeenCalledOnce();
	expect(warn).toHaveBeenCalledWith(
		'Backoffice: mail sending is out of scope; flow mail "Test" to test@example.com not sent',
	);
});

test('over the rate limit: the limiter error rejects the operation and nothing is logged', async () => {
	limiter.mockRejectedValueOnce(new EmailLimitExceededError({ points: 1, duration: 60 }));

	await expect(config.handler({ ...base, type: 'wysiwyg' }, context)).rejects.toBeInstanceOf(EmailLimitExceededError);
	expect(warn).not.toHaveBeenCalled();
});
