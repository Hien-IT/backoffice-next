// Writes apps/web/fixtures/interfaces/directus-registry.json from the Directus 11.17.4 interface and display configs
// (`directus/app/src/{interfaces,displays}/<id>/index.ts`), for src/interfaces/registry.test.ts (contracts/registry.md
// §3, research R2). Run once by hand: `node scripts/extract-directus-registry.mjs` from apps/web; NOT run in CI, since the
// Directus files import the Directus app (i18n, stores, components). Those imports are stubbed through Vite's SSR loader:
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
};

function stubPlugin() {
	return {
		name: 'directus-registry-stubs',
		enforce: 'pre',
		async resolveId(id, importer) {
			if (!importer?.startsWith(APP_SRC) && !importer?.startsWith('\0stub:')) return null;
			if (id === '@directus/extensions') return '\0stub:extensions';
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
				return 'export const defineInterface = (c) => c; export const defineDisplay = (c) => c;';
			if (spec === 'codemirror') return 'export default { modeInfo: [] };';
			const names = importedNames(spec);
			return [
				'export default {};',
				...names.map((name) => `export const ${name} = ${FAKES[name] ?? '() => undefined'};`),
			].join('\n');
		},
	};
}

let indexSources;

function importedNames(spec) {
	indexSources ??= [
		...INTERFACE_IDS.map((id) => join(interfaceDir(id), 'index.ts')),
		...DISPLAY_IDS.map((id) => join(APP_SRC, 'displays', id, 'index.ts')),
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

async function main() {
	const server = await createServer({
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
		plugins: [stubPlugin()],
	});

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

		const json = {
			directusVersion: VERSION,
			generatedBy: 'apps/web/scripts/extract-directus-registry.mjs',
			contexts: descriptors.map(buildContext),
			interfaces,
			displays,
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
