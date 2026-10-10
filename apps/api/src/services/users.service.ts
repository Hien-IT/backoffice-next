// Ported from directus/api/src/services/users.ts (subset, research R5 of spec 003): create and update with the same
// checks and side effects as Directus (unique emails, password policy, user integrity, sessions, caches). Invites,
// registration, delete and reads come with feature 004; password reset is added by T050.
import { RecordNotUniqueError, InvalidPayloadError } from '@backoffice/errors';
import type { AbstractServiceOptions, Item, MutationOptions, PrimaryKey } from '@backoffice/types';
import { UserIntegrityCheckFlag } from '@backoffice/types';
import { FailedValidationError, joiValidationErrorItemToErrorExtensions } from '@backoffice/validation';
import Joi from 'joi';
import { clearSystemCache } from '../cache.js';
import getDatabase from '../database/index.js';
import { ItemsService } from './items.service.js';
import { SettingsService } from './settings.service.js';

export class UsersService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_users', options);

		this.knex = options.knex || getDatabase();
		this.accountability = options.accountability || null;
		this.schema = options.schema;
	}

	/**
	 * User email has to be unique case-insensitive. This is an additional check to make sure that
	 * the email is unique regardless of casing
	 */
	private async checkUniqueEmails(emails: string[], excludeKey?: PrimaryKey): Promise<void> {
		emails = emails.map((email) => email.toLowerCase());

		const duplicates = emails.filter((value, index, array) => array.indexOf(value) !== index);

		if (duplicates.length) {
			throw new RecordNotUniqueError({
				collection: 'directus_users',
				field: 'email',
				value: '[' + String(duplicates) + ']',
			});
		}

		const query = this.knex
			.select('email')
			.from('directus_users')
			.whereRaw(`LOWER(??) IN (${emails.map(() => '?')})`, ['email', ...emails]);

		if (excludeKey) {
			query.whereNot('id', excludeKey);
		}

		const results = await query;

		if (results.length) {
			throw new RecordNotUniqueError({
				collection: 'directus_users',
				field: 'email',
				value: '[' + String(emails) + ']',
			});
		}
	}

	/**
	 * Check if the provided password matches the strictness as configured in
	 * directus_settings.auth_password_policy
	 */
	private async checkPasswordPolicy(passwords: string[]): Promise<void> {
		const settingsService = new SettingsService({
			schema: this.schema,
			knex: this.knex,
		});

		const { auth_password_policy: policyRegExString } = await settingsService.readSingleton({
			fields: ['auth_password_policy'],
		});

		if (!policyRegExString) {
			return;
		}

		const wrapped = policyRegExString.startsWith('/') && policyRegExString.endsWith('/');
		const regex = new RegExp(wrapped ? policyRegExString.slice(1, -1) : policyRegExString);

		for (const password of passwords) {
			if (!regex.test(password)) {
				throw new FailedValidationError(
					joiValidationErrorItemToErrorExtensions({
						message: `Provided password doesn't match password policy`,
						path: ['password'],
						type: 'custom.pattern.base',
						context: {
							value: password,
						},
					}),
				);
			}
		}
	}

	/**
	 * Clear users' sessions to log them out
	 */
	private async clearUserSessions(userKeys: PrimaryKey[], excludeSession?: string): Promise<void> {
		if (excludeSession) {
			await this.knex
				.from('directus_sessions')
				.whereIn('user', userKeys)
				.andWhereNot('token', '=', excludeSession)
				.delete();
		} else {
			await this.knex.from('directus_sessions').whereIn('user', userKeys).delete();
		}
	}

	/**
	 * Validate array of emails. Intended to be used with create/update users
	 */
	private validateEmail(input: string | string[]) {
		const emails = Array.isArray(input) ? input : [input];

		const schema = Joi.string().email().required();

		for (const email of emails) {
			const { error } = schema.validate(email);

			if (error) {
				throw new FailedValidationError({
					field: 'email',
					type: 'email',
					path: [],
				});
			}
		}
	}

	/**
	 * Create a new user
	 */
	override async createOne(data: Partial<Item>, opts: MutationOptions = {}): Promise<PrimaryKey> {
		try {
			if ('email' in data && data['email'] !== undefined) {
				this.validateEmail(data['email']);
				await this.checkUniqueEmails([data['email']]);
			}

			if ('password' in data) {
				await this.checkPasswordPolicy([data['password']]);
			}
		} catch (err: any) {
			opts.preMutationError = err;
		}

		if (!('status' in data) || data['status'] === 'active') {
			// Creating a user only requires checking user limits if the user is active, no need to care about the role
			opts.userIntegrityCheckFlags =
				(opts.userIntegrityCheckFlags ?? UserIntegrityCheckFlag.None) | UserIntegrityCheckFlag.UserLimits;

			opts.onRequireUserIntegrityCheck?.(opts.userIntegrityCheckFlags);
		}

		return await super.createOne(data, opts);
	}

	/**
	 * Create multiple new users
	 */
	override async createMany(data: Partial<Item>[], opts: MutationOptions = {}): Promise<PrimaryKey[]> {
		const emails = data.map((payload) => payload['email']).filter((email) => email);
		const passwords = data.map((payload) => payload['password']).filter((password) => password);
		const someActive = data.some((payload) => !('status' in payload) || payload['status'] === 'active');

		try {
			if (emails.length) {
				this.validateEmail(emails);
				await this.checkUniqueEmails(emails);
			}

			if (passwords.length) {
				await this.checkPasswordPolicy(passwords);
			}
		} catch (err: any) {
			opts.preMutationError = err;
		}

		if (someActive) {
			// Creating users only requires checking user limits if the users are active, no need to care about the role
			opts.userIntegrityCheckFlags =
				(opts.userIntegrityCheckFlags ?? UserIntegrityCheckFlag.None) | UserIntegrityCheckFlag.UserLimits;

			opts.onRequireUserIntegrityCheck?.(opts.userIntegrityCheckFlags);
		}

		// Use generic ItemsService to avoid calling `UserService.createOne` to avoid additional work of validating emails,
		// as this requires one query per email if done in `createOne`
		const itemsService = new ItemsService(this.collection, {
			schema: this.schema,
			accountability: this.accountability,
			knex: this.knex,
		});

		return await itemsService.createMany(data, opts);
	}

	/**
	 * Update many users by primary key
	 */
	override async updateMany(
		keys: PrimaryKey[],
		data: Partial<Item>,
		opts: MutationOptions = {},
	): Promise<PrimaryKey[]> {
		try {
			if (data['email']) {
				if (keys.length > 1) {
					throw new RecordNotUniqueError({
						collection: 'directus_users',
						field: 'email',
						value: data['email'],
					});
				}

				this.validateEmail(data['email']);
				await this.checkUniqueEmails([data['email']], keys[0]);
			}

			if (data['password']) {
				await this.checkPasswordPolicy([data['password']]);
			}

			if (data['tfa_secret'] !== undefined) {
				throw new InvalidPayloadError({ reason: `You can't change the "tfa_secret" value manually` });
			}

			if (data['provider'] !== undefined) {
				if (this.accountability && this.accountability.admin !== true) {
					throw new InvalidPayloadError({ reason: `You can't change the "provider" value manually` });
				}

				data['auth_data'] = null;
			}

			if (data['external_identifier'] !== undefined) {
				if (this.accountability && this.accountability.admin !== true) {
					throw new InvalidPayloadError({ reason: `You can't change the "external_identifier" value manually` });
				}

				data['auth_data'] = null;
			}
		} catch (err: any) {
			opts.preMutationError = err;
		}

		if ('role' in data) {
			opts.userIntegrityCheckFlags = UserIntegrityCheckFlag.All;
		}

		if ('status' in data) {
			if (data['status'] === 'active') {
				// User are being activated, no need to check if there are enough admins
				opts.userIntegrityCheckFlags =
					(opts.userIntegrityCheckFlags ?? UserIntegrityCheckFlag.None) | UserIntegrityCheckFlag.UserLimits;
			} else {
				opts.userIntegrityCheckFlags = UserIntegrityCheckFlag.All;
			}
		}

		if (opts.userIntegrityCheckFlags) {
			opts.onRequireUserIntegrityCheck?.(opts.userIntegrityCheckFlags);
		}

		const result = await super.updateMany(keys, data, opts);

		if (data['status'] !== undefined && data['status'] !== 'active') {
			await this.clearUserSessions(keys);
		} else if (data['password'] !== undefined || data['email'] !== undefined) {
			await this.clearUserSessions(keys, this.accountability?.session);
		}

		// Only clear the caches if the role has been updated
		if ('role' in data) {
			await this.clearCaches(opts);
		}

		return result;
	}

	private async clearCaches(opts?: MutationOptions) {
		await clearSystemCache({ autoPurgeCache: opts?.autoPurgeCache });

		if (this.cache && opts?.autoPurgeCache !== false) {
			await this.cache.clear();
		}
	}
}
