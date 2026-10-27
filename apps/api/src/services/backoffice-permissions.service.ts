// Backoffice (spec 025, FR-020, D-189.6): the rows of backoffice_permissions, written like directus_permissions
// (activity, revisions, cache clearing) by whoever may do the same action on directus_permissions.
import { BACKOFFICE_PERMISSION_ACTIONS } from '@backoffice/constants';
import { InvalidPayloadError } from '@backoffice/errors';
import type {
	AbstractServiceOptions,
	Accountability,
	Item,
	MutationOptions,
	PermissionsAction,
	PrimaryKey,
	Query,
	QueryOptions,
	SchemaOverview,
} from '@backoffice/types';
import { clearSystemCache } from '../cache.js';
import { validateAccess } from '../permissions/modules/validate-access/validate-access.js';
import { ItemsService } from './items.service.js';

export const TABLE = 'backoffice_permissions';

const JSON_FIELDS = ['permissions', 'validation', 'presets', 'options'];

export class BackofficePermissionsService extends ItemsService {
	/** The caller as given; the engine runs as admin because no permission row covers this table (research R6). */
	private readonly caller: Accountability | null;

	constructor(options: AbstractServiceOptions) {
		const caller = options.accountability ?? null;

		super(TABLE, {
			...options,
			accountability: caller ? { ...caller, admin: true } : null,
			schema: withCasts(options.schema),
		});

		this.caller = caller;
	}

	override async createOne(data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey> {
		await this.assertAccess('create');
		assertAction(data);

		const key = await super.createOne(data, opts);
		await this.clearCaches(opts);
		return key;
	}

	override async readByQuery(query: Query, opts?: QueryOptions): Promise<Item[]> {
		await this.assertAccess('read');
		return super.readByQuery(query, opts);
	}

	override async updateMany(keys: PrimaryKey[], data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey[]> {
		await this.assertAccess('update');
		if ('action' in data) assertAction(data);

		const result = await super.updateMany(keys, data, opts);
		await this.clearCaches(opts);
		return result;
	}

	override async deleteMany(keys: PrimaryKey[], opts?: MutationOptions): Promise<PrimaryKey[]> {
		await this.assertAccess('delete');

		const result = await super.deleteMany(keys, opts);
		await this.clearCaches(opts);
		return result;
	}

	/** The same action on directus_permissions, at the collection level (spec Assumptions, analyze U2). */
	private async assertAccess(action: PermissionsAction) {
		if (!this.caller || this.caller.admin) return;

		await validateAccess(
			{ accountability: this.caller, action, collection: 'directus_permissions' },
			{ knex: this.knex, schema: this.schema },
		);
	}

	private async clearCaches(opts?: MutationOptions) {
		await clearSystemCache({ autoPurgeCache: opts?.autoPurgeCache });

		if (this.cache && opts?.autoPurgeCache !== false) {
			await this.cache.clear();
		}
	}
}

function assertAction(data: Partial<Item>) {
	if (!Object.keys(BACKOFFICE_PERMISSION_ACTIONS).includes(data['action'])) {
		throw new InvalidPayloadError({
			reason: `"action" must be one of ${Object.keys(BACKOFFICE_PERMISSION_ACTIONS).join(', ')}`,
		});
	}
}

/**
 * The SchemaOverview shared with DR has no `special` for this table (no directus_fields rows, research R1): cast the
 * JSON and csv columns like directus_permissions on a copy, so the shared object is never changed.
 */
export function withCasts(schema: SchemaOverview): SchemaOverview {
	const collection = schema.collections[TABLE];
	if (!collection) return schema;

	const fields = { ...collection.fields };

	for (const name of JSON_FIELDS) {
		if (fields[name]) fields[name] = { ...fields[name], special: ['cast-json'] };
	}

	if (fields['fields']) fields['fields'] = { ...fields['fields'], special: ['cast-csv'] };

	return { ...schema, collections: { ...schema.collections, [TABLE]: { ...collection, fields } } };
}
