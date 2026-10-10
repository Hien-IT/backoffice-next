// Ported from directus/api/src/services/payload.ts (subset, research R5 of spec 003): the value processing
// (transformers, processValues, dates, geometries, prepareDelta). processM2O, processA2O and processO2M (nested
// relational writes) come with feature 005; calling them throws.
import { randomUUID } from 'node:crypto';
import { InvalidPayloadError } from '@backoffice/errors';
import type {
	AbstractServiceOptions,
	Accountability,
	Aggregate,
	DefaultOverwrite,
	FieldOverview,
	Item,
	PayloadAction,
	SchemaOverview,
} from '@backoffice/types';
import { parseJSON, toArray } from '@backoffice/utils';
import { format, isValid, parseISO } from 'date-fns';
import type { Knex } from 'knex';
import { clone, cloneDeep, isPlainObject } from 'lodash-es';
import { parse as wktToGeoJSON } from 'wellknown';
import type { Helpers } from '../database/helpers/index.js';
import { getHelpers } from '../database/helpers/index.js';
import getDatabase from '../database/index.js';
import { useLogger } from '../logger/index.js';
import { decrypt, encrypt } from '../utils/encrypt.js';
import { generateHash } from '../utils/generate-hash.js';
import { getSecret } from '../utils/get-secret.js';

type Transformers = {
	[type: string]: (context: {
		action: PayloadAction;
		value: any;
		payload: Partial<Item>;
		accountability: Accountability | null;
		specials: string[];
		helpers: Helpers;
		overwriteDefaults: DefaultOverwrite | undefined;
	}) => Promise<any>;
};

/**
 * Process a given payload for a collection to ensure the special fields (hash, uuid, date etc) are
 * handled correctly.
 */
export class PayloadService {
	accountability: Accountability | null;
	knex: Knex;
	helpers: Helpers;
	collection: string;
	schema: SchemaOverview;
	nested: string[];
	overwriteDefaults: DefaultOverwrite | undefined;

	constructor(
		collection: string,
		options: AbstractServiceOptions & { overwriteDefaults?: DefaultOverwrite | undefined },
	) {
		this.accountability = options.accountability || null;
		this.knex = options.knex || getDatabase();
		this.helpers = getHelpers(this.knex);
		this.collection = collection;
		this.schema = options.schema;
		this.nested = options.nested ?? [];
		this.overwriteDefaults = options.overwriteDefaults;

		return this;
	}

	public transformers: Transformers = {
		async hash({ action, value }) {
			if (!value) return;

			if (action === 'create' || action === 'update') {
				return await generateHash(String(value));
			}

			return value;
		},
		async uuid({ action, value }) {
			if (action === 'create' && !value) {
				return randomUUID();
			}

			return value;
		},
		async 'cast-boolean'({ action, value }) {
			if (action === 'read') {
				if (value === true || value === 1 || value === '1') {
					return true;
				} else if (value === false || value === 0 || value === '0') {
					return false;
				} else if (value === null || value === '') {
					return null;
				}
			}

			return value;
		},
		async 'cast-json'({ action, value }) {
			if (action === 'read') {
				if (typeof value === 'string') {
					try {
						return parseJSON(value);
					} catch {
						return value;
					}
				}
			}

			return value;
		},
		async conceal({ action, value }) {
			if (action === 'read') return value ? '**********' : null;
			return value;
		},
		async 'user-created'({ action, value, accountability, overwriteDefaults }) {
			if (action === 'create') return (overwriteDefaults ? overwriteDefaults._user : accountability?.user) ?? null;
			return value;
		},
		async 'user-updated'({ action, value, accountability, overwriteDefaults }) {
			if (action === 'update') return (overwriteDefaults ? overwriteDefaults._user : accountability?.user) ?? null;
			return value;
		},
		async 'role-created'({ action, value, accountability }) {
			if (action === 'create') return accountability?.role || null;
			return value;
		},
		async 'role-updated'({ action, value, accountability }) {
			if (action === 'update') return accountability?.role || null;
			return value;
		},
		async 'date-created'({ action, value, helpers, overwriteDefaults }) {
			if (action === 'create')
				return new Date(
					overwriteDefaults ? overwriteDefaults._date : helpers.date.writeTimestamp(new Date().toISOString()),
				);
			return value;
		},
		async 'date-updated'({ action, value, helpers, overwriteDefaults }) {
			if (action === 'update')
				return new Date(
					overwriteDefaults ? overwriteDefaults._date : helpers.date.writeTimestamp(new Date().toISOString()),
				);
			return value;
		},
		async 'cast-csv'({ action, value }) {
			if (Array.isArray(value) === false && typeof value !== 'string') return;

			if (action === 'read') {
				if (Array.isArray(value)) return value;

				if (value === '') return [];

				return value.split(',');
			}

			if (Array.isArray(value)) {
				return value.join(',');
			}

			return value;
		},
		async encrypt({ action, value, accountability }) {
			if (!value) return value;

			if (action === 'read') {
				// In-system calls can still get the decrypted value
				if (accountability === null) {
					const key = getSecret();

					try {
						return await decrypt(value, key);
					} catch (err) {
						useLogger().warn(`Failed to decrypt field value: ${(err as Error).message}`);
						return null;
					}
				}

				// Requests from the API entrypoints have accountability and shouldn't get the raw value
				return '**********';
			}

			if (typeof value === 'string') {
				const key = getSecret();
				return await encrypt(value, key);
			}

			return value;
		},
	};

	processValues(action: PayloadAction, payloads: Partial<Item>[]): Promise<Partial<Item>[]>;
	processValues(action: PayloadAction, payload: Partial<Item>): Promise<Partial<Item>>;
	processValues(
		action: PayloadAction,
		payloads: Partial<Item>[],
		aliasMap: Record<string, string>,
		aggregate: Aggregate,
	): Promise<Partial<Item>[]>;

	processValues(
		action: PayloadAction,
		payload: Partial<Item>,
		aliasMap: Record<string, string>,
		aggregate: Aggregate,
	): Promise<Partial<Item>>;

	async processValues(
		action: PayloadAction,
		payload: Partial<Item> | Partial<Item>[],
		aliasMap: Record<string, string> = {},
		aggregate: Aggregate = {},
	): Promise<Partial<Item> | Partial<Item>[]> {
		const processedPayload = toArray(payload);

		if (processedPayload.length === 0) return [];

		const fieldsInPayload = Object.keys(processedPayload[0]!);
		const fieldEntries = Object.entries(this.schema.collections[this.collection]!.fields);
		const aliasEntries = Object.entries(aliasMap);

		let specialFields: [string, FieldOverview][] = [];

		for (const [name, field] of fieldEntries) {
			if (field.special && field.special.length > 0) {
				specialFields.push([name, field]);

				for (const [aliasName, fieldName] of aliasEntries) {
					if (fieldName === name) {
						specialFields.push([aliasName, { ...field, field: aliasName }]);
					}
				}
			}
		}

		if (action === 'read') {
			specialFields = specialFields.filter(([name]) => {
				return fieldsInPayload.includes(name);
			});
		}

		for (const record of processedPayload) {
			for (const [name, field] of specialFields) {
				const newValue = await this.processField(field, record, action, this.accountability);
				if (newValue !== undefined) record[name] = newValue;
			}
		}

		this.processGeometries(fieldEntries, processedPayload, action);
		this.processDates(fieldEntries, processedPayload, action, aliasMap, aggregate);

		if (action === 'read') {
			this.processJsonFunctionResults(processedPayload, aliasMap);
		}

		if (['create', 'update'].includes(action)) {
			processedPayload.forEach((record) => {
				for (const [key, value] of Object.entries(record)) {
					if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Date) && value !== null)) {
						if (!value.isRawInstance) {
							record[key] = JSON.stringify(value);
						}
					}
				}
			});
		}

		if (action === 'read') {
			await this.processAggregates(processedPayload, aggregate);
		}

		if (Array.isArray(payload)) {
			return processedPayload;
		}

		return processedPayload[0]!;
	}

	async processAggregates(payload: Partial<Item>[], aggregate: Aggregate = {}) {
		/**
		 * Build access path with -> delimiter
		 *
		 * input: { min: [ 'date', 'datetime', 'timestamp' ] }
		 * output: [ 'min->date', 'min->datetime', 'min->timestamp' ]
		 */
		const aggregateKeys = Object.entries(aggregate).reduce<string[]>((acc, [key, values]) => {
			acc.push(...values.map((value) => `${key}->${value}`));
			return acc;
		}, []);

		const fieldEntries = this.schema.collections[this.collection]!.fields;

		/**
		 * Expand -> delimited keys in the payload to the equivalent expanded object
		 *
		 * before: { "min->date": "2025-04-09", "min->datetime": "2025-04-08T12:00:00", "min->timestamp": "2025-04-17T23:18:00.000Z" }
		 * after: { "min": { "date": "2025-04-09", "datetime": "2025-04-08T12:00:00", "timestamp": "2025-04-17T23:18:00.000Z" } }
		 */
		if (aggregateKeys.length) {
			for (const item of payload) {
				for (const key of aggregateKeys) {
					// Ignore keys that do not follow the `A->B` naming like count=*
					if (key in item === false) continue;

					const [operation, fieldName] = key.split('->') as [string, string];

					const aggregateResult = { [fieldName]: item[key] };

					const fieldOverview = fieldEntries[fieldName];

					if (fieldOverview && fieldOverview.special.length > 0) {
						const newValue = await this.processField(
							fieldOverview,
							aggregateResult,
							'read',
							this.accountability,
						);

						if (newValue !== undefined) aggregateResult[fieldName] = newValue;
					}

					if (!isPlainObject(item[operation])) item[operation] = {};

					item[operation][fieldName] = aggregateResult[fieldName];
					delete item[key];
				}
			}
		}
	}

	async processField(
		field: SchemaOverview['collections'][string]['fields'][string],
		payload: Partial<Item>,
		action: PayloadAction,
		accountability: Accountability | null,
	): Promise<any> {
		if (!field.special) return payload[field.field];
		const fieldSpecials = field.special ? toArray(field.special) : [];

		let value = clone(payload[field.field]);

		for (const special of fieldSpecials) {
			if (special in this.transformers) {
				value = await this.transformers[special]!({
					action,
					value,
					payload,
					accountability,
					specials: fieldSpecials,
					helpers: this.helpers,
					overwriteDefaults: this.overwriteDefaults,
				});
			}
		}

		return value;
	}

	/**
	 * Native geometries are stored in custom binary format. We need to insert them with
	 * the function st_geomfromtext. For this to work, that function call must not be
	 * escaped. It's therefore placed as a Knex.Raw object in the payload. Thus the need
	 * to check if the value is a raw instance before stringifying it in the next step.
	 */
	processGeometries<T extends Partial<Record<string, any>>[]>(
		fieldEntries: [string, FieldOverview][],
		payloads: T,
		action: PayloadAction,
	): T {
		const process =
			action == 'read'
				? (value: any) => (typeof value === 'string' ? wktToGeoJSON(value) : value)
				: () => {
						// Backoffice: st.fromGeoJSON comes with the geometry query helpers of feature 005.
						// ponytail: writing geometry values throws until feature 005 ports the geometry write helpers.
						throw new Error('Writing geometry values is not available before feature 005');
					};

		const geometryColumns = fieldEntries.filter(([_, field]) => field.type.startsWith('geometry'));

		for (const [name] of geometryColumns) {
			for (const payload of payloads) {
				if (payload[name]) {
					payload[name] = process(payload[name]);
				}
			}
		}

		return payloads;
	}

	/**
	 * Backoffice: the JSON function results (`json(...)` aliases) need the fn helpers, which come with the query
	 * engine of feature 005. Without such an alias this is a no-op, as in Directus.
	 */
	processJsonFunctionResults<T extends Partial<Record<string, any>>[]>(
		_payloads: T,
		aliasMap: Record<string, string> = {},
	) {
		for (const originalField of Object.values(aliasMap)) {
			if (originalField.startsWith('json(') && originalField.endsWith(')')) {
				// ponytail: json() aliases are not processed before feature 005 ports the fn helpers.
				throw new Error('PayloadService.processJsonFunctionResults is not available before feature 005');
			}
		}
	}

	// Backoffice: nested relational writes come with feature 005 (research R5 of spec 003).
	// ponytail: callers must not pass nested relational payloads before feature 005.
	async processM2O(): Promise<never> {
		throw new Error('PayloadService.processM2O is not available before feature 005');
	}

	async processA2O(): Promise<never> {
		throw new Error('PayloadService.processA2O is not available before feature 005');
	}

	async processO2M(): Promise<never> {
		throw new Error('PayloadService.processO2M is not available before feature 005');
	}

	/**
	 * Knex returns `datetime` and `date` columns as Date.. This is wrong for date / datetime, as those
	 * shouldn't return with time / timezone info respectively
	 */
	processDates(
		fieldEntries: [string, FieldOverview][],
		payloads: Partial<Record<string, any>>[],
		action: PayloadAction,
		aliasMap: Record<string, string> = {},
		aggregate: Aggregate = {},
	): Partial<Record<string, any>>[] {
		// Include aggegation e.g. "count->id" in alias map
		const aggregateMapped = Object.fromEntries(
			Object.entries(aggregate).reduce<string[][]>((acc, [key, values]) => {
				acc.push(...values.map((value) => [`${key}->${value}`, value]));
				return acc;
			}, []),
		);

		const aliasFields = { ...aliasMap, ...aggregateMapped };

		for (const aliasField in aliasFields) {
			const schemaField = aliasFields[aliasField];
			const field = this.schema.collections[this.collection]!.fields[schemaField!];

			if (field) {
				fieldEntries.push([
					aliasField,
					{
						...field,
						field: aliasField,
					},
				]);
			}
		}

		const dateColumns = fieldEntries.filter(([_name, field]) => ['dateTime', 'date', 'timestamp'].includes(field.type));

		const timeColumns = fieldEntries.filter(([_name, field]) => {
			return field.type === 'time';
		});

		if (dateColumns.length === 0 && timeColumns.length === 0) return payloads;

		for (const [name, dateColumn] of dateColumns) {
			for (const payload of payloads) {
				let value: number | string | Date = payload[name];

				if (value === null || (typeof value === 'string' && /^[.0 :-]{10,}$/.test(value))) {
					payload[name] = null;
					continue;
				}

				if (!value) continue;

				if (action === 'read') {
					if (typeof value === 'number' || typeof value === 'string') {
						value = new Date(value);
					}

					if (dateColumn.type === 'timestamp') {
						const newValue = this.helpers.date.readTimestampString(value.toISOString());
						payload[name] = newValue;
					}

					if (dateColumn.type === 'dateTime') {
						const year = String(value.getFullYear()).padStart(4, '0');
						const month = String(value.getMonth() + 1).padStart(2, '0');
						const day = String(value.getDate()).padStart(2, '0');
						const hours = String(value.getHours()).padStart(2, '0');
						const minutes = String(value.getMinutes()).padStart(2, '0');
						const seconds = String(value.getSeconds()).padStart(2, '0');

						const newValue = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
						payload[name] = newValue;
					}

					if (dateColumn.type === 'date') {
						const year = String(value.getFullYear()).padStart(4, '0');
						const month = String(value.getMonth() + 1).padStart(2, '0');
						const day = String(value.getDate()).padStart(2, '0');

						// Strip off the time / timezone information from a date-only value
						const newValue = `${year}-${month}-${day}`;
						payload[name] = newValue;
					}
				} else {
					if (value instanceof Date === false && typeof value === 'string') {
						if (dateColumn.type === 'date') {
							const parsedDate = parseISO(value);

							if (!isValid(parsedDate)) {
								throw new InvalidPayloadError({ reason: `Invalid Date format in field "${dateColumn.field}"` });
							}

							payload[name] = parsedDate;
						}

						if (dateColumn.type === 'dateTime') {
							const parsedDate = parseISO(value);

							if (!isValid(parsedDate)) {
								throw new InvalidPayloadError({ reason: `Invalid DateTime format in field "${dateColumn.field}"` });
							}

							payload[name] = parsedDate;
						}

						if (dateColumn.type === 'timestamp') {
							const newValue = this.helpers.date.writeTimestamp(value);
							payload[name] = newValue;
						}
					}
				}
			}
		}

		/**
		 * Some DB drivers (MS SQL f.e.) return time values as Date objects. For consistencies sake,
		 * we'll abstract those back to hh:mm:ss
		 */
		for (const [name] of timeColumns) {
			for (const payload of payloads) {
				const value = payload[name];

				if (!value) continue;

				if (action === 'read') {
					if (value instanceof Date) payload[name] = format(value, 'HH:mm:ss');
				}
			}
		}

		return payloads;
	}

	async prepareDelta(delta: Partial<Item>): Promise<Partial<Item> | null> {
		let payload = cloneDeep(delta);

		for (const key in payload) {
			if (payload[key]?.isRawInstance) {
				payload[key] = payload[key].bindings[0];
			}
		}

		payload = await this.processValues('read', payload);

		if (Object.keys(payload).length === 0) return null;

		return payload;
	}
}
