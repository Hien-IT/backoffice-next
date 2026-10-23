// Ported from directus/api/src/services/mail/index.ts (constructor, send and getDefaultTemplateData)
// Backoffice (spec 020 D-141, D-33): no mail is sent (Principle X). Extensions get a MailService with DR'
// constructor; send() runs the `email.send` filter like DR, then logs one warning instead of rendering and
// handing the mail to a transport, and resolves to null.
import { useEnv } from '@backoffice/env';
import type { AbstractServiceOptions, Accountability, SchemaOverview } from '@backoffice/types';
import type { Knex } from 'knex';
import getDatabase from '../database/index.js';
import emitter from '../emitter.js';
import { useLogger } from '../logger/index.js';
import { Url } from '../utils/url.js';

export type EmailOptions = Record<string, any> & {
	to?: string | string[];
	subject?: string;
	template?: { name: string; data: Record<string, any> };
};

export class MailService {
	schema: SchemaOverview;
	accountability: Accountability | null;
	knex: Knex;

	constructor(opts: AbstractServiceOptions) {
		this.schema = opts.schema;
		this.accountability = opts.accountability || null;
		this.knex = opts?.knex || getDatabase();
	}

	async send<T>(data: EmailOptions, _options?: unknown): Promise<T | null> {
		const payload = await emitter.emitFilter(`email.send`, data, {});

		if (!payload) return null;

		const to = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;

		useLogger().warn(
			`Backoffice: mail sending is out of scope; mail "${payload.subject ?? ''}" to ${to ?? ''} not sent`,
		);

		return null;
	}

	async getDefaultTemplateData() {
		const env = useEnv();

		const projectInfo = await this.knex
			.select(['project_name', 'project_logo', 'project_color', 'project_url'])
			.from('directus_settings')
			.first();

		return {
			projectName: projectInfo?.project_name || 'Directus',
			projectColor: projectInfo?.project_color || '#171717',
			projectLogo: getProjectLogoURL(projectInfo?.project_logo),
			projectUrl: projectInfo?.project_url || '',
		};

		function getProjectLogoURL(logoID?: string) {
			const projectLogoUrl = new Url(env['PUBLIC_URL'] as string);

			if (logoID) {
				projectLogoUrl.addPath('assets', logoID);
			} else {
				projectLogoUrl.addPath('admin', 'img', 'directus-white.png');
			}

			return projectLogoUrl.toString();
		}
	}
}
