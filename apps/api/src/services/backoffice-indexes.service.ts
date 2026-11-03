// Backoffice (spec 030, D-210, contracts/api.md): the indexes Backoffice creates on user collections, one row of
// backoffice_indexes per index, written like a system collection (activity, revisions) and built by an in-process job
// (backoffice-indexes/jobs.ts). Admin only; the index itself is plain DDL on the user table, which DR respects like
// any constraint and never touches (D-210.3: deleting a field or collection here drops them first).
import { randomUUID } from 'node:crypto';
import { ErrorCode, ForbiddenError, InvalidPayloadError, isBackofficeError } from '@backoffice/errors';
import { isSystemCollection } from '@backoffice/system-data';
import type { AbstractServiceOptions, Accountability, SchemaOverview } from '@backoffice/types';
import { getHelpers } from '../database/helpers/index.js';
import type { SchemaHelper } from '../database/helpers/schema/types.js';
import { getDatabaseClient } from '../database/index.js';
import { type CatalogIndex, isBuilding, listIndexNames } from './backoffice-indexes/catalog.js';
import { type IndexRow, type IndexType, runIndexJob } from './backoffice-indexes/jobs.js';
import { ItemsService } from './items.service.js';

export const TABLE = 'backoffice_indexes';
export const MAX_FIELDS = 8;
/** A `creating` row older than this with no valid index and no running build reads as failed (FR-009). */
export const STALE_MS = 3600_000;

const BTREE_TYPES = new Set([
	'string',
	'text',
	'integer',
	'bigInteger',
	'float',
	'decimal',
	'boolean',
	'uuid',
	'date',
	'time',
	'dateTime',
	'timestamp',
	'hash',
]);
const TRIGRAM_TYPES = new Set(['string', 'text']);
const CONCURRENT_CLIENTS = new Set(['postgres', 'cockroachdb', 'mysql', 'oracle', 'mssql']);

export interface IndexBody {
	fields: string[];
	type?: IndexType;
	unique?: boolean;
}

export interface IndexView extends IndexRow {
	/** Ready rows whose index is gone from the catalog; null when the vendor catalog is not read (MSSQL, Oracle). */
	missing: boolean | null;
}

export interface IndexMeta {
	trigram: boolean;
	concurrent: boolean;
}

export class BackofficeIndexesService extends ItemsService {
	private readonly caller: Accountability | null;
	private readonly client: string;
	private readonly helpers: SchemaHelper;

	constructor(options: AbstractServiceOptions) {
		const caller = options.accountability ?? null;

		super(TABLE, {
			...options,
			// No permission row covers this table: the engine runs as admin, access is checked here (admin only).
			accountability: caller ? { ...caller, admin: true } : null,
			schema: withCasts(options.schema),
		});

		this.caller = caller;
		this.client = getDatabaseClient(this.knex);
		this.helpers = getHelpers(this.knex).schema;
	}

	async list(collection: string): Promise<{ data: IndexView[]; meta: IndexMeta }> {
		this.assertAdmin();
		this.assertUserCollection(collection);

		const rows = await this.rows(collection);
		const catalog = await listIndexNames(this.knex, collection);
		const data: IndexView[] = [];

		for (const row of rows) data.push(await this.view(row, catalog));

		return { data, meta: this.meta() };
	}

	/** Validates, inserts the `creating` row and starts the job; the caller answers 202 with the row. */
	async create(
		collection: string,
		body: IndexBody,
		opts: { attemptConcurrentIndex?: boolean } = {},
	): Promise<IndexView> {
		this.assertAdmin();
		this.assertUserCollection(collection);

		const def = this.validate(collection, body);
		const kind = def.type === 'trigram' ? 'trgm' : def.unique ? 'unique' : 'index';
		const name = this.helpers.generateIndexName(kind, collection, def.fields);

		for (const row of await this.rows(collection)) {
			if (
				row.type === def.type &&
				row.unique === def.unique &&
				JSON.stringify(row.fields) === JSON.stringify(def.fields)
			) {
				throw new InvalidPayloadError({ reason: `Index already exists: ${row.name}` });
			}
		}

		const catalog = await listIndexNames(this.knex, collection);

		if (catalog?.has(name)) throw new InvalidPayloadError({ reason: `Index name already in use: ${name}` });

		let id: string;

		try {
			id = String(
				await this.createOne({
					id: randomUUID(),
					collection,
					name,
					fields: def.fields,
					type: def.type,
					unique: def.unique,
					status: 'creating',
					error: null,
				}),
			);
		} catch (err) {
			// Another replica inserted the same name first (unique backoffice_indexes.name, research R4).
			if (isBackofficeError(err, ErrorCode.RecordNotUnique)) {
				throw new InvalidPayloadError({ reason: `Index already exists: ${name}` });
			}

			throw err;
		}

		const row = this.normalize(await this.readOne(id));

		void runIndexJob(row, {
			knex: this.knex,
			client: this.client,
			helpers: this.helpers,
			updateOne: (key, data) => this.updateOne(key, data),
			attemptConcurrentIndex: opts.attemptConcurrentIndex ?? true,
		});

		return { ...row, missing: null };
	}

	async remove(collection: string, name: string): Promise<void> {
		this.assertAdmin();
		this.assertUserCollection(collection);

		const row = (await this.rows(collection)).find((r) => r.name === name);
		if (!row) throw new ForbiddenError();

		await this.assertNotCreating(row);
		await this.dropRow(row);
	}

	/** Before FieldsService drops the column: every index with that field goes first, on every vendor (D-210.3). */
	async dropForField(collection: string, field: string): Promise<void> {
		if (!(await this.knex.schema.hasTable(TABLE))) return;

		const rows = (await this.rows(collection)).filter((r) => r.fields.includes(field));

		for (const row of rows) await this.assertNotCreating(row);
		for (const row of rows) await this.dropRow(row);
	}

	/** Inside the transaction that drops the table: the rows go, the indexes went with the table. */
	async deleteForCollection(collection: string): Promise<void> {
		if (!(await this.knex.schema.hasTable(TABLE))) return;

		const rows = await this.rows(collection);

		for (const row of rows) await this.assertNotCreating(row);
		if (rows.length > 0) await this.deleteMany(rows.map((r) => r.id));
	}

	private meta(): IndexMeta {
		return { trigram: this.client === 'postgres', concurrent: CONCURRENT_CLIENTS.has(this.client) };
	}

	private assertAdmin(): void {
		if (!this.caller?.admin) throw new ForbiddenError();
	}

	private assertUserCollection(collection: string): void {
		if (isSystemCollection(collection) || !this.schema.collections[collection]) throw new ForbiddenError();
	}

	private validate(collection: string, body: IndexBody): { fields: string[]; type: IndexType; unique: boolean } {
		const fields = Array.isArray(body?.fields) ? body.fields : [];
		const type = body?.type ?? 'btree';
		const unique = Boolean(body?.unique);
		const reject = (reason: string) => {
			throw new InvalidPayloadError({ reason });
		};

		if (type !== 'btree' && type !== 'trigram') reject(`Unknown index type "${type}"`);
		if (fields.length === 0 || fields.some((f) => typeof f !== 'string' || f.length === 0)) {
			reject('"fields" needs at least one field');
		}

		if (fields.length > MAX_FIELDS) reject(`An index has at most ${MAX_FIELDS} fields`);
		if (new Set(fields).size !== fields.length) reject('A field is listed twice');

		const overview = this.schema.collections[collection]!;

		for (const field of fields) {
			const info = overview.fields[field];
			if (!info || info.alias) reject(`"${field}" is not a column of ${collection}`);

			if (type === 'trigram') {
				if (!TRIGRAM_TYPES.has(info!.type)) reject(`A trigram index needs a string or text field, "${field}" is ${info!.type}`);
			} else if (!BTREE_TYPES.has(info!.type)) {
				reject(`Field "${field}" of type ${info!.type} cannot be indexed`);
			} else if (info!.type === 'text' && this.client === 'mysql') {
				reject(`Field "${field}" of type text cannot be indexed on MySQL (a key length is required)`);
			}
		}

		if (fields.length === 1 && fields[0] === overview.primary && type === 'btree') {
			reject('The primary key alone is already indexed');
		}

		if (type === 'trigram') {
			if (fields.length !== 1) reject('A trigram index has one field');
			if (unique) reject('A trigram index cannot be unique');
			if (this.client !== 'postgres') reject('Trigram indexes need PostgreSQL');
		}

		return { fields, type, unique: type === 'trigram' ? false : unique };
	}

	private async rows(collection: string): Promise<IndexRow[]> {
		const rows = await this.readByQuery({
			filter: { collection: { _eq: collection } },
			sort: ['date_created'],
			limit: -1,
		});

		return rows.map((row) => this.normalize(row));
	}

	private normalize(row: Record<string, any>): IndexRow {
		return {
			id: String(row['id']),
			collection: row['collection'],
			name: row['name'],
			fields: typeof row['fields'] === 'string' ? JSON.parse(row['fields']) : (row['fields'] ?? []),
			type: row['type'],
			unique: Boolean(row['unique']),
			status: row['status'],
			error: row['error'] ?? null,
			date_created: isoDate(row['date_created']),
		};
	}

	private async view(row: IndexRow, catalog: Map<string, CatalogIndex> | null): Promise<IndexView> {
		if (row.status === 'creating' && (await this.isStale(row, catalog))) {
			return { ...row, status: 'failed', error: 'Index build stopped (replica shut down)', missing: null };
		}

		if (!catalog || row.status !== 'ready') return { ...row, missing: null };

		// Gone, or (MySQL, SQLite after DR dropped a column) still there under the same name with other columns.
		const entry = catalog.get(row.name);
		const changed = entry !== undefined && row.type === 'btree' && JSON.stringify(entry.columns) !== JSON.stringify(row.fields);
		return { ...row, missing: entry === undefined || changed };
	}

	private async isStale(row: IndexRow, catalog?: Map<string, CatalogIndex> | null): Promise<boolean> {
		if (row.status !== 'creating') return false;
		if (Date.now() - new Date(row.date_created).getTime() <= STALE_MS) return false;

		const names = catalog === undefined ? await listIndexNames(this.knex, row.collection) : catalog;
		if (names?.get(row.name)?.valid) return false;

		return !(await isBuilding(this.knex, row.name));
	}

	private async assertNotCreating(row: IndexRow): Promise<void> {
		if (row.status === 'creating' && !(await this.isStale(row))) {
			throw new InvalidPayloadError({ reason: `Index is still being created: ${row.name}` });
		}
	}

	private async dropRow(row: IndexRow): Promise<void> {
		// Missing (DR or a DBA dropped it) or INVALID: the drop may fail, the row still goes.
		await this.helpers.dropIndex(row.collection, row.name).catch(() => undefined);
		await this.deleteOne(row.id);
	}
}

// shortcut: a `YYYY-MM-DD HH:MM:SS` value (SQLite CURRENT_TIMESTAMP, PayloadService dateTime) is read as UTC; the DB
// default writes UTC on SQLite and Postgres, MySQL in the session zone (UTC in the images). Revisit if a vendor's
// session zone differs from the API process zone and the one-hour rule (FR-009) misfires.
function isoDate(value: unknown): string {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === 'number') return new Date(value).toISOString();
	const text = String(value ?? '');
	return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text) ? new Date(text.replace(' ', 'T') + 'Z').toISOString() : text;
}

/** No directus_fields rows: cast the JSON and boolean columns on a copy of the shared SchemaOverview (as 025). */
export function withCasts(schema: SchemaOverview): SchemaOverview {
	const collection = schema.collections[TABLE];
	if (!collection) return schema;

	const fields = { ...collection.fields };
	if (fields['fields']) fields['fields'] = { ...fields['fields'], special: ['cast-json'] };
	if (fields['unique']) fields['unique'] = { ...fields['unique'], special: ['cast-boolean'] };

	return { ...schema, collections: { ...schema.collections, [TABLE]: { ...collection, fields } } };
}
