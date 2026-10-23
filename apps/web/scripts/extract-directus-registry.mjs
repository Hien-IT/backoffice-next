// Writes apps/web/fixtures/interfaces/directus-registry.json from the DR 11.17.4 interface and display configs
// (`directus/app/src/{interfaces,displays}/<id>/index.ts`), for src/interfaces/registry.test.ts (contracts/registry.md
// §3, research R2). Run once by hand: `node scripts/extract-directus-registry.mjs` from apps/web; NOT run in CI, since the
// DR files import the DR app (i18n, stores, components). Those imports are stubbed through Vite's SSR loader:
// `@/...` modules export small fakes, `.vue` and `?raw` files are empty, `defineInterface`/`defineDisplay` are identity.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const WEB = join(ROOT, 'apps/web');
const APP_SRC = join(ROOT, 'directus/app/src');
const OUT = join(WEB, 'fixtures/interfaces/directus-registry.json');

const VERSION = '11.17.4';

// contracts/registry.md §3
const INTERFACE_IDS = [
	'boolean',
	'collection-item-dropdown',
	'collection-item-multiple-dropdown',
	'datetime',
	'file',
	'file-image',
	'files',
	'group-accordion',
	'group-detail',
	'group-raw',
	'group-tabs',
	'input',
	'input-autocomplete-api',
	'input-block-editor',
	'input-code',
	'input-hash',
	'input-multiline',
	'input-rich-text-html',
	'input-rich-text-md',
	'list',
	'list-m2a',
	'list-m2m',
	'list-o2m',
	'list-o2m-tree-view',
	'map',
	'presentation-divider',
	'header',
	'presentation-links',
	'presentation-notice',
	'select-color',
	'select-dropdown',
	'select-dropdown-m2o',
	'select-icon',
	'select-multiple-checkbox',
	'select-multiple-checkbox-tree',
	'select-multiple-dropdown',
	'select-radio',
	'slider',
	'tags',
	'translations',
	'system-raw-editor',
	'system-input-translated-string',
	'system-filter',
	// Feature 015 (FR-086): the six interfaces of directus_users.
	'system-language',
	'system-input-password',
	'system-mfa-setup',
	'system-token',
	'system-theme',
	'system-theme-overrides',
	// Feature 016 (D-57): the system interfaces of the Settings module.
	'system-collection',
	'system-field',
	'system-field-tree',
	'system-display-template',
	'system-collections-translations',
	'system-interface',
	'system-interface-options',
	'system-display',
	'system-display-options',
	'system-fields',
	'system-inline-fields',
	'system-collections',
	'system-manual-flow-select',
	'system-permissions',
	'system-owner',
	'system-modules',
	'system-folder',
	'system-scope',
];

const DISPLAY_IDS = [
	'boolean',
	'collection',
	'color',
	'datetime',
	'file',
	'filesize',
	'formatted-json-value',
	'formatted-value',
	'hash',
	'icon',
	'image',
	'labels',
	'mime-type',
	'rating',
	'raw',
	'related-values',
	'translations',
	'user',
];

const INTERFACE_FIELDS = [
	'id',
	'name',
	'icon',
	'types',
	'localTypes',
	'group',
	'relational',
	'hideLabel',
	'hideLoader',
	'autoKey',
	'recommendedDisplays',
];
const DISPLAY_FIELDS = ['id', 'name', 'icon', 'types', 'localTypes'];

// Feature 017 (FR-044): the 15 operations of the flows editor (`directus/app/src/operations/<id>/index.ts`). Their
// options and overviews are plain data or functions of the options, so the whole result is kept for a list of sample
// arguments; the arguments are written next to each result so src/operations/registry.test.ts calls the Backoffice
// configs with the same ones.
const OPERATION_IDS = [
	'condition',
	'exec',
	'item-create',
	'item-delete',
	'item-read',
	'item-update',
	'json-web-token',
	'log',
	'mail',
	'notification',
	'request',
	'sleep',
	'throw-error',
	'transform',
	'trigger',
];

const OPERATION_OPTION_ARGS = [
	{},
	{ type: 'template' },
	{ type: 'wysiwyg' },
	{ operation: 'sign' },
	{ operation: 'verify' },
	{ operation: 'decode' },
	{ iterationMode: 'batch' },
];

const OPERATION_OVERVIEW_ARGS = [
	{},
	{
		collection: 'bo_content',
		key: ['1', '2'],
		payload: { a: 1 },
		filter: { $trigger: { a: { _eq: 1 } } },
		message: 'hello',
		subject: 'Subject',
		to: ['a@example.com', 'b@example.com'],
		cc: ['c@example.com'],
		type: 'wysiwyg',
		url: 'https://example.com',
		method: 'POST',
		milliseconds: 1000,
		code: 'FORBIDDEN',
		status: '403',
		json: { a: 1 },
		flow: 'flow-child',
		operation: 'sign',
	},
	{ key: '7' },
];

// The flows store the `trigger` operation reads (its options keep the trigger `operation` flows only).
const OPERATION_FLOWS = [
	{ id: 'flow-child', name: 'Child', trigger: 'operation' },
	{ id: 'flow-manual', name: 'Manual', trigger: 'manual' },
];

function describeOperation(config) {
	const options =
		typeof config.options === 'function'
			? OPERATION_OPTION_ARGS.map((args) => ({ args, fields: config.options(args) }))
			: [{ args: null, fields: config.options }];
	const overview = OPERATION_OVERVIEW_ARGS.map((args) => ({
		args,
		items: typeof config.overview === 'function' ? config.overview(args, { flow: { id: 'flow-1' } }) : null,
	}));

	// JSON round trip: drops functions and undefined, like the comparison in the test.
	return JSON.parse(
		JSON.stringify({
			id: config.id,
			name: config.name,
			icon: config.icon,
			description: config.description ?? null,
			optionsKind: optionsKind(config.options),
			flows: OPERATION_FLOWS,
			options,
			overview,
		}),
	);
}

// Feature 018 (FR-040, FR-031, SC-006): the 11 dashboard panels (`directus/app/src/panels/<id>/index.ts`). Like the
// operations, the whole config is kept for sample arguments: options for each `PANEL_OPTION_ARGS` panel, query for each
// `PANEL_QUERY_ARGS` options object. The panels load in a second Vite server with `PANEL_FAKES` (stores that know the
// sample collection), so the interface, display and operation results above do not change.
const PANEL_IDS = [
	'bar-chart',
	'label',
	'line-chart',
	'list',
	'meter',
	'metric',
	'metric-list',
	'pie-chart',
	'relational-variable',
	'time-series',
	'variable',
];

const PANEL_OPTION_ARGS = [
	{},
	{ options: { collection: 'bo_insights_data' } },
	{ options: { collection: 'bo_insights_data', field: 'amount', type: 'integer', function: 'sum' } },
	{ options: { type: 'string', inter: 'select-dropdown', collection: 'directus_users', fillType: 'disabled' } },
];

const PANEL_QUERY_ARGS = [
	{},
	{
		collection: 'bo_insights_data',
		function: 'count',
		field: 'id',
		fn: 'sum',
		aggregation: 'sum',
		aggregateFunction: 'count',
		aggregateField: 'id',
		groupByField: 'status',
		xAxis: 'status',
		yAxis: 'amount',
		column: 'category',
		valueField: 'qty',
		dateField: 'happened_at',
		precision: 'day',
		range: 'auto',
		displayTemplate: '{{ status }} {{ category }}',
		limit: 7,
		sortField: 'qty',
		sortDirection: 'asc',
		filter: { status: { _eq: 'published' } },
	},
	{
		collection: 'bo_insights_data',
		function: 'last',
		field: 'amount',
		sortField: 'happened_at',
		fn: 'max',
		aggregation: 'avg',
		xAxis: 'happened_at',
		yAxis: 'qty',
		datePrecision: 'month',
		grouping: 'category',
		dateField: 'happened_at',
		valueField: 'amount',
		range: '1 month',
		xAxisDisplayField: 'name',
	},
];

const PANEL_FAKES = {
	useCollectionsStore: `() => ({ getCollection: (collection) => (collection ? { collection, meta: { singleton: false } } : null) })`,
	useFieldsStore: `() => ({ getFieldsForCollection: () => [], getField: () => null, getPrimaryKeyFieldForCollection: () => ({ field: 'id' }) })`,
	useRelationsStore: `() => ({ getRelationsForField: () => [], getRelationsForCollection: () => [], getRelationForField: () => null })`,
	// Same logic as directus/app/src/utils/get-groups.ts (the web test uses the ported copy).
	getGroups: `(precision, field) => (({ year: ['year'], month: ['year', 'month'], week: ['year', 'month', 'week'], day: ['year', 'month', 'day'], hour: ['year', 'month', 'day', 'hour'], minute: ['year', 'month', 'day', 'hour', 'minute'], second: ['year', 'month', 'day', 'hour', 'minute', 'second'] })[precision ?? 'hour'] ?? []).map((part) => part + '(' + field + ')')`,
	adjustFieldsForDisplays: `(fields) => fields`,
	getFieldsFromTemplate: `(template) => [...String(template ?? '').matchAll(/{{\\s*([^}]+?)\\s*}}/g)].map((m) => m[1])`,
	getDefaultInterfaceForType: `(type) => 'interface-for-' + type`,
	translate: `(value) => value`,
	cssVar: `(name) => 'cssVar(' + name + ')'`,
	useI18n: `() => ({ t: (key) => key })`,
	computed: `(fn) => ({ get value() { return fn(); } })`,
	FIELD_TYPES_SELECT: `[{ text: '$t:string', value: 'string' }]`,
};

function describePanel(config) {
	const options =
		typeof config.options === 'function'
			? PANEL_OPTION_ARGS.map((args) => ({ args, fields: config.options(args) }))
			: [{ args: null, fields: config.options }];
	const query = PANEL_QUERY_ARGS.map((args) => ({ args, result: config.query ? (config.query(args) ?? null) : null }));

	return JSON.parse(
		JSON.stringify({
			id: config.id,
			name: config.name,
			icon: config.icon,
			description: config.description ?? null,
			minWidth: config.minWidth,
			minHeight: config.minHeight,
			variable: config.variable ?? null,
			skipUndefinedKeys: config.skipUndefinedKeys ?? null,
			optionsKind: optionsKind(config.options),
			options,
			query,
		}),
	);
}

// Option keys of the two interfaces whose options are a Vue component (read from their options.vue: the keys the
// component emits).
const COMPONENT_OPTION_KEYS = {
	list: ['addLabel', 'fields', 'sort', 'template'],
	map: ['defaultView', 'geometryType'],
};

function interfaceDir(id) {
	if (id.startsWith('system-')) return join(APP_SRC, 'interfaces/_system', id);
	if (id === 'header') return join(APP_SRC, 'interfaces/presentation-header');
	return join(APP_SRC, 'interfaces', id);
}

const RELATIONS = {
	none: { m2o: undefined, o2m: undefined },
	m2o: {
		m2o: {
			collection: 'articles',
			field: 'f',
			related_collection: 'authors',
			meta: { one_field: null, junction_field: null },
		},
		o2m: undefined,
	},
	o2m: {
		m2o: undefined,
		o2m: {
			collection: 'comments',
			field: 'article',
			related_collection: 'articles',
			meta: { one_field: 'f', junction_field: null },
		},
	},
	m2m: {
		o2m: {
			collection: 'articles_tags',
			field: 'articles_id',
			related_collection: 'articles',
			meta: { one_field: 'f', junction_field: 'tags_id' },
		},
		m2o: {
			collection: 'articles_tags',
			field: 'tags_id',
			related_collection: 'tags',
			meta: { one_field: null, junction_field: 'articles_id' },
		},
	},
};

function buildContext({ type, relations, editing, layout, relative }) {
	return {
		collection: 'articles',
		editing,
		field: {
			collection: 'articles',
			field: 'f',
			type,
			meta: { options: { layout, relative }, display_options: { relative } },
			schema: { max_length: null },
		},
		relations: RELATIONS[relations],
		collections: { junction: undefined, related: undefined },
		fields: { corresponding: undefined, junctionCurrent: undefined, junctionRelated: undefined, sort: undefined },
		items: {},
		localType: 'standard',
		autoGenerateJunctionRelation: true,
		saving: false,
	};
}

// Type-dependent options (input, input-code, datetime, select-*, formatted-value) vary with `type` and `relative`;
// relational ones vary with `relations`, `editing` and `layout`. Two small grids instead of the full product.
function contextDescriptors() {
	const out = [];
	const types = [
		'string',
		'uuid',
		'integer',
		'bigInteger',
		'float',
		'decimal',
		'text',
		'json',
		'csv',
		'hash',
		'boolean',
		'timestamp',
		'dateTime',
		'date',
		'time',
		'geometry',
		'geometry.Point',
		'alias',
	];

	for (const type of types) {
		for (const relative of [false, true]) out.push({ type, relations: 'm2m', editing: 'f', layout: 'list', relative });
	}

	for (const relations of Object.keys(RELATIONS)) {
		for (const editing of ['+', 'f']) {
			for (const layout of ['list', 'table']) out.push({ type: 'alias', relations, editing, layout, relative: false });
		}
	}

	return out;
}

function optionKeys(options) {
	if (Array.isArray(options)) return options.map((o) => o.field);
	return [...options.standard.map((o) => o.field), ...options.advanced.map((o) => o.field)];
}

const sorted = (keys) => [...new Set(keys)].sort();

function optionsKind(options) {
	if (options === null || options === undefined) return 'null';
	if (typeof options === 'function') return 'function';
	if (Array.isArray(options)) return 'array';
	if ('standard' in options && 'advanced' in options) return 'standard-advanced';
	return 'component';
}

function describe(config, id, fields, descriptors) {
	const entry = {};
	for (const key of fields) entry[key] = config[key] ?? null;
	entry.optionsKind = optionsKind(config.options);

	if (entry.optionsKind === 'component') {
		entry.optionKeys = COMPONENT_OPTION_KEYS[id];
		entry.optionKeysManual = true;
	} else if (entry.optionsKind === 'function') {
		const groups = new Map();

		descriptors.forEach((descriptor, index) => {
			const keys = sorted(optionKeys(config.options(buildContext(descriptor)))).join(',');
			groups.set(keys, [...(groups.get(keys) ?? []), index]);
		});

		entry.optionKeysByContext = [...groups].map(([keys, contexts]) => ({
			contexts,
			keys: keys ? keys.split(',') : [],
		}));
		entry.optionKeys = sorted(entry.optionKeysByContext.flatMap((g) => g.keys));
	} else {
		entry.optionKeys = entry.optionsKind === 'null' ? [] : sorted(optionKeys(config.options));
	}

	return entry;
}

// Fakes for the `@/...` names the index.ts files import; any other name is a no-op function.
const FAKES = {
	APP_NUMERIC_TYPES: `['integer', 'float']`,
	i18n: `{ global: { t: (key) => key, te: () => false, locale: { value: 'en-US' } } }`,
	getTimezoneOptions: `() => []`,
	useFieldsStore: `() => ({ getFieldsForCollection: () => [], getField: () => null, getPrimaryKeyFieldForCollection: () => null })`,
	useRelationsStore: `() => ({ getRelationsForField: () => [], getRelationsForCollection: () => [] })`,
	useCollectionsStore: `() => ({ getCollection: () => null })`,
	useExtension: `() => ({ value: null })`,
	// Feature 017: the real behaviour of @directus/utils toArray, and the flows store of the `trigger` operation.
	toArray: `(value) => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [value])`,
	useFlowsStore: `() => ({ flows: ${JSON.stringify(OPERATION_FLOWS)} })`,
};

function stubPlugin(fakes = FAKES) {
	return {
		name: 'directus-registry-stubs',
		enforce: 'pre',
		async resolveId(id, importer) {
			if (!importer?.startsWith(APP_SRC) && !importer?.startsWith('\0stub:')) return null;
			if (id === '@directus/extensions') return '\0stub:extensions';
			if (id === '@directus/errors') return '\0stub:errors';
			if (id.startsWith('@/') || id.endsWith('.vue') || id.includes('?raw')) return `\0stub:${id}`;
			// Load-time only (choices, handlers): not needed for the option keys.
			// (`@directus/utils` and micromustache are only used by handlers and `fields`; their CJS builds do not inline.)
			if (
				[
					'codemirror',
					'codemirror/mode/meta',
					'html-entities',
					'mime/lite',
					'vue',
					'micromustache',
					'@directus/utils',
					'@directus/utils/browser',
					'vue-i18n',
				].includes(id)
			) {
				return `\0stub:${id}`;
			}

			if (id === '@directus/constants') return join(ROOT, 'directus/packages/constants/src/index.ts');
			if (id.startsWith('.')) return null;
			// Other bare imports: resolved from apps/web (directus/ has no node_modules); lodash -> lodash-es.
			return this.resolve(id === 'lodash' ? 'lodash-es' : id, join(WEB, 'src/main.ts'), { skipSelf: true });
		},
		load(id) {
			if (!id.startsWith('\0stub:')) return null;
			const spec = id.slice('\0stub:'.length);
			if (spec === 'extensions')
				return 'export const defineInterface = (c) => c; export const defineDisplay = (c) => c; export const defineOperationApp = (c) => c; export const definePanel = (c) => c;';
			if (spec === 'errors') return errorsStub();
			if (spec === 'codemirror') return 'export default { modeInfo: [] };';
			const names = importedNames(spec);
			return [
				'export default {};',
				...names.map((name) => `export const ${name} = ${fakes[name] ?? FAKES[name] ?? '() => undefined'};`),
			].join('\n');
		},
	};
}

// @directus/errors for throw-error: the ErrorCode enum as an object, and the three fields of InternalServerError.
function errorsStub() {
	const codes = [
		...readFileSync(join(ROOT, 'directus/packages/errors/src/codes.ts'), 'utf8').matchAll(/(\w+) = '([A-Z_]+)'/g),
	];
	return [
		`export const ErrorCode = {${codes.map(([, name, code]) => `${name}: '${code}'`).join(', ')}};`,
		"export class InternalServerError { code = 'INTERNAL_SERVER_ERROR'; status = 500; message = 'An unexpected error occurred.'; }",
	].join('\n');
}

let indexSources;

function importedNames(spec) {
	indexSources ??= [
		...INTERFACE_IDS.map((id) => join(interfaceDir(id), 'index.ts')),
		...DISPLAY_IDS.map((id) => join(APP_SRC, 'displays', id, 'index.ts')),
		...OPERATION_IDS.map((id) => join(APP_SRC, 'operations', id, 'index.ts')),
		...PANEL_IDS.map((id) => join(APP_SRC, 'panels', id, 'index.ts')),
	].map((file) => readFileSync(file, 'utf8'));

	const names = new Set();
	const re = new RegExp(`import\\s+(?:type\\s+)?\\{([^}]+)\\}\\s+from\\s+'${spec.replace(/[/.]/g, '\\$&')}'`, 'g');

	for (const source of indexSources) {
		for (const match of source.matchAll(re)) {
			for (const part of match[1].split(',')) {
				const name = part
					.trim()
					.replace(/^type\s+/, '')
					.split(/\s+as\s+/)
					.pop();
				if (name) names.add(name);
			}
		}
	}

	return [...names];
}

function createRegistryServer(fakes) {
	return createServer({
		configFile: false,
		root: WEB,
		logLevel: 'error',
		appType: 'custom',
		server: { middlewareMode: true, hmr: false, ws: false },
		optimizeDeps: { noDiscovery: true, include: [] },
		// A string tsconfigRaw keeps Vite from reading directus/app/tsconfig.json (its `extends` is not installed).
		esbuild: { tsconfigRaw: '{"compilerOptions":{"target":"es2022","useDefineForClassFields":true}}' },
		// Everything goes through the plugin: Vite would otherwise resolve bare imports from directus/app (no node_modules).
		ssr: { noExternal: true },
		plugins: [stubPlugin(fakes)],
	});
}

async function main() {
	const server = await createRegistryServer(FAKES);
	const descriptors = contextDescriptors();
	const report = { manual: [], loaded: 0 };

	async function extract(kind, ids, dirOf, fields) {
		const out = {};

		for (const id of ids) {
			try {
				const mod = await server.ssrLoadModule(join(dirOf(id), 'index.ts'));
				out[id] = describe(mod.default, id, fields, descriptors);
				report.loaded++;
			} catch (error) {
				report.manual.push(`${kind}/${id}: ${error.message}`);
			}
		}

		return out;
	}

	try {
		const interfaces = await extract('interfaces', INTERFACE_IDS, interfaceDir, INTERFACE_FIELDS);
		const displays = await extract('displays', DISPLAY_IDS, (id) => join(APP_SRC, 'displays', id), DISPLAY_FIELDS);
		const operations = {};

		for (const id of OPERATION_IDS) {
			try {
				const mod = await server.ssrLoadModule(join(APP_SRC, 'operations', id, 'index.ts'));
				operations[id] = describeOperation(mod.default);
				report.loaded++;
			} catch (error) {
				report.manual.push(`operations/${id}: ${error.message}`);
			}
		}

		const panels = {};
		const panelServer = await createRegistryServer(PANEL_FAKES);

		try {
			for (const id of PANEL_IDS) {
				try {
					const mod = await panelServer.ssrLoadModule(join(APP_SRC, 'panels', id, 'index.ts'));
					panels[id] = describePanel(mod.default);
					report.loaded++;
				} catch (error) {
					report.manual.push(`panels/${id}: ${error.message}`);
				}
			}
		} finally {
			await panelServer.close();
		}

		const json = {
			directusVersion: VERSION,
			generatedBy: 'apps/web/scripts/extract-directus-registry.mjs',
			contexts: descriptors.map(buildContext),
			interfaces,
			displays,
			operations,
			panels,
		};

		mkdirSync(dirname(OUT), { recursive: true });
		writeFileSync(OUT, JSON.stringify(json, null, '\t') + '\n');
		/* eslint-disable no-console */
		console.log(`loaded ${report.loaded}, not loaded ${report.manual.length}`);
		for (const line of report.manual) console.log(`  ${line}`);
	} finally {
		await server.close();
	}
}

await main();
