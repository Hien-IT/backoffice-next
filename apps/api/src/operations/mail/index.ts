// Ported from directus/api/src/operations/mail/index.ts
// Backoffice: no mail is sent (Principle X, spec D-34). The rate limiter of the operation runs like in Directus, then
// one warning line replaces MailService.send; the operation resolves to undefined, as Directus does once the mail is
// handed to the transport. Body, template and data are not rendered (no markdown, no liquid).
import { defineOperationApi } from '../define-operation-api.js';
import { useLogger } from '../../logger/index.js';
import { useFlowsEmailRateLimiter } from './rate-limiter.js';

export type Options = {
	to: string;
	type: 'wysiwyg' | 'markdown' | 'template';
	subject: string;
	body?: string;
	template?: string;
	data?: Record<string, any>;
	cc?: string;
	bcc?: string;
	replyTo?: string;
};

const logger = useLogger();

export default defineOperationApi<Options>({
	id: 'mail',

	handler: async ({ to, subject }, { flow }) => {
		await useFlowsEmailRateLimiter(flow!.id);

		logger.warn(`Backoffice: mail sending is out of scope; flow mail "${subject}" to ${to} not sent`);
	},
});
