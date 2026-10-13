// Ported from directus/api/src/services/shares.ts
// Backoffice: invite writes one warning line per address instead of sending the mail (D-36, research R4 of spec 010).
import { useEnv } from '@backoffice/env';
import { ForbiddenError, InvalidCredentialsError } from '@backoffice/errors';
import type { AbstractServiceOptions, Item, LoginResult, MutationOptions, PrimaryKey } from '@backoffice/types';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { nanoid } from 'nanoid';
import { useLogger } from '../logger/index.js';
import { clearCache as clearPermissionsCache } from '../permissions/cache.js';
import { validateAccess } from '../permissions/modules/validate-access/validate-access.js';
import type { DirectusTokenPayload, ShareData } from '../types/index.js';
import { getMilliseconds } from '../utils/get-milliseconds.js';
import { getSecret } from '../utils/get-secret.js';
import { Url } from '../utils/url.js';
import { userName } from '../utils/user-name.js';
import { ItemsService } from './items.service.js';
import { UsersService } from './users.service.js';

const env = useEnv();
const logger = useLogger();

export class SharesService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_shares', options);
	}

	override async createOne(data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey> {
		if (this.accountability) {
			await validateAccess(
				{
					accountability: this.accountability,
					action: 'share',
					collection: data['collection'],
					primaryKeys: [data['item']],
				},
				{
					schema: this.schema,
					knex: this.knex,
				},
			);
		}

		return super.createOne(data, opts);
	}

	override async updateMany(keys: PrimaryKey[], data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey[]> {
		await clearPermissionsCache();

		return super.updateMany(keys, data, opts);
	}

	override async deleteMany(keys: PrimaryKey[], opts?: MutationOptions): Promise<PrimaryKey[]> {
		await clearPermissionsCache();

		return super.deleteMany(keys, opts);
	}

	async login(
		payload: Record<string, any>,
		options?: Partial<{
			session: boolean;
		}>,
	): Promise<Omit<LoginResult, 'id'>> {
		const record = await this.knex
			.select<ShareData>({
				share_id: 'id',
				share_start: 'date_start',
				share_end: 'date_end',
				share_times_used: 'times_used',
				share_max_uses: 'max_uses',
				share_password: 'password',
			})
			.from('directus_shares')
			.where('id', payload['share'])
			.andWhere((subQuery) => {
				subQuery.whereNull('date_end').orWhere('date_end', '>=', new Date());
			})
			.andWhere((subQuery) => {
				subQuery.whereNull('date_start').orWhere('date_start', '<=', new Date());
			})
			.andWhere((subQuery) => {
				subQuery.whereNull('max_uses').orWhere('max_uses', '>=', this.knex.ref('times_used'));
			})
			.first();

		if (!record) {
			throw new InvalidCredentialsError();
		}

		if (record.share_password && !(await argon2.verify(record.share_password, payload['password']))) {
			throw new InvalidCredentialsError();
		}

		await this.knex('directus_shares')
			.update({ times_used: record.share_times_used + 1 })
			.where('id', record.share_id);

		const tokenPayload: DirectusTokenPayload = {
			app_access: false,
			admin_access: false,
			role: null,
			share: record.share_id,
		};

		const refreshToken = nanoid(64);
		const refreshTokenExpiration = new Date(Date.now() + getMilliseconds(env['REFRESH_TOKEN_TTL'], 0));

		if (options?.session) {
			tokenPayload.session = refreshToken;
		}

		const TTL = env[options?.session ? 'SESSION_COOKIE_TTL' : 'ACCESS_TOKEN_TTL'] as StringValue | number;

		const accessToken = jwt.sign(tokenPayload, getSecret(), {
			expiresIn: TTL,
			issuer: 'directus',
		});

		await this.knex('directus_sessions').insert({
			token: refreshToken,
			expires: refreshTokenExpiration,
			ip: this.accountability?.ip,
			user_agent: this.accountability?.userAgent,
			origin: this.accountability?.origin,
			share: record.share_id,
		});

		await this.knex('directus_sessions').delete().where('expires', '<', new Date());

		return {
			accessToken,
			refreshToken,
			expires: getMilliseconds(TTL),
		};
	}

	/**
	 * Send a link to the given share ID to the given email(s). Note: you can only send a link to a share
	 * if you have read access to that particular share
	 */
	async invite(payload: { emails: string[]; share: PrimaryKey }) {
		if (!this.accountability?.user) throw new ForbiddenError();

		const share = await this.readOne(payload.share, { fields: ['collection'] });

		const usersService = new UsersService({
			knex: this.knex,
			schema: this.schema,
		});

		const userInfo = await usersService.readOne(this.accountability.user, {
			fields: ['first_name', 'last_name', 'email', 'id'],
		});

		const message = `
Hello!

${userName(userInfo)} has invited you to view an item in ${share['collection']}.

[Open](${new Url(env['PUBLIC_URL'] as string).addPath('admin', 'shared', payload.share).toString()})
`;

		// Backoffice: no MailService (Principle X, D-36). The message is built as Directus builds it; each address gets a
		// warning line instead of the mail, with the subject and the address only (the share link is no secret: anyone
		// with the id can read GET /shares/info/:id).
		void message;

		for (const email of payload.emails) {
			const subject = `${userName(userInfo)} has shared an item with you`;
			logger.warn(`Backoffice: mail sending is out of scope; share invitation "${subject}" for ${email} not sent`);
		}
	}
}
