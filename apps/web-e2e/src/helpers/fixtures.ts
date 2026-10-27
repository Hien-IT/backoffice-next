// Users, roles and policies a spec needs, created through AdminApi on the API of the configuration and deleted in
// afterAll. Names start with DATA_PREFIX so the three configurations never share rows (CHK018).
import { authenticator } from 'otplib';
import type { AdminApi } from './api.js';
import { DATA_PREFIX } from './config.js';

export const PASSWORD = 'web-e2e-Password1';
/** A fixed TOTP secret (base32) for users created with TFA already on. */
export const TFA_SECRET = 'JBSWY3DPEHPK3PXP';

export function totp(secret = TFA_SECRET): string {
	return authenticator.generate(secret);
}

export interface PolicyOptions {
	admin?: boolean;
	app?: boolean;
	enforceTfa?: boolean;
	/** Collections the policy may read (all fields). */
	read?: string[];
	/** Collections the policy may update (all fields), so their item pages open editable (spec 024). */
	update?: string[];
	/** The user may update its own tfa_secret: POST /users/me/tfa/enable checks it (403 without, like Directus). */
	ownTfa?: boolean;
	/**
	 * Fields of its own directus_users row the user may read and update (the profile page, US6). The minimal app
	 * permissions of Directus 11.17.4 let a user read neither theme_*_overrides nor update its row.
	 */
	updateSelf?: string[];
}

export interface TestUser {
	id: string;
	email: string;
	password: string;
}

export class Fixtures {
	private readonly users: string[] = [];
	private readonly roles: string[] = [];
	private readonly policies: string[] = [];

	constructor(private readonly api: AdminApi) {}

	async role(name: string, options: PolicyOptions = {}): Promise<string> {
		const policy = await this.api.createPolicy({
			name: `${DATA_PREFIX} ${name}`,
			icon: 'badge',
			admin_access: options.admin ?? false,
			app_access: options.app ?? true,
			enforce_tfa: options.enforceTfa ?? false,
		});
		this.policies.push(policy.id);

		for (const collection of options.read ?? []) {
			await this.api.call('POST', '/permissions', {
				data: { policy: policy.id, collection, action: 'read', fields: ['*'], permissions: {}, validation: {} },
			});
		}

		for (const collection of options.update ?? []) {
			await this.api.call('POST', '/permissions', {
				data: { policy: policy.id, collection, action: 'update', fields: ['*'], permissions: {}, validation: {} },
			});
		}

		const updateSelf = [...(options.ownTfa ? ['tfa_secret'] : []), ...(options.updateSelf ?? [])];

		if (options.updateSelf?.length) {
			await this.api.call('POST', '/permissions', {
				data: {
					policy: policy.id,
					collection: 'directus_users',
					action: 'read',
					fields: options.updateSelf,
					permissions: { id: { _eq: '$CURRENT_USER' } },
					validation: {},
				},
			});
		}

		if (updateSelf.length) {
			await this.api.call('POST', '/permissions', {
				data: {
					policy: policy.id,
					collection: 'directus_users',
					action: 'update',
					fields: updateSelf,
					permissions: { id: { _eq: '$CURRENT_USER' } },
					validation: {},
				},
			});
		}

		const role = await this.api.createRole({ name: `${DATA_PREFIX} ${name}`, icon: 'person' });
		this.roles.push(role.id);
		await this.api.call('POST', '/access', { data: { role: role.id, policy: policy.id } });
		return role.id;
	}

	/**
	 * The role with this fixed id (ids the env files reference, like AUTH_*_DEFAULT_ROLE_ID), created when missing, with
	 * an extra app-access policy for the duration of the spec.
	 */
	async fixedRole(id: string, name: string): Promise<string> {
		const existing = await this.api.call<{ id: string }[]>('GET', `/roles?filter[id][_eq]=${id}&fields=id`);

		if (existing.length === 0) {
			await this.api.createRole({ id, name: `${DATA_PREFIX} ${name}`, icon: 'person' });
			this.roles.push(id);
		}

		const policy = await this.api.createPolicy({ name: `${DATA_PREFIX} ${name}`, icon: 'badge', app_access: true });
		this.policies.push(policy.id);
		await this.api.call('POST', '/access', { data: { role: id, policy: policy.id } });
		return id;
	}

	async user(name: string, fields: Record<string, unknown> = {}): Promise<TestUser> {
		const email = `${DATA_PREFIX}-${name}-${Date.now()}@example.com`.toLowerCase();
		const user = await this.api.createUser({ email, password: PASSWORD, status: 'active', ...fields });
		this.users.push(user.id);
		return { id: user.id, email, password: PASSWORD };
	}

	async cleanup(): Promise<void> {
		for (const id of this.users.splice(0)) await this.api.deleteUser(id);
		for (const id of this.roles.splice(0)) await this.api.deleteRole(id);
		for (const id of this.policies.splice(0)) await this.api.deletePolicy(id);
	}
}
