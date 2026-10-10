// Ported from directus/api/src/services/items.ts (subset, research R5 of spec 003): create, read and update of flat
// fields, with the same SQL effects, activity and revisions as Directus. Feature 005 ports the rest (permissions
// checks, query engine, nested relational writes, delete, upsert, versions) and replaces this file.
// Events are not emitted (D-26 of spec 003).
import { Action } from '@backoffice/constants';
import { useEnv } from '@backoffice/env';
import { ErrorCode, ForbiddenError, InvalidPayloadError, isBackofficeError } from '@backoffice/errors';
import type {
	AbstractServiceOptions,
	Accountability,
	Item as AnyItem,
	MutationOptions,
	MutationTracker,
	PrimaryKey,
	Query,
	QueryOptions,
	SchemaOverview,
} from '@backoffice/types';
import { UserIntegrityCheckFlag } from '@backoffice/types';
import { getRelationsForCollection } from '@backoffice/utils';
import type Keyv from 'keyv';
import type { Knex } from 'knex';
import { assign, clone, cloneDeep, difference, isPlainObject, omit, pick, without } from 'lodash-es';
import { getCache } from '../cache.js';
import { translateDatabaseError } from '../database/errors/translate.js';
import { getHelpers } from '../database/helpers/index.js';
import getDatabase, { getDatabaseClient } from '../database/index.js';
import { shouldClearCache } from '../utils/should-clear-cache.js';
import { transaction } from '../utils/transaction.js';
import { validateKeys } from '../utils/validate-keys.js';
import { validateUserCountIntegrity } from '../utils/validate-user-count-integrity.js';
import { PayloadService } from './payload.service.js';

/** Backoffice: what this subset cannot do yet throws, so a later feature never relies on it silently. */
export function notAvailable(what: string): Error {
	return new Error(`ItemsService: ${what} is not available before feature 005`);
}

export class ItemsService<Item extends AnyItem = AnyItem, Collection extends string = string> {
	collection: Collection;
	knex: Knex;
	accountability: Accountability | null;
	schema: SchemaOverview;
	cache: Keyv<any> | null;
	nested: string[];

	constructor(collection: Collection, options: AbstractServiceOptions) {
		this.collection = collection;
		this.knex = options.knex || getDatabase();
		this.accountability = options.accountability || null;
		this.schema = options.schema;
		this.cache = getCache().cache;
		this.nested = options.nested ?? [];

		return this;
	}

	/**
	 * Create a fork of the current service, allowing instantiation with different options.
	 */
	private fork(options?: Partial<AbstractServiceOptions>): ItemsService<AnyItem> {
		const Service = this.constructor;

		// ItemsService expects `collection` and `options` as parameters,
		// while the other services only expect `options`
		const isItemsService = Service.length === 2;

		const newOptions = {
			knex: this.knex,
			accountability: this.accountability,
			schema: this.schema,
			nested: this.nested,
			...options,
		};

		if (isItemsService) {
			return new ItemsService(this.collection, newOptions);
		}

		return new (Service as new (options: AbstractServiceOptions) => this)(newOptions);
	}

	createMutationTracker(initialCount = 0): MutationTracker {
		const maxCount = Number(useEnv()['MAX_BATCH_MUTATION']);
		let mutationCount = initialCount;
		return {
			trackMutations(count: number) {
				mutationCount += count;

				if (mutationCount > maxCount) {
					throw new InvalidPayloadError({ reason: `Exceeded max batch mutation limit of ${maxCount}` });
				}
			},
			getCount() {
				return mutationCount;
			},
		};
	}

	/**
	 * Backoffice: validateAccess and processPayload (permissions module, feature 004) are not ported. Admin and
	 * internal (null) accountability skip the permission checks like in Directus.
	 * ponytail: the admin field validation of processPayload (non-nullable fields, `validation` rules) is skipped; the
	 * payloads of feature 003 (password, status, auth_data, SSO user fields) carry neither. Feature 005 ports it.
	 */
	private assertNoPermissionChecks(): void {
		if (this.accountability && this.accountability.admin !== true) {
			throw notAvailable('a write or read with permission checks');
		}
	}

	/** Backoffice: nested relational writes (processM2O/A2O/O2M) come with feature 005. */
	private assertFlatPayload(payload: AnyItem): void {
		for (const field of getRelationsForCollection(this.schema, this.collection)) {
			const value = payload[field];

			if (Array.isArray(value) || isPlainObject(value)) {
				throw notAvailable(`a nested relational payload ("${field}")`);
			}
		}
	}

	/**
	 * Create a single new item.
	 */
	async createOne(data: Partial<Item>, opts: MutationOptions = {}): Promise<PrimaryKey> {
		if (!opts.mutationTracker) opts.mutationTracker = this.createMutationTracker();

		if (!opts.bypassLimits) {
			opts.mutationTracker.trackMutations(1);
		}

		this.assertNoPermissionChecks();

		const primaryKeyField = this.schema.collections[this.collection]!.primary;
		const fields = Object.keys(this.schema.collections[this.collection]!.fields);

		const aliases = Object.values(this.schema.collections[this.collection]!.fields)
			.filter((field) => field.alias === true)
			.map((field) => field.field);

		const payload: AnyItem = cloneDeep(data);
		this.assertFlatPayload(payload);

		const primaryKey: PrimaryKey = await transaction(this.knex, async (trx) => {
			if (opts.preMutationError) {
				throw opts.preMutationError;
			}

			const payloadService = new PayloadService(this.collection, {
				accountability: this.accountability,
				knex: trx,
				schema: this.schema,
				nested: this.nested,
				overwriteDefaults: opts.overwriteDefaults,
			});

			const payloadWithoutAliases = pick(payload, without(fields, ...aliases));
			const payloadWithTypeCasting = await payloadService.processValues('create', payloadWithoutAliases);

			// The primary key can already exist in the payload.
			let primaryKey: undefined | PrimaryKey = payloadWithTypeCasting[primaryKeyField];

			if (primaryKey) {
				validateKeys(this.schema, this.collection, primaryKeyField, primaryKey);
			}

			const pkField = this.schema.collections[this.collection]!.fields[primaryKeyField];

			if (
				primaryKey &&
				pkField &&
				!opts.bypassAutoIncrementSequenceReset &&
				['integer', 'bigInteger'].includes(pkField.type) &&
				pkField.defaultValue === 'AUTO_INCREMENT'
			) {
				// ponytail: resetting the sequence after a manual integer key needs the sequence helper (feature 005).
				throw notAvailable('a manual auto-increment primary key');
			}

			try {
				let returningOptions = undefined;

				// Support MSSQL tables that have triggers.
				if (getDatabaseClient(trx) === 'mssql') {
					returningOptions = { includeTriggerModifications: true };
				}

				const result = await trx
					.insert(payloadWithoutAliases)
					.into(this.collection)
					.returning(primaryKeyField, returningOptions)
					.then((result) => result[0]);

				const returnedKey = typeof result === 'object' ? result[primaryKeyField] : result;

				if (pkField!.type === 'uuid') {
					primaryKey = getHelpers(trx).schema.formatUUID(primaryKey ?? returnedKey);
				} else {
					primaryKey = primaryKey ?? returnedKey;
				}
			} catch (err: any) {
				const dbError = await translateDatabaseError(err, data);

				if (isBackofficeError(dbError, ErrorCode.RecordNotUnique) && (dbError as any).extensions.primaryKey) {
					// This is a MySQL specific thing we need to handle here, since MySQL does not return the field name
					// if the unique constraint is the primary key
					(dbError as any).extensions.field = pkField?.field ?? null;

					delete (dbError as any).extensions.primaryKey;
				}

				throw dbError;
			}

			// Most database support returning, those who don't tend to return the PK anyways
			// (MySQL/SQLite). In case the primary key isn't know yet, we'll do a best-attempt at
			// fetching it based on the last inserted row
			if (!primaryKey) {
				// Fetching it with max should be safe, as we're in the context of the current transaction
				const result = await trx.max(primaryKeyField, { as: 'id' }).from(this.collection).first();
				primaryKey = result.id;
			}

			// At this point, the primary key is guaranteed to be set.
			primaryKey = primaryKey as PrimaryKey;

			const userIntegrityCheckFlags = opts.userIntegrityCheckFlags ?? UserIntegrityCheckFlag.None;

			if (userIntegrityCheckFlags) {
				if (opts.onRequireUserIntegrityCheck) {
					opts.onRequireUserIntegrityCheck(userIntegrityCheckFlags);
				} else {
					await validateUserCountIntegrity({ flags: userIntegrityCheckFlags, knex: trx });
				}
			}

			// If this is an authenticated action, and accountability tracking is enabled, save activity row
			if (
				opts.skipTracking !== true &&
				this.accountability &&
				this.schema.collections[this.collection]!.accountability !== null
			) {
				const { ActivityService } = await import('./activity.service.js');
				const { RevisionsService } = await import('./revisions.service.js');

				const activityService = new ActivityService({
					knex: trx,
					schema: this.schema,
				});

				const activity = await activityService.createOne({
					action: Action.CREATE,
					user: this.accountability!.user,
					collection: this.collection,
					ip: this.accountability!.ip,
					user_agent: this.accountability!.userAgent,
					origin: this.accountability!.origin,
					item: primaryKey,
				});

				// If revisions are tracked, create revisions record
				if (this.schema.collections[this.collection]!.accountability === 'all') {
					const revisionsService = new RevisionsService({
						knex: trx,
						schema: this.schema,
					});

					const relationalFields = getRelationsForCollection(this.schema, this.collection);

					const revisionPayload = await payloadService.prepareDelta(omit(payload, relationalFields));

					const revision = await revisionsService.createOne({
						activity: activity,
						collection: this.collection,
						item: primaryKey,
						data: revisionPayload,
						delta: revisionPayload,
					});

					if (opts.onRevisionCreate) {
						opts.onRevisionCreate(revision);
					}
				}
			}

			if (opts.onItemCreate) {
				opts.onItemCreate(this.collection, primaryKey);
			}

			return primaryKey;
		});

		if (shouldClearCache(this.cache, opts, this.collection)) {
			await this.cache.clear();
		}

		return primaryKey;
	}

	/**
	 * Create multiple new items at once. Inserts all provided records sequentially wrapped in a transaction.
	 *
	 * Uses `this.createOne` under the hood.
	 */
	async createMany(data: Partial<Item>[], opts: MutationOptions = {}): Promise<PrimaryKey[]> {
		if (!opts.mutationTracker) opts.mutationTracker = this.createMutationTracker();

		const primaryKeys = await transaction(this.knex, async (knex) => {
			const service = this.fork({ knex });

			let userIntegrityCheckFlags = opts.userIntegrityCheckFlags ?? UserIntegrityCheckFlag.None;

			const primaryKeys: PrimaryKey[] = [];

			const pkField = this.schema.collections[this.collection]!.primary;

			for (const [index, payload] of data.entries()) {
				let bypassAutoIncrementSequenceReset = true;

				// the auto_increment sequence needs to be reset if the current item contains a manual PK and
				// if it's the last item of the batch or if the next item doesn't include a PK and hence one needs to be generated
				if (payload[pkField] && (index === data.length - 1 || !data[index + 1]?.[pkField])) {
					bypassAutoIncrementSequenceReset = false;
				}

				const primaryKey = await service.createOne(payload, {
					...(opts || {}),
					autoPurgeCache: false,
					onRequireUserIntegrityCheck: (flags) => (userIntegrityCheckFlags |= flags),
					mutationTracker: opts.mutationTracker,
					overwriteDefaults: opts.overwriteDefaults?.[index],
					bypassAutoIncrementSequenceReset,
				});

				primaryKeys.push(primaryKey);
			}

			if (userIntegrityCheckFlags) {
				if (opts.onRequireUserIntegrityCheck) {
					opts.onRequireUserIntegrityCheck(userIntegrityCheckFlags);
				} else {
					await validateUserCountIntegrity({ flags: userIntegrityCheckFlags, knex });
				}
			}

			return primaryKeys;
		});

		if (shouldClearCache(this.cache, opts, this.collection)) {
			await this.cache.clear();
		}

		return primaryKeys;
	}

	/**
	 * Get items by query.
	 *
	 * Backoffice: the SQL the AST engine of Directus produces for flat fields of one collection, filtered by primary
	 * key, sorted by primary key, then the read processing (specials, dates, geometries) of PayloadService.
	 * ponytail: only `fields` (flat names or `*`, alias fields left out like run-ast does), a primary key filter
	 * (from readOne/readMany) and `limit`; relational fields, `sort`, `search`, `aggregate`... come with feature 005.
	 */
	async readByQuery(query: Query, _opts?: QueryOptions): Promise<Item[]> {
		this.assertNoPermissionChecks();

		const collection = this.schema.collections[this.collection]!;
		const { fields, filter, limit, ...rest } = query;
		const requested = fields ?? ['*'];

		const unsupported = Object.entries(rest).filter(([, value]) => value !== undefined);
		if (unsupported.length > 0) throw notAvailable(`query.${unsupported[0]![0]}`);

		const names = requested.flatMap((field) => (field === '*' ? Object.keys(collection.fields) : [field]));

		if (names.some((field) => field.includes('.'))) throw notAvailable('relational fields in query.fields');

		const columns = [...new Set(names)].filter(
			(field) => collection.fields[field] && collection.fields[field]!.alias !== true,
		);

		const keys = keysOfFilter(filter, collection.primary);
		const dbQuery = this.knex.select(columns).from(this.collection).orderBy(collection.primary, 'asc');

		if (keys) dbQuery.whereIn(collection.primary, keys);
		if (limit !== undefined && limit !== null && limit !== -1) dbQuery.limit(limit);

		const records = await dbQuery;

		const payloadService = new PayloadService(this.collection, {
			accountability: this.accountability,
			knex: this.knex,
			schema: this.schema,
		});

		return (await payloadService.processValues('read', records)) as Item[];
	}

	/**
	 * Get single item by primary key.
	 *
	 * Uses `this.readByQuery` under the hood.
	 */
	async readOne(key: PrimaryKey, query: Query = {}, opts?: QueryOptions): Promise<Item> {
		const primaryKeyField = this.schema.collections[this.collection]!.primary;
		validateKeys(this.schema, this.collection, primaryKeyField, key);

		if (query.version && query.version !== 'main') throw notAvailable('content versions');

		const filterWithKey = assign({}, query.filter, { [primaryKeyField]: { _eq: key } });
		const queryWithKey = assign({}, query, { filter: filterWithKey });

		const results = await this.readByQuery(queryWithKey, opts);

		if (results.length === 0) {
			throw new ForbiddenError();
		}

		return results[0]!;
	}

	/**
	 * Get multiple items by primary keys.
	 *
	 * Uses `this.readByQuery` under the hood.
	 */
	async readMany(keys: PrimaryKey[], query: Query = {}, opts?: QueryOptions): Promise<Item[]> {
		const primaryKeyField = this.schema.collections[this.collection]!.primary;
		validateKeys(this.schema, this.collection, primaryKeyField, keys);

		const filterWithKey = { _and: [{ [primaryKeyField]: { _in: keys } }, query.filter ?? {}] };
		const queryWithKey = assign({}, query, { filter: filterWithKey });

		// Set query limit as the number of keys
		if (Array.isArray(keys) && keys.length > 0 && !queryWithKey.limit) {
			queryWithKey.limit = keys.length;
		}

		const results = await this.readByQuery(queryWithKey, opts);

		return results;
	}

	/**
	 * Update a single item by primary key.
	 *
	 * Uses `this.updateMany` under the hood.
	 */
	async updateOne(key: PrimaryKey, data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey> {
		await this.updateMany([key], data, opts);
		return key;
	}

	/**
	 * Update many items by primary key, setting all items to the same change.
	 */
	async updateMany(keys: PrimaryKey[], data: Partial<Item>, opts: MutationOptions = {}): Promise<PrimaryKey[]> {
		if (!opts.mutationTracker) opts.mutationTracker = this.createMutationTracker();

		if (!opts.bypassLimits) {
			opts.mutationTracker.trackMutations(keys.length);
		}

		const primaryKeyField = this.schema.collections[this.collection]!.primary;
		validateKeys(this.schema, this.collection, primaryKeyField, keys);

		const fields = Object.keys(this.schema.collections[this.collection]!.fields);

		const aliases = Object.values(this.schema.collections[this.collection]!.fields)
			.filter((field) => field.alias === true)
			.map((field) => field.field);

		const payload: Partial<AnyItem> = cloneDeep(data);

		// Sort keys to ensure that the order is maintained
		keys.sort();

		this.assertNoPermissionChecks();
		this.assertFlatPayload(payload);

		if (opts.preMutationError) {
			throw opts.preMutationError;
		}

		await transaction(this.knex, async (trx) => {
			const payloadService = new PayloadService(this.collection, {
				accountability: this.accountability,
				knex: trx,
				schema: this.schema,
				nested: this.nested,
				overwriteDefaults: opts.overwriteDefaults,
			});

			const payloadWithoutAliasAndPK = pick(payload, without(fields, primaryKeyField, ...aliases));
			const payloadWithTypeCasting = await payloadService.processValues('update', payloadWithoutAliasAndPK);

			if (Object.keys(payloadWithTypeCasting).length > 0) {
				try {
					await trx(this.collection).update(payloadWithTypeCasting).whereIn(primaryKeyField, keys);
				} catch (err: any) {
					throw await translateDatabaseError(err, data);
				}
			}

			const userIntegrityCheckFlags = opts.userIntegrityCheckFlags ?? UserIntegrityCheckFlag.None;

			if (userIntegrityCheckFlags) {
				if (opts?.onRequireUserIntegrityCheck) {
					opts.onRequireUserIntegrityCheck(userIntegrityCheckFlags);
				} else {
					// Having no onRequireUserIntegrityCheck callback indicates that
					// this is the top level invocation of the nested updates, so perform the user integrity check
					await validateUserCountIntegrity({ flags: userIntegrityCheckFlags, knex: trx });
				}
			}

			// If this is an authenticated action, and accountability tracking is enabled, save activity row
			if (
				opts.skipTracking !== true &&
				this.accountability &&
				this.schema.collections[this.collection]!.accountability !== null
			) {
				const { ActivityService } = await import('./activity.service.js');
				const { RevisionsService } = await import('./revisions.service.js');

				const activityService = new ActivityService({
					knex: trx,
					schema: this.schema,
				});

				const activity = await activityService.createMany(
					keys.map((key) => ({
						action: Action.UPDATE,
						user: this.accountability!.user,
						collection: this.collection,
						ip: this.accountability!.ip,
						user_agent: this.accountability!.userAgent,
						origin: this.accountability!.origin,
						item: key,
					})),
					{ bypassLimits: true },
				);

				if (this.schema.collections[this.collection]!.accountability === 'all') {
					const itemsService = new ItemsService(this.collection, {
						knex: trx,
						schema: this.schema,
					});

					const relationalFields = getRelationsForCollection(this.schema, this.collection);
					const snapshotFields = difference(fields, relationalFields);

					const snapshots = await itemsService.readMany(keys, {
						fields: snapshotFields.length > 0 ? snapshotFields : ['*'],
					});

					const revisionsService = new RevisionsService({
						knex: trx,
						schema: this.schema,
					});

					const revisions = (
						await Promise.all(
							activity.map(async (activity, index) => ({
								activity: activity,
								collection: this.collection,
								item: keys[index],
								data:
									Array.isArray(snapshots) && snapshots[index]
										? await payloadService.prepareDelta(snapshots[index])
										: null,
								delta: await payloadService.prepareDelta(payloadWithTypeCasting),
							})),
						)
					).filter((revision) => revision.delta);

					const revisionIDs = await revisionsService.createMany(revisions);

					for (const revisionID of revisionIDs) {
						if (opts.onRevisionCreate) {
							opts.onRevisionCreate(revisionID);
						}
					}
				}
			}
		});

		if (shouldClearCache(this.cache, opts, this.collection)) {
			await this.cache.clear();
		}

		return keys;
	}

	/**
	 * Read/treat collection as singleton.
	 */
	async readSingleton(query: Query, opts?: QueryOptions): Promise<Partial<Item>> {
		query = clone(query);

		if (query.version && query.version !== 'main') throw notAvailable('content versions');

		query.limit = 1;

		const record = (await this.readByQuery(query, opts))[0];

		if (!record) {
			let fields = Object.entries(this.schema.collections[this.collection]!.fields);
			const defaults: Record<string, any> = {};

			if (query.fields && query.fields.includes('*') === false) {
				fields = fields.filter(([name]) => {
					return query.fields!.includes(name);
				});
			}

			for (const [name, field] of fields) {
				if (this.schema.collections[this.collection]!.primary === name) {
					defaults[name] = null;
					continue;
				}

				if (field.defaultValue !== null) defaults[name] = field.defaultValue;
			}

			return defaults as Partial<Item>;
		}

		return record;
	}
}

/**
 * Backoffice: primary keys of the filters readOne and readMany build (`{ pk: { _eq } }`,
 * `{ _and: [{ pk: { _in } }, {}] }`), undefined without a filter; any other filter needs the query engine (005).
 */
function keysOfFilter(filter: Query['filter'], primaryKey: string): PrimaryKey[] | undefined {
	if (!filter || Object.keys(filter).length === 0) return undefined;

	const single = (part: Record<string, any>): PrimaryKey[] | undefined => {
		const condition = part[primaryKey];
		if (Object.keys(part).length !== 1 || !isPlainObject(condition)) return undefined;
		if ('_eq' in condition) return [condition['_eq']];
		if ('_in' in condition && Array.isArray(condition['_in'])) return condition['_in'];
		return undefined;
	};

	const and = (filter as Record<string, any>)['_and'];

	const keys = Array.isArray(and)
		? and.filter((part) => Object.keys(part).length > 0).length === 1
			? single(and.find((part) => Object.keys(part).length > 0))
			: undefined
		: single(filter as Record<string, any>);

	if (!keys) throw notAvailable('a filter other than the primary key');
	return keys;
}
