// Ported from directus/api/src/services/notifications.ts
// Backoffice: no mail (Principle X, spec FR-042, D-33): sendEmail decides like Directus whether the recipient gets a
// mail, then writes a warning instead of rendering and sending it. Gone with it: md, Url, fetchRolesTree,
// fetchGlobalAccess, MailService and the EMAIL_* settings, until feature 010.
import type { AbstractServiceOptions, MutationOptions, Notification, PrimaryKey } from '@backoffice/types';
import { useLogger } from '../logger/index.js';
import { ItemsService } from './items.service.js';
import { UsersService } from './users.service.js';

const logger = useLogger();

export class NotificationsService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_notifications', options);
	}

	override async createOne(data: Partial<Notification>, opts?: MutationOptions): Promise<PrimaryKey> {
		const response = await super.createOne(data, opts);

		await this.sendEmail(data);

		return response;
	}

	async sendEmail(data: Partial<Notification>) {
		if (data.recipient) {
			const usersService = new UsersService({ schema: this.schema, knex: this.knex });

			const user = await usersService.readOne(data.recipient, {
				fields: ['id', 'email', 'email_notifications', 'role'],
			});

			if (user['email'] && user['email_notifications'] === true) {
				logger.warn(
					`Backoffice: mail sending is out of scope; notification "${data.subject}" for ${user['email']} not sent`,
				);
			}
		}
	}
}
