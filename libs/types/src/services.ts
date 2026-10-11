// Ported from directus/packages/types/src/services.ts (subset: AbstractServiceOptions and AbstractService; the other service
// interfaces describe extension-facing services and come with the features that port them)
import type { Knex } from 'knex';
import type { Accountability } from './accountability.js';
import type { Item, MutationOptions, PrimaryKey, QueryOptions } from './items.js';
import type { Query } from './query.js';
import type { SchemaOverview } from './schema.js';

export type AbstractServiceOptions = {
	knex?: Knex | undefined;
	accountability?: Accountability | null | undefined;
	schema: SchemaOverview;
	nested?: string[];
};

export interface AbstractService<T extends Item = Item> {
	knex: Knex;
	accountability: Accountability | null | undefined;
	nested: string[];
	getKeysByQuery(query: Query): Promise<PrimaryKey[]>;
	/**
	 * Create a single new item.
	 */
	createOne(data: Partial<T>, opts?: MutationOptions): Promise<PrimaryKey>;
	/**
	 * Create multiple new items at once. Inserts all provided records sequentially wrapped in a transaction.
	 *
	 * Uses `this.createOne` under the hood.
	 */
	createMany(data: Partial<T>[], opts?: MutationOptions): Promise<PrimaryKey[]>;
	/**
	 * Get items by query.
	 */
	readByQuery(query: Query, opts?: QueryOptions): Promise<T[]>;
	/**
	 * Get single item by primary key.
	 *
	 * Uses `this.readByQuery` under the hood.
	 */
	readOne(key: PrimaryKey, query?: Query, opts?: QueryOptions): Promise<T>;
	/**
	 * Get multiple items by primary keys.
	 *
	 * Uses `this.readByQuery` under the hood.
	 */
	readMany(keys: PrimaryKey[], query?: Query, opts?: QueryOptions): Promise<T[]>;
	/**
	 * Update multiple items by query.
	 *
	 * Uses `this.updateMany` under the hood.
	 */
	updateByQuery(query: Query, data: Partial<T>, opts?: MutationOptions): Promise<PrimaryKey[]>;
	/**
	 * Update a single item by primary key.
	 *
	 * Uses `this.updateMany` under the hood.
	 */
	updateOne(key: PrimaryKey, data: Partial<T>, opts?: MutationOptions): Promise<PrimaryKey>;
	/**
	 * Update multiple items in a single transaction.
	 *
	 * Uses `this.updateOne` under the hood.
	 */
	updateBatch(data: Partial<T>[], opts?: MutationOptions): Promise<PrimaryKey[]>;
	/**
	 * Update many items by primary key, setting all items to the same change.
	 */
	updateMany(keys: PrimaryKey[], data: Partial<T>, opts?: MutationOptions): Promise<PrimaryKey[]>;
	/**
	 * Upsert a single item.
	 *
	 * Uses `this.createOne` / `this.updateOne` under the hood.
	 */
	upsertOne(payload: Partial<T>, opts?: MutationOptions): Promise<PrimaryKey>;
	/**
	 * Upsert many items.
	 *
	 * Uses `this.upsertOne` under the hood.
	 */
	upsertMany(payloads: Partial<T>[], opts?: MutationOptions): Promise<PrimaryKey[]>;
	/**
	 * Delete multiple items by query.
	 *
	 * Uses `this.deleteMany` under the hood.
	 */
	deleteByQuery(query: Query, opts?: MutationOptions): Promise<PrimaryKey[]>;
	/**
	 * Delete a single item by primary key.
	 *
	 * Uses `this.deleteMany` under the hood.
	 */
	deleteOne(key: PrimaryKey, opts?: MutationOptions): Promise<PrimaryKey>;
	/**
	 * Delete multiple items by primary key.
	 */
	deleteMany(keys: PrimaryKey[], opts?: MutationOptions): Promise<PrimaryKey[]>;
	/**
	 * Read/treat collection as singleton.
	 */
	readSingleton(query: Query, opts?: QueryOptions): Promise<Partial<T>>;
	/**
	 * Upsert/treat collection as singleton.
	 *
	 * Uses `this.createOne` / `this.updateOne` under the hood.
	 */
	upsertSingleton(data: Partial<T>, opts?: MutationOptions): Promise<PrimaryKey>;
}
