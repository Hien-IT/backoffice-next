// Ported from directus/tests/blackbox/tests/db/mail/mail.test.ts
// Backoffice (feature 010, T023, D-33, research R15): no email is ever sent (Principle X), so the fake SMTP server and
// the wait for two messages are gone. Each app answers 200 and writes the two notifications; Backoffice writes one
// warning line per notification whose recipient has an email and email_notifications on, instead of the mail. The
// Directus of the blackbox pair has no reachable mail server either (its send fails in the background, the response is
// the same), so the original assertion cannot hold at either app of the parity env.
import { getUrl } from '@common/config';
import vendors from '@common/get-dbs-to-test';
import { USER } from '@common/variables';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { logs } from '../../../../../docker.js';

const WARNING = 'mail sending is out of scope; notification "inbox"';
const backoffice = process.env['PARITY_BLACKBOX_APP'] !== 'directus';
const warnings = () =>
	logs('backoffice-api-blackbox')
		.split('\n')
		.filter((line) => line.includes(WARNING)).length;

describe('Mail', async () => {
	describe('POST /notifications', () => {
		it.each(vendors)('%s', async (vendor) => {
			// Setup
			const notifications = [
				{
					recipient: USER.TESTS_FLOW.ID,
					subject: 'inbox',
					message: 'Lorem Ipsum',
				},
				{
					recipient: USER.TESTS_FLOW.ID,
					subject: 'inbox',
					message: 'Dolor Sat',
				},
			];

			// Backoffice: email_notifications on and an email, so Directus would send both (users default to true).
			await request(getUrl(vendor))
				.patch(`/users/${USER.TESTS_FLOW.ID}`)
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
				.send({ email_notifications: true });

			const before = backoffice ? warnings() : 0;

			// action
			const response = await request(getUrl(vendor))
				.post('/notifications')
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
				.send(notifications);

			// Checks
			expect(response.status).toEqual(200);

			// Backoffice: the two rows instead of the two messages.
			const written = await request(getUrl(vendor))
				.get(`/notifications?filter[recipient][_eq]=${USER.TESTS_FLOW.ID}&sort=-id&limit=2&fields=subject,message`)
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			expect(written.body.data).toEqual([
				{ subject: 'inbox', message: 'Dolor Sat' },
				{ subject: 'inbox', message: 'Lorem Ipsum' },
			]);

			if (backoffice) expect(warnings() - before).toBe(2);
		});
	});
});
