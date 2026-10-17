// Seeds the fixture set of feature 013 (data-model §6, FR-100) through the REST API of Directus 11.17.4 or the new API.
// Idempotent: deletes then recreates the `bo_*` collections, the `bo-fixtures` folder and its files, the `bo-flow` flow
// and the `bo-editor` / `bo-viewer` role, policy and user. Touches nothing else.
// Feature 014 (data-model §9, T023) adds the Content module set: the `bo_folder` folder with `bo_content` (versioning,
// archive, display template, preview URL, manual sort, 30 items), the `bo_singleton` singleton, presets and bookmarks,
// versions, a share, comments and the `bo-flow-content` / `bo-flow-item` manual flows.
// Feature 015 (data-model §11, T021) adds the Files and Users set: the `bo-files` folder tree with an image of 400x300
// (`bo-edit.png`), a JPEG with EXIF and text files, one file 10 days old, the `bo-sub` role under bo-editor and the
// directory users of lib.mjs (one per status, a token user, an SSO user).
// Feature 016 (data-model §15, T019) adds the Settings set of lib.mjs SETTINGS: a role and an app-access policy with three
// permissions on bo_std, and the `bo_hello` custom translation.
// Feature 017 (data-model §9, T014) adds the flows of lib.mjs FLOWS, saved the way the flows editor saves them (flow
// first, then the operation trees in one PATCH), and three runs of `bo_all_ops` (two resolve, one reject).
// Feature 018 (data-model §12, T016) adds the Insights set: the `bo_insights_data` collection (12 fixed rows that only the
// seed writes, owners admin and bo-editor), the dashboards of lib.mjs DASHBOARDS with their panels, and three admin
// notifications of lib.mjs NOTIFICATIONS.
// Usage: node seed.mjs --api http://127.0.0.1:8155 (--token <admin token> | --email <e> --password <p>) [--clean]
// `--clean` only deletes the fixture set and exits.
import {
	Api,
	CONTENT_FLOWS,
	DASHBOARDS,
	DIRECTORY_USERS,
	FILES_FOLDERS,
	FIXED_UUIDS,
	FLOW,
	FLOWS,
	FOLDER,
	NOTIFICATIONS,
	query,
	readArgs,
	SETTINGS,
	SHARE,
	SUB_ROLE,
	USERS,
} from './lib.mjs';

const args = readArgs();
const api = await Api.connect(args);

// Data colors stored in options, like the Directus color presets.
const PURPLE = '#6644FF';
const GREEN = '#2ECDA7';
const RED = '#E35169';
const WHITE = '#FFFFFF';

const ROLES = ['bo-editor', 'bo-viewer'];

/* ---------------------------------------------------------------- cleanup */

async function cleanup() {
	// Content module rows that point at bo_* collections (014): presets, versions, shares, comments.
	const onBo = { collection: { _starts_with: 'bo_' } };
	for (const path of ['/presets', '/versions', '/shares', '/comments']) {
		const rows = await api.get(`${path}${query({ filter: onBo, fields: 'id', limit: -1 })}`);
		if (rows.length > 0)
			await api.request(
				'DELETE',
				path,
				rows.map((r) => r.id),
			);
	}

	// Relations first: dropping their foreign keys breaks the bo_rel <-> bo_rel_target cycle.
	for (const relation of await api.get('/relations')) {
		if (relation.collection.startsWith('bo_'))
			await api.request('DELETE', `/relations/${relation.collection}/${relation.field}`);
	}

	for (const { collection } of await api.get('/collections')) {
		if (collection.startsWith('bo_')) await api.request('DELETE', `/collections/${collection}`);
	}

	const folders = await api.get(
		`/folders${query({ filter: { name: { _in: [FOLDER, ...Object.values(FILES_FOLDERS)] } }, fields: 'id' })}`,
	);

	if (folders.length > 0) {
		const ids = folders.map((f) => f.id);
		const files = await api.get(`/files${query({ filter: { folder: { _in: ids } }, fields: 'id', limit: -1 })}`);
		if (files.length > 0)
			await api.request(
				'DELETE',
				'/files',
				files.map((f) => f.id),
			);
		await api.request('DELETE', '/folders', ids);
	}

	const flows = await api.get(
		`/flows${query({ filter: { name: { _in: [FLOW, ...CONTENT_FLOWS, ...Object.values(FLOWS)] } }, fields: 'id' })}`,
	);
	if (flows.length > 0)
		await api.request(
			'DELETE',
			'/flows',
			flows.map((f) => f.id),
		);

	// Insights (018): dashboards cascade to their panels; the admin notifications by subject.
	const dashboards = await api.get(
		`/dashboards${query({ filter: { name: { _in: Object.values(DASHBOARDS) } }, fields: 'id' })}`,
	);
	if (dashboards.length > 0)
		await api.request(
			'DELETE',
			'/dashboards',
			dashboards.map((d) => d.id),
		);
	const notifications = await api.get(
		`/notifications${query({ filter: { subject: { _in: Object.values(NOTIFICATIONS) } }, fields: 'id', limit: -1 })}`,
	);
	if (notifications.length > 0)
		await api.request(
			'DELETE',
			'/notifications',
			notifications.map((n) => n.id),
		);

	const emails = [...Object.values(USERS), ...Object.values(DIRECTORY_USERS)].map((u) => u.email);
	const users = await api.get(`/users${query({ filter: { email: { _in: emails } }, fields: 'id' })}`);
	if (users.length > 0)
		await api.request(
			'DELETE',
			'/users',
			users.map((u) => u.id),
		);

	const translations = await api.get(
		`/translations${query({ filter: { key: { _eq: SETTINGS.translationKey } }, fields: 'id' })}`,
	);
	if (translations.length > 0)
		await api.request(
			'DELETE',
			'/translations',
			translations.map((t) => t.id),
		);

	const roles = await api.get(
		`/roles${query({ filter: { name: { _in: [...ROLES, SUB_ROLE, SETTINGS.role] } }, fields: 'id' })}`,
	);
	if (roles.length > 0)
		await api.request(
			'DELETE',
			'/roles',
			roles.map((r) => r.id),
		);

	const policies = await api.get(
		`/policies${query({ filter: { name: { _in: [...ROLES, SETTINGS.policy] } }, fields: 'id' })}`,
	);
	if (policies.length > 0)
		await api.request(
			'DELETE',
			'/policies',
			policies.map((p) => p.id),
		);
}

/* ---------------------------------------------------------------- field builders */

/**
 * A field payload. `options`/`display_options` keys are the ones Directus stores (directus-registry.json).
 * `meta` holds the remaining meta keys (width, group, hidden, readonly, required, note, conditions, validation...).
 */
function field(name, type, iface, options = null, meta = {}, schema = {}) {
	return {
		field: name,
		type,
		meta: { interface: iface, options, width: 'full', ...meta },
		schema: type === 'alias' ? undefined : schema,
	};
}

const alias = (name, special, iface, options, meta = {}) => field(name, 'alias', iface, options, { special, ...meta });

const group = (name, iface, options, meta = {}) => alias(name, ['alias', 'no-data', 'group'], iface, options, meta);
const presentation = (name, iface, options, meta = {}) => alias(name, ['alias', 'no-data'], iface, options, meta);

const intPk = () =>
	field(
		'id',
		'integer',
		'input',
		null,
		{ hidden: true, readonly: true },
		{ is_primary_key: true, has_auto_increment: true },
	);

const uuidPk = () =>
	field(
		'id',
		'uuid',
		'input',
		null,
		{ hidden: true, readonly: true, special: ['uuid'] },
		{ is_primary_key: true, length: 36 },
	);

/** Collection payload; fields get `meta.sort` in array order. */
function collection(name, fields, meta = {}) {
	return {
		collection: name,
		meta: { icon: 'box', ...meta },
		schema: {},
		fields: fields.map((f, index) => ({ ...f, meta: { ...f.meta, sort: index + 1 } })),
	};
}

const choicesAbc = [
	{ text: 'Alpha', value: 'alpha', icon: 'star', color: PURPLE },
	{ text: 'Beta', value: 'beta' },
	{ text: '$t:active', value: 'gamma' },
];

/* ---------------------------------------------------------------- collections */

function stdCollection({ folder }) {
	return collection(
		'bo_std',
		[
			intPk(),
			// input, string variants
			field(
				'input_string',
				'string',
				'input',
				{
					placeholder: 'Type here',
					iconLeft: 'title',
					iconRight: 'edit',
					softLength: 50,
					trim: true,
					font: 'serif',
					clear: true,
				},
				{
					width: 'half',
					display: 'formatted-value',
					display_options: {
						bold: true,
						italic: true,
						font: 'monospace',
						prefix: '<',
						suffix: '>',
						color: PURPLE,
						background: WHITE,
						icon: 'title',
						border: true,
						format: true,
						conditionalFormatting: [
							{ operator: 'eq', value: 'alpha', color: WHITE, background: GREEN, text: 'Alpha!', icon: 'star' },
							{ operator: 'contains', value: 'alp', color: WHITE, background: RED, icon: 'warning' },
						],
					},
					translations: [
						{ language: 'en-US', translation: 'String input' },
						{ language: 'vi-VN', translation: 'Ô nhập chuỗi' },
					],
				},
				{ max_length: 100 },
			),
			field(
				'input_masked',
				'string',
				'input',
				{ masked: true, placeholder: 'Hidden value' },
				{
					width: 'half',
					display: 'formatted-value',
					display_options: { masked: true },
				},
			),
			field('input_slug', 'string', 'input', { slug: true, placeholder: 'my-slug' }, { width: 'half' }),
			field('input_default', 'string', 'input', null, { width: 'half', display: 'raw' }),
			field(
				'input_integer',
				'integer',
				'input',
				{ min: 0, max: 100, step: 5, iconLeft: 'pin', placeholder: '0-100' },
				{
					width: 'half',
					display: 'formatted-value',
					display_options: {
						format: true,
						suffix: ' pts',
						conditionalFormatting: [
							{ operator: 'gte', value: '50', color: WHITE, background: GREEN, text: 'High' },
							{ operator: 'lt', value: '10', color: WHITE, background: RED, icon: 'arrow_downward' },
						],
					},
				},
			),
			field(
				'input_float',
				'float',
				'input',
				{ min: -10.5, max: 10.5, step: 0.5, font: 'monospace' },
				{
					width: 'half',
					display: 'formatted-value',
					display_options: { format: true },
				},
			),
			field(
				'input_biginteger',
				'bigInteger',
				'input',
				{ placeholder: 'Big number' },
				{ width: 'half', display: 'raw' },
			),
			field(
				'input_decimal',
				'decimal',
				'input',
				{ iconRight: 'payments' },
				{ width: 'half', display: 'formatted-value', display_options: { prefix: '$' } },
				{ numeric_precision: 10, numeric_scale: 2 },
			),
			field('input_uuid', 'uuid', 'input', { font: 'monospace' }, { width: 'half' }),
			field('input_text', 'text', 'input', { font: 'monospace', softLength: 500 }, { width: 'fill' }),
			// meta behaviours
			field('input_required', 'string', 'input', null, {
				width: 'half',
				required: true,
				validation: { _and: [{ input_required: { _regex: '^[A-Z]' } }] },
				validation_message: 'Must start with an uppercase letter',
				note: '$t:interfaces.input.description',
			}),
			field('input_note_md', 'string', 'input', null, {
				width: 'half',
				note: 'Supports **bold**, `code` and [links](https://example.com)',
			}),
			field('input_hidden', 'string', 'input', null, { hidden: true }),
			field('input_readonly', 'string', 'input', null, { readonly: true, width: 'half' }),
			field(
				'input_conditional',
				'string',
				'input',
				{ placeholder: 'Default placeholder' },
				{
					width: 'half',
					conditions: [
						{ name: 'Required when published', rule: { _and: [{ boolean: { _eq: true } }] }, required: true },
						{
							name: 'Placeholder when set',
							rule: { _and: [{ boolean: { _nnull: true } }] },
							readonly: false,
							options: { placeholder: 'Conditional placeholder' },
						},
					],
				},
			),
			field('input_multiline', 'text', 'input-multiline', {
				placeholder: 'Several lines',
				softLength: 200,
				trim: true,
				font: 'serif',
				clear: true,
			}),
			field(
				'input_hash',
				'hash',
				'input-hash',
				{ masked: true, placeholder: 'Secret' },
				{
					width: 'half',
					special: ['hash'],
					display: 'hash',
				},
			),
			field('system_raw', 'string', 'system-raw-editor', { placeholder: '{{ raw }}' }, { width: 'half' }),
			field(
				'autocomplete',
				'string',
				'input-autocomplete-api',
				{
					url: '/items/bo_rel_target?search={{value}}',
					resultsPath: 'data',
					textPath: 'name',
					valuePath: 'name',
					trigger: 'debounce',
					rate: 300,
					placeholder: 'Search targets',
					iconLeft: 'search',
					iconRight: 'list',
					font: 'sans-serif',
				},
				{ width: 'half' },
			),
			field(
				'autocomplete_external',
				'string',
				'input-autocomplete-api',
				{
					url: 'https://example.com/search?q={{value}}',
					resultsPath: 'results',
					textPath: 'label',
					trigger: 'throttle',
				},
				{ width: 'half' },
			),
			// boolean
			field(
				'boolean',
				'boolean',
				'boolean',
				{ label: 'Published', iconOn: 'visibility', iconOff: 'visibility_off', colorOn: GREEN, colorOff: RED },
				{
					width: 'half',
					special: ['cast-boolean'],
					display: 'boolean',
					display_options: {
						labelOn: 'Yes',
						labelOff: 'No',
						iconOn: 'check',
						iconOff: 'close',
						colorOn: GREEN,
						colorOff: RED,
					},
				},
			),
			field('boolean_default', 'boolean', 'boolean', null, {
				width: 'half',
				special: ['cast-boolean'],
				display: 'boolean',
			}),
			// datetime
			field('date', 'date', 'datetime', null, {
				width: 'half',
				display: 'datetime',
				display_options: { format: 'short' },
			}),
			field(
				'time',
				'time',
				'datetime',
				{ includeSeconds: true, use24: false },
				{
					width: 'half',
					display: 'datetime',
					display_options: { format: 'long', includeSeconds: true },
				},
			),
			field(
				'date_time',
				'dateTime',
				'datetime',
				{ includeSeconds: false, use24: true },
				{
					width: 'half',
					display: 'datetime',
					display_options: { format: 'MMM d, yyyy HH:mm', use24: true },
				},
			),
			field(
				'timestamp',
				'timestamp',
				'datetime',
				{ tz: 'Asia/Ho_Chi_Minh', includeSeconds: true },
				{
					width: 'half',
					display: 'datetime',
					display_options: { relative: true, strict: true, round: 'floor', suffix: true },
				},
			),
			field(
				'timestamp_relative',
				'timestamp',
				'datetime',
				{ relative: true },
				{
					width: 'half',
					display: 'datetime',
					display_options: { relative: true, suffix: false, tz: 'America/New_York' },
				},
			),
			// slider
			field(
				'slider',
				'integer',
				'slider',
				{ minValue: 0, maxValue: 10, stepInterval: 1, alwaysShowValue: true },
				{
					width: 'half',
					display: 'rating',
					display_options: { simple: false },
				},
			),
			field(
				'slider_float',
				'float',
				'slider',
				{ minValue: 0, maxValue: 1, stepInterval: 0.1 },
				{
					width: 'half',
					display: 'rating',
					display_options: { simple: true },
				},
			),
			// tags
			field(
				'tags',
				'json',
				'tags',
				{
					presets: ['alpha', 'beta', 'gamma'],
					placeholder: 'Add a tag',
					alphabetize: true,
					allowCustom: true,
					whitespace: '-',
					capitalization: 'lowercase',
					iconLeft: 'sell',
					iconRight: 'local_offer',
				},
				{
					width: 'half',
					special: ['cast-json'],
					display: 'labels',
					display_options: {
						format: false,
						choices: [{ text: 'Alpha', value: 'alpha', foreground: WHITE, background: PURPLE }],
					},
				},
			),
			field(
				'tags_csv',
				'csv',
				'tags',
				{ presets: ['one', 'two'], allowCustom: false, capitalization: 'uppercase', whitespace: '_' },
				{
					width: 'half',
					special: ['cast-csv'],
					display: 'labels',
				},
			),
			// input-code
			field(
				'code_json',
				'json',
				'input-code',
				{ lineNumber: true, lineWrapping: true, template: '{\n\t"key": "value"\n}' },
				{ special: ['cast-json'], display: 'formatted-json-value', display_options: { format: '{{key}}' } },
			),
			field('code_js', 'text', 'input-code', { language: 'javascript', lineNumber: false }, { display: 'raw' }),
			field('code_string_json', 'string', 'input-code', { language: 'JSON' }, {}, { max_length: 255 }),
			// selection
			field(
				'select_dropdown',
				'string',
				'select-dropdown',
				{
					choices: choicesAbc,
					allowOther: true,
					allowNone: true,
					icon: 'arrow_drop_down_circle',
					placeholder: 'Pick one',
				},
				{
					width: 'half',
					display: 'labels',
					display_options: {
						showAsDot: true,
						format: true,
						choices: [
							{ text: 'Alpha', value: 'alpha', icon: 'star', color: PURPLE, foreground: WHITE, background: PURPLE },
							{ text: 'Beta', value: 'beta', foreground: WHITE, background: GREEN },
						],
					},
				},
			),
			field(
				'select_dropdown_int',
				'integer',
				'select-dropdown',
				{
					choices: [
						{ text: 'One', value: 1 },
						{ text: 'Two', value: 2 },
					],
				},
				{ width: 'half', display: 'labels', display_options: { showAsDot: false } },
			),
			field(
				'select_multiple_dropdown',
				'json',
				'select-multiple-dropdown',
				{
					choices: choicesAbc,
					allowOther: true,
					allowNone: true,
					placeholder: 'Pick some',
					icon: 'list',
					previewThreshold: 2,
				},
				{ width: 'half', special: ['cast-json'], display: 'labels', display_options: { choices: choicesAbc } },
			),
			field(
				'select_multiple_dropdown_csv',
				'csv',
				'select-multiple-dropdown',
				{ choices: choicesAbc },
				{ width: 'half', special: ['cast-csv'] },
			),
			field(
				'select_radio',
				'string',
				'select-radio',
				{ choices: choicesAbc, iconOn: 'check_circle', iconOff: 'circle', color: GREEN, allowOther: true },
				{ width: 'half', display: 'raw' },
			),
			field(
				'select_radio_int',
				'integer',
				'select-radio',
				{
					choices: [
						{ text: 'One', value: 1 },
						{ text: 'Two', value: 2 },
					],
				},
				{ width: 'half' },
			),
			field(
				'select_checkbox',
				'json',
				'select-multiple-checkbox',
				{
					choices: [...choicesAbc, { text: 'Delta', value: 'delta', disabled: true }],
					allowOther: true,
					color: PURPLE,
					iconOn: 'check_box',
					iconOff: 'check_box_outline_blank',
					itemsShown: 2,
				},
				{ width: 'half', special: ['cast-json'] },
			),
			field(
				'select_checkbox_csv',
				'csv',
				'select-multiple-checkbox',
				{ choices: choicesAbc },
				{ width: 'half', special: ['cast-csv'] },
			),
			field(
				'select_tree',
				'json',
				'select-multiple-checkbox-tree',
				{
					choices: [
						{
							text: 'Fruit',
							value: 'fruit',
							children: [
								{ text: 'Apple', value: 'apple' },
								{ text: 'Pear', value: 'pear' },
							],
						},
						{ text: 'Vegetable', value: 'vegetable', children: [{ text: 'Kale', value: 'kale' }] },
					],
					valueCombining: 'branch',
				},
				{ width: 'half', special: ['cast-json'], display: 'formatted-json-value' },
			),
			field(
				'select_tree_csv',
				'csv',
				'select-multiple-checkbox-tree',
				{
					choices: [{ text: 'Root', value: 'root', children: [{ text: 'Leaf', value: 'leaf' }] }],
					valueCombining: 'leaf',
				},
				{ width: 'half', special: ['cast-csv'] },
			),
			field('select_icon', 'string', 'select-icon', null, {
				width: 'half',
				display: 'icon',
				display_options: { filled: true, color: PURPLE },
			}),
			field(
				'select_color',
				'string',
				'select-color',
				{
					opacity: true,
					presets: [
						{ name: 'Purple', color: PURPLE },
						{ name: 'Green', color: GREEN },
					],
				},
				{ width: 'half', display: 'color', display_options: { defaultColor: '#B0BEC5' } },
			),
			field('select_color_default', 'string', 'select-color', null, { width: 'half', display: 'color' }),
			// list (repeater)
			field(
				'list',
				'json',
				'list',
				{
					fields: [
						{
							field: 'title',
							name: 'Title',
							type: 'string',
							meta: {
								field: 'title',
								type: 'string',
								width: 'half',
								interface: 'input',
								required: true,
								note: 'Title of the row',
								options: { placeholder: 'Title' },
								display: 'formatted-value',
								display_options: { bold: true },
							},
						},
						{
							field: 'count',
							name: 'Count',
							type: 'integer',
							meta: { field: 'count', type: 'integer', width: 'half', interface: 'input', options: { min: 0 } },
						},
					],
					template: '{{ title }} ({{ count }})',
					addLabel: 'Add row',
					sort: 'count',
				},
				{ special: ['cast-json'], display: 'formatted-json-value', display_options: { format: '{{title}}' } },
			),
			// map, non-native storage
			field(
				'map_json',
				'json',
				'map',
				{ geometryType: 'Point', defaultView: { center: { lng: 105.85, lat: 21.03 }, zoom: 10, bearing: 0, pitch: 0 } },
				{ special: ['cast-json'], display: 'formatted-json-value' },
			),
			field('map_text', 'text', 'map', { geometryType: 'Polygon' }),
			field('map_csv', 'csv', 'map', { geometryType: 'Point' }, { special: ['cast-csv'] }),
			// rich editors
			field(
				'rich_html',
				'text',
				'input-rich-text-html',
				{
					toolbar: [
						'bold',
						'italic',
						'h1',
						'h2',
						'numlist',
						'bullist',
						'customLink',
						'customImage',
						'customMedia',
						'code',
						'fullscreen',
					],
					font: 'serif',
					folder,
					imageToken: 'bo-image-token',
					softLength: 1000,
					customFormats: [{ title: 'Big', inline: 'span', styles: { 'font-size': '2em' } }],
					tinymceOverrides: { menubar: false },
				},
				{ display: 'formatted-value' },
			),
			field('rich_md', 'text', 'input-rich-text-md', {
				toolbar: ['heading', 'bold', 'italic', 'link', 'code', 'image'],
				placeholder: 'Write markdown',
				folder,
				imageToken: 'bo-image-token',
				softLength: 1000,
				editorFont: 'monospace',
				previewFont: 'serif',
				defaultView: 'preview',
				customSyntax: [{ name: 'Highlight', icon: 'format_color_fill', prefix: '==', suffix: '==', box: 'inline' }],
			}),
			field(
				'block_editor',
				'json',
				'input-block-editor',
				{
					placeholder: 'Write blocks',
					font: 'serif',
					tools: ['header', 'paragraph', 'code', 'image', 'table'],
					bordered: false,
					folder,
				},
				{ special: ['cast-json'] },
			),
			// plain displays
			field('collection_name', 'string', 'input', null, {
				width: 'half',
				display: 'collection',
				display_options: { icon: true },
			}),
			field('mime', 'string', 'input', null, {
				width: 'half',
				display: 'mime-type',
				display_options: { showAsExtension: true },
			}),
			field('filesize', 'integer', 'input', null, { width: 'half', display: 'filesize' }),
			// FR-002/FR-003 (US1-2): no interface and an interface id that is not registered (an extension's);
			// FR-015: a schema default applied on a new item.
			field('interface_null', 'string', null, null, { width: 'half' }),
			field('interface_unknown', 'text', 'bo-extension-interface', null, { width: 'half' }),
			field('input_with_default', 'string', 'input', null, { width: 'half' }, { default_value: 'Draft' }),
		],
		{ icon: 'input', display_template: '{{ input_string }}', note: 'Standard and selection interfaces' },
	);
}

/** geometry.* fields, only on databases with native geometry support (Postgres with PostGIS). */
const geometryFields = [
	field('map_point', 'geometry.Point', 'map', null, { display: 'formatted-json-value' }),
	field('map_polygon', 'geometry.Polygon', 'map', {
		defaultView: { center: { lng: 105.85, lat: 21.03 }, zoom: 5, bearing: 0, pitch: 0 },
	}),
	field('map_geometry', 'geometry', 'map', { geometryType: 'LineString' }),
];

function groupsCollection({ flow }) {
	const flowLink = { label: 'Run flow', icon: 'bolt', type: 'normal', actionType: 'flow', flow };

	return collection(
		'bo_groups',
		[
			intPk(),
			presentation('header', 'header', {
				title: '{{ title }}',
				subtitle: 'Item {{ id }} - {{ target.name }}',
				color: PURPLE,
				icon: 'flag',
				help: '<p>Some <strong>help</strong> text</p>',
				helpDisplayMode: 'modal',
				enableHelpTranslations: false,
				links: [
					{ label: 'Docs', icon: 'link', type: 'primary', actionType: 'url', url: 'https://example.com/{{ id }}' },
					flowLink,
				],
			}),
			presentation('header_inline', 'header', {
				title: 'Second header',
				helpDisplayMode: 'inline',
				enableHelpTranslations: true,
				helpTranslationsString: '$t:interfaces.presentation-notice.description',
				links: [{ label: 'Open target', type: 'info', actionType: 'url', url: '/content/bo_rel_target/{{ target }}' }],
			}),
			// US6-2: an internal link and a flow link in the same header ("Actions" menu with two entries).
			presentation('header_actions', 'header', {
				title: 'Actions header',
				links: [
					{ label: 'Open item', icon: 'launch', type: 'normal', actionType: 'url', url: '/content/bo_groups/{{ id }}' },
					flowLink,
				],
			}),
			field('title', 'string', 'input', null, { width: 'half', required: true }),
			field(
				'status',
				'string',
				'select-dropdown',
				{
					choices: [
						{ text: 'Draft', value: 'draft' },
						{ text: 'Published', value: 'published' },
					],
				},
				{
					width: 'half',
					validation: { _and: [{ status: { _in: ['draft', 'published'] } }] },
					validation_message: '$t:validationError.in',
				},
			),
			field(
				'target',
				'integer',
				'select-dropdown-m2o',
				{ template: '{{ name }}' },
				{
					width: 'half',
					special: ['m2o'],
					display: 'related-values',
					display_options: { template: '{{ name }}' },
				},
			),
			presentation('divider', 'presentation-divider', {
				title: 'Section',
				color: PURPLE,
				icon: 'title',
				inlineTitle: true,
			}),
			presentation('divider_default', 'presentation-divider', null),
			presentation('links', 'presentation-links', {
				links: [
					{
						label: 'Target',
						icon: 'open_in_new',
						type: 'normal',
						actionType: 'url',
						url: '/content/bo_rel_target/{{ target.id }}',
					},
					{ label: 'External', type: 'success', actionType: 'url', url: 'https://example.com/?title={{ title }}' },
					{ ...flowLink, type: 'warning' },
				],
			}),
			presentation('notice', 'presentation-notice', { color: 'warning', icon: 'warning', text: 'Read **this** first' }),
			presentation('notice_default', 'presentation-notice', { text: 'Plain notice' }),
			// accordion with a nested raw group
			group('accordion', 'group-accordion', { accordionMode: false, start: 'opened' }),
			field('acc_text', 'string', 'input', null, { group: 'accordion' }),
			group('acc_group', 'group-raw', null, { group: 'accordion' }),
			field('acc_inner', 'string', 'input', null, { group: 'acc_group' }),
			group('accordion_single', 'group-accordion', { accordionMode: true, start: 'first' }),
			group('acc_single_a', 'group-raw', null, { group: 'accordion_single' }),
			field('acc_single_a_text', 'string', 'input', null, { group: 'acc_single_a' }),
			group('acc_single_b', 'group-raw', null, { group: 'accordion_single' }),
			field('acc_single_b_text', 'string', 'input', null, { group: 'acc_single_b' }),
			// FR-014 (US6-3): a read-only group pushes read-only down to its children.
			group('readonly_group', 'group-raw', null, { readonly: true }),
			field('readonly_child', 'string', 'input', null, { group: 'readonly_group' }),
			// detail
			group('detail', 'group-detail', { start: 'closed', headerIcon: 'info', headerColor: GREEN }),
			field('detail_text', 'string', 'input', null, { group: 'detail', width: 'half' }),
			field('detail_number', 'integer', 'input', null, { group: 'detail', width: 'half', required: true }),
			// raw
			group('raw', 'group-raw', null),
			field('raw_text', 'string', 'input', null, { group: 'raw' }),
			// nested tabs
			group('tabs', 'group-tabs', { fillWidth: true }),
			group('tab_one', 'group-raw', null, { group: 'tabs' }),
			field('tab_one_text', 'string', 'input', null, { group: 'tab_one' }),
			group('tab_two', 'group-tabs', { fillWidth: false }, { group: 'tabs' }),
			group('tab_two_a', 'group-raw', null, { group: 'tab_two' }),
			field('tab_two_a_text', 'string', 'input', null, { group: 'tab_two_a' }),
			group('tab_two_b', 'group-detail', { start: 'open' }, { group: 'tab_two' }),
			field('tab_two_b_text', 'string', 'input', null, {
				group: 'tab_two_b',
				conditions: [{ name: 'Hidden when draft', rule: { _and: [{ status: { _eq: 'draft' } }] }, hidden: true }],
			}),
			// group without interface (Edge Cases: not rendered, nor its children)
			group('group_null', null, null),
			field('group_null_child', 'string', 'input', null, { group: 'group_null' }),
		],
		{ icon: 'view_agenda', display_template: '{{ title }}', note: 'Groups and presentation' },
	);
}

function relCollections({ folder }) {
	const fileOptions = { folder, enableCreate: true, enableSelect: true };

	return [
		collection(
			'bo_rel',
			[
				intPk(),
				field('title', 'string', 'input', null, { width: 'half' }),
				field(
					'm2o',
					'integer',
					'select-dropdown-m2o',
					{
						template: '{{ name }} ({{ status }})',
						enableCreate: true,
						enableSelect: true,
						enableLink: true,
						filter: { _and: [{ name: { _contains: '{{ title }}' } }] },
					},
					{ width: 'half', special: ['m2o'], display: 'related-values', display_options: { template: '{{ name }}' } },
				),
				field('m2o_default', 'integer', 'select-dropdown-m2o', null, {
					width: 'half',
					special: ['m2o'],
					display: 'related-values',
				}),
				field(
					'owner',
					'uuid',
					'select-dropdown-m2o',
					{ template: '{{ first_name }} {{ last_name }}' },
					{
						width: 'half',
						special: ['m2o'],
						display: 'user',
						display_options: { display: 'both', circle: true },
					},
				),
				alias(
					'o2m_list',
					['o2m'],
					'list-o2m',
					{
						layout: 'list',
						template: '{{ name }}',
						enableCreate: true,
						enableSelect: true,
						enableLink: true,
						limit: 5,
						filter: { _and: [{ status: { _neq: 'archived' } }] },
						sort: 'name',
						sortDirection: '-',
					},
					{ display: 'related-values', display_options: { template: '{{ name }}' } },
				),
				alias('o2m_table', ['o2m'], 'list-o2m', {
					layout: 'table',
					tableSpacing: 'compact',
					fields: ['name', 'status'],
					enableSearchFilter: true,
					limit: 10,
					sort: 'name',
					sortDirection: '+',
				}),
				alias(
					'm2m_list',
					['m2m'],
					'list-m2m',
					{
						layout: 'list',
						template: '{{ bo_rel_target_id.name }}',
						junctionFieldLocation: 'top',
						allowDuplicates: true,
						enableLink: true,
					},
					{ display: 'related-values', display_options: { template: '{{ bo_rel_target_id.name }}' } },
				),
				alias('m2m_table', ['m2m'], 'list-m2m', {
					layout: 'table',
					fields: ['bo_rel_target_id.name', 'bo_rel_target_id.status'],
					tableSpacing: 'comfortable',
					enableSearchFilter: true,
					enableSelect: false,
					enableCreate: true,
					limit: 15,
					filter: { _and: [{ status: { _eq: 'published' } }] },
				}),
				alias(
					'm2a',
					['m2a'],
					'list-m2a',
					{
						enableSelect: true,
						enableCreate: true,
						limit: 10,
						allowDuplicates: false,
						prefix: '{{ collection }}: ',
					},
					{
						display: 'related-values',
						display_options: { template: '{{ item:bo_m2a_a.name }}{{ item:bo_m2a_b.title }}' },
					},
				),
				alias(
					'files',
					['files'],
					'files',
					{
						...fileOptions,
						template: '{{ directus_files_id.title }}',
						filter: { _and: [{ type: { _nnull: true } }] },
						limit: 10,
						allowedMimeTypes: ['image/*', 'application/pdf'],
					},
					{ display: 'related-values', display_options: { template: '{{ directus_files_id.title }}' } },
				),
				field(
					'file',
					'uuid',
					'file',
					{
						...fileOptions,
						allowedMimeTypes: ['application/pdf'],
						filter: { _and: [{ type: { _eq: 'application/pdf' } }] },
					},
					{
						width: 'half',
						special: ['file'],
						display: 'file',
					},
				),
				field(
					'file_image',
					'uuid',
					'file-image',
					{ ...fileOptions, crop: false, letterbox: true, allowedMimeTypes: ['image/*'] },
					{
						width: 'half',
						special: ['file'],
						display: 'image',
						display_options: { circle: true },
					},
				),
				field(
					'collection_item',
					'json',
					'collection-item-dropdown',
					{
						selectedCollection: 'bo_rel_target',
						template: '{{ name }}',
						filter: { _and: [{ status: { _neq: 'archived' } }] },
					},
					{ width: 'half', special: ['cast-json'] },
				),
				field(
					'collection_items',
					'json',
					'collection-item-multiple-dropdown',
					{
						selectedCollection: 'bo_m2a_a',
						template: '{{ name }}',
					},
					{ width: 'half', special: ['cast-json'] },
				),
			],
			{ icon: 'hub', display_template: '{{ title }}', note: 'Relational interfaces' },
		),
		collection(
			'bo_rel_target',
			[
				intPk(),
				field('name', 'string', 'input', null, { width: 'half' }),
				field(
					'status',
					'string',
					'select-dropdown',
					{ choices: ['draft', 'published', 'archived'].map((value) => ({ text: value, value })) },
					{ width: 'half', display: 'labels' },
				),
				field('sort', 'integer', 'input', null, { hidden: true }),
				field('o2m_list_parent', 'integer', 'select-dropdown-m2o', null, { hidden: true, special: ['m2o'] }),
				field('o2m_table_parent', 'integer', 'select-dropdown-m2o', null, { hidden: true, special: ['m2o'] }),
			],
			{ icon: 'target', display_template: '{{ name }}', sort_field: 'sort' },
		),
		junction('bo_junction_m2m_list', [
			field('bo_rel_id', 'integer', null, null, { hidden: true }),
			field('bo_rel_target_id', 'integer', null, null, { hidden: true }),
			field('sort', 'integer', null, null, { hidden: true }),
		]),
		junction('bo_junction_m2m_table', [
			field('bo_rel_id', 'integer', null, null, { hidden: true }),
			field('bo_rel_target_id', 'integer', null, null, { hidden: true }),
		]),
		junction('bo_junction_m2a', [
			field('bo_rel_id', 'integer', null, null, { hidden: true }),
			field('item', 'string', null, null, { hidden: true }),
			field('collection', 'string', null, null, { hidden: true }),
			field('sort', 'integer', null, null, { hidden: true }),
		]),
		junction('bo_junction_files', [
			field('bo_rel_id', 'integer', null, null, { hidden: true }),
			field('directus_files_id', 'uuid', null, null, { hidden: true }),
			field('sort', 'integer', null, null, { hidden: true }),
		]),
		collection('bo_m2a_a', [intPk(), field('name', 'string', 'input')], {
			icon: 'looks_one',
			display_template: '{{ name }}',
		}),
		collection('bo_m2a_b', [uuidPk(), field('title', 'string', 'input')], {
			icon: 'looks_two',
			display_template: '{{ title }}',
		}),
		collection(
			'bo_tree',
			[
				intPk(),
				field('name', 'string', 'input'),
				field(
					'parent',
					'integer',
					'select-dropdown-m2o',
					{ template: '{{ name }}' },
					{ special: ['m2o'], width: 'half' },
				),
				field('sort', 'integer', 'input', null, { hidden: true }),
				alias(
					'children',
					['o2m'],
					'list-o2m-tree-view',
					{
						displayTemplate: '{{ name }}',
						enableCreate: true,
						enableSelect: true,
						filter: { _and: [{ name: { _nnull: true } }] },
					},
					{ display: 'related-values', display_options: { template: '{{ name }}' } },
				),
			],
			{ icon: 'account_tree', display_template: '{{ name }}' },
		),
		collection(
			'bo_languages',
			[
				field('code', 'string', 'input', null, {}, { is_primary_key: true, length: 255, has_auto_increment: false }),
				field('name', 'string', 'input'),
				field(
					'direction',
					'string',
					'select-dropdown',
					{
						choices: [
							{ text: '$t:left_to_right', value: 'ltr' },
							{ text: '$t:right_to_left', value: 'rtl' },
						],
					},
					{ display: 'labels' },
					{ default_value: 'ltr' },
				),
			],
			{ icon: 'translate', display_template: '{{ name }}' },
		),
		collection(
			'bo_translations',
			[
				intPk(),
				field('slug', 'string', 'input', { slug: true }),
				alias(
					'translations',
					['translations'],
					'translations',
					{
						languageField: 'name',
						languageDirectionField: 'direction',
						defaultLanguage: 'en-US',
						userLanguage: true,
						defaultOpenSplitView: true,
					},
					{
						display: 'translations',
						display_options: {
							template: '{{ title }}',
							languageField: 'name',
							defaultLanguage: 'en-US',
							userLanguage: true,
						},
					},
				),
			],
			{ icon: 'language', display_template: '{{ slug }}' },
		),
		junction('bo_translations_translations', [
			field('bo_translations_id', 'integer', null, null, { hidden: true }),
			field('bo_languages_code', 'string', null, null, { hidden: true }),
			field('title', 'string', 'input'),
			field('body', 'text', 'input-multiline'),
		]),
	];
}

function junction(name, fields) {
	return collection(name, [intPk(), ...fields], { hidden: true, icon: 'import_export' });
}

function relations() {
	const m2o = (collection, field, related, meta = {}, onDelete = 'SET NULL') => ({
		collection,
		field,
		related_collection: related,
		meta: { one_field: null, junction_field: null, sort_field: null, one_deselect_action: 'nullify', ...meta },
		schema: { on_delete: onDelete },
	});

	return [
		m2o('bo_groups', 'target', 'bo_rel_target'),
		m2o('bo_rel', 'm2o', 'bo_rel_target'),
		m2o('bo_rel', 'm2o_default', 'bo_rel_target'),
		m2o('bo_rel', 'owner', 'directus_users'),
		m2o('bo_rel', 'file', 'directus_files'),
		m2o('bo_rel', 'file_image', 'directus_files'),
		m2o('bo_rel_target', 'o2m_list_parent', 'bo_rel', { one_field: 'o2m_list', sort_field: 'sort' }),
		m2o('bo_rel_target', 'o2m_table_parent', 'bo_rel', { one_field: 'o2m_table', one_deselect_action: 'delete' }),
		m2o('bo_junction_m2m_list', 'bo_rel_id', 'bo_rel', {
			one_field: 'm2m_list',
			junction_field: 'bo_rel_target_id',
			sort_field: 'sort',
		}),
		m2o('bo_junction_m2m_list', 'bo_rel_target_id', 'bo_rel_target', { junction_field: 'bo_rel_id' }),
		m2o('bo_junction_m2m_table', 'bo_rel_id', 'bo_rel', { one_field: 'm2m_table', junction_field: 'bo_rel_target_id' }),
		m2o('bo_junction_m2m_table', 'bo_rel_target_id', 'bo_rel_target', { junction_field: 'bo_rel_id' }),
		m2o('bo_junction_m2a', 'bo_rel_id', 'bo_rel', { one_field: 'm2a', junction_field: 'item', sort_field: 'sort' }),
		{
			collection: 'bo_junction_m2a',
			field: 'item',
			related_collection: null,
			meta: {
				one_allowed_collections: ['bo_m2a_a', 'bo_m2a_b'],
				one_collection_field: 'collection',
				junction_field: 'bo_rel_id',
			},
		},
		m2o('bo_junction_files', 'bo_rel_id', 'bo_rel', {
			one_field: 'files',
			junction_field: 'directus_files_id',
			sort_field: 'sort',
		}),
		m2o('bo_junction_files', 'directus_files_id', 'directus_files', { junction_field: 'bo_rel_id' }),
		m2o('bo_tree', 'parent', 'bo_tree', { one_field: 'children', sort_field: 'sort' }),
		m2o('bo_translations_translations', 'bo_translations_id', 'bo_translations', {
			one_field: 'translations',
			junction_field: 'bo_languages_code',
		}),
		m2o('bo_translations_translations', 'bo_languages_code', 'bo_languages', { junction_field: 'bo_translations_id' }),
	];
}

/* ---------------------------------------------------------------- Content module (014) */

const CONTENT_STATUS = [
	{ text: 'Draft', value: 'draft' },
	{ text: 'Published', value: 'published' },
	{ text: 'Archived', value: 'archived' },
];

/** `bo_folder` (a folder: no table) holding `bo_content`, and the `bo_singleton` singleton. */
function contentCollections() {
	return [
		{ collection: 'bo_folder', meta: { icon: 'folder', collapse: 'locked', sort: 100 }, schema: null },
		collection(
			'bo_content',
			[
				intPk(),
				field(
					'status',
					'string',
					'select-dropdown',
					{ choices: CONTENT_STATUS },
					{ width: 'half', display: 'labels', display_options: { choices: CONTENT_STATUS } },
					{ default_value: 'draft', is_nullable: false },
				),
				field('title', 'string', 'input', null, { width: 'half', required: true }),
				field('body', 'text', 'input-multiline'),
				field('date_published', 'dateTime', 'datetime', null, { width: 'half' }),
				field('sort', 'integer', 'input', null, { hidden: true }),
				field(
					'author',
					'uuid',
					'select-dropdown-m2o',
					{ template: '{{ first_name }} {{ last_name }}' },
					{
						width: 'half',
						special: ['m2o'],
						display: 'related-values',
						display_options: { template: '{{ first_name }} {{ last_name }}' },
					},
				),
				field('cover', 'uuid', 'file-image', null, { width: 'half', special: ['file'], display: 'image' }),
				field('tags', 'csv', 'tags', null, { width: 'half', special: ['cast-csv'] }),
			],
			{
				group: 'bo_folder',
				icon: 'article',
				sort: 1,
				versioning: true,
				archive_field: 'status',
				archive_value: 'archived',
				unarchive_value: 'draft',
				archive_app_filter: true,
				display_template: '{{ title }}',
				preview_url: 'https://preview.example/{{ id }}?v={{ $version }}',
				sort_field: 'sort',
				accountability: 'all',
				item_duplication_fields: ['status', 'title', 'body', 'date_published', 'author', 'tags'],
			},
		),
		collection(
			'bo_singleton',
			[
				intPk(),
				field('site_name', 'string', 'input', null, { width: 'half' }),
				field('tagline', 'text', 'input-multiline'),
				field(
					'maintenance',
					'boolean',
					'boolean',
					null,
					{ width: 'half', special: ['cast-boolean'] },
					{
						default_value: false,
					},
				),
			],
			{ singleton: true, icon: 'settings', sort: 101 },
		),
	];
}

const contentLocation = field('location', 'geometry.Point', 'map', null, { width: 'full' });

const contentRelations = () => [
	{
		collection: 'bo_content',
		field: 'author',
		related_collection: 'directus_users',
		meta: { one_field: null, junction_field: null, sort_field: null, one_deselect_action: 'nullify' },
		schema: { on_delete: 'SET NULL' },
	},
	{
		collection: 'bo_content',
		field: 'cover',
		related_collection: 'directus_files',
		meta: { one_field: null, junction_field: null, sort_field: null, one_deselect_action: 'nullify' },
		schema: { on_delete: 'SET NULL' },
	},
];

/** Deterministic rows: Content 01..30, statuses in turn, one date per day of October 2026. */
function contentItems({ admin, png, geometry }) {
	return Array.from({ length: 30 }, (_, i) => {
		const n = i + 1;
		const status = CONTENT_STATUS[i % 3].value;
		return {
			status,
			title: `Content ${String(n).padStart(2, '0')}`,
			body: n % 5 === 0 ? null : `Body of content ${n}`,
			date_published: `2026-10-${String(n).padStart(2, '0')}T09:00:00`,
			sort: n,
			author: n % 2 === 0 ? admin : null,
			cover: n <= 3 ? png : null,
			tags: n % 4 === 0 ? ['news', 'vn'] : ['news'],
			...(geometry ? { location: { type: 'Point', coordinates: [105.8 + n / 100, 21.0 + n / 100] } } : {}),
		};
	});
}

async function createContentFixtures({ users, files, geometry }) {
	const admin = (await api.get('/users/me?fields=id')).id;
	const editor = users['bo-editor'];
	const viewer = users['bo-viewer'];

	// Access: the editor reads, creates and updates bo_content (no delete, no share) and reads/updates the singleton;
	// the viewer reads both.
	const perm = (policy, collection, action) => ({
		policy,
		collection,
		action,
		fields: ['*'],
		permissions: {},
		validation: {},
	});
	await api.request('POST', '/permissions', [
		...['create', 'read', 'update'].map((action) => perm(editor.policy, 'bo_content', action)),
		...['read', 'update'].map((action) => perm(editor.policy, 'bo_singleton', action)),
		perm(viewer.policy, 'bo_content', 'read'),
		perm(viewer.policy, 'bo_singleton', 'read'),
	]);

	await api.request('POST', '/items/bo_content', contentItems({ admin, png: files.png, geometry }));
	await api.request('PATCH', '/items/bo_singleton', {
		site_name: 'Backoffice fixtures',
		tagline: 'Content module',
		maintenance: false,
	});

	// Revisions on item 1: two updates after the create.
	await api.request('PATCH', '/items/bo_content/1', { title: 'Content 01 (edited)' });
	await api.request('PATCH', '/items/bo_content/1', { body: 'Body of content 1, second edit' });

	// Presets (FR-010): the admin's own, the bo-editor role's and a global one; a personal and a global bookmark.
	await api.request('POST', '/presets', [
		{
			collection: 'bo_content',
			user: admin,
			layout: 'tabular',
			layout_query: { tabular: { fields: ['title', 'status', 'date_published'], sort: ['sort'], page: 1 } },
			layout_options: { tabular: { widths: { title: 240 }, spacing: 'cozy' } },
		},
		{
			collection: 'bo_content',
			role: editor.role,
			layout: 'tabular',
			layout_query: { tabular: { fields: ['title', 'status'], sort: ['-date_published'] } },
		},
		{
			collection: 'bo_content',
			layout: 'cards',
			layout_options: { cards: { title: '{{ title }}', imageSource: 'cover' } },
		},
		{
			collection: 'bo_content',
			user: admin,
			bookmark: 'bo-bookmark',
			icon: 'bookmark',
			layout: 'tabular',
			filter: { status: { _eq: 'published' } },
		},
		{ collection: 'bo_content', bookmark: 'bo-global-bookmark', icon: 'star', layout: 'tabular', search: 'Content 1' },
	]);

	// Versions of bo_content/1: the global draft and a local one, each with a delta.
	const draft = await api.request('POST', '/versions', { key: 'draft', collection: 'bo_content', item: '1' });
	await api.request('POST', `/versions/${draft.id}/save`, { title: 'Content 01 (draft)' });
	const local = await api.request('POST', '/versions', {
		key: 'local-1',
		name: 'Local 1',
		collection: 'bo_content',
		item: '1',
	});
	await api.request('POST', `/versions/${local.id}/save`, { status: 'published' });

	// A share of bo_content/1 for the viewer role, with a password and five uses.
	await api.request('POST', '/shares', {
		name: SHARE.name,
		collection: 'bo_content',
		item: '1',
		role: viewer.role,
		password: SHARE.password,
		max_uses: 5,
	});

	// Two comments on bo_content/1, the second mentions the viewer (a notification row, 008).
	await api.request('POST', '/comments', { collection: 'bo_content', item: '1', comment: 'First comment' });
	await api.request('POST', '/comments', {
		collection: 'bo_content',
		item: '1',
		comment: `Please review @${viewer.user}`,
	});

	// Manual flows of the Content module: one on both screens that needs a selection, one on the item page with a
	// confirmation form.
	await api.request('POST', '/flows', [
		{
			name: CONTENT_FLOWS[0],
			icon: 'bolt',
			color: GREEN,
			status: 'active',
			trigger: 'manual',
			accountability: 'all',
			options: { collections: ['bo_content'], location: 'both', requireSelection: true },
		},
		{
			name: CONTENT_FLOWS[1],
			icon: 'send',
			status: 'active',
			trigger: 'manual',
			accountability: 'all',
			options: {
				collections: ['bo_content'],
				location: 'item',
				requireConfirmation: true,
				confirmationDescription: 'Send this item?',
				fields: [{ field: 'reason', type: 'string', name: 'Reason', meta: { interface: 'input', width: 'full' } }],
			},
		},
	]);
}

/* ---------------------------------------------------------------- files */

// Tiny generated samples (no download): 1x1 PNG, 8x8 SVG, one-page PDF.
const SAMPLES = [
	{
		title: 'bo-sample-png',
		name: 'bo-sample.png',
		type: 'image/png',
		data: Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
			'base64',
		),
	},
	{
		title: 'bo-sample-svg',
		name: 'bo-sample.svg',
		type: 'image/svg+xml',
		data: Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${PURPLE}"/></svg>`,
		),
	},
	{
		title: 'bo-sample-pdf',
		name: 'bo-sample.pdf',
		type: 'application/pdf',
		data: Buffer.from(
			'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
				'3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 72 72]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
		),
	},
];

async function uploadSamples(folder) {
	const ids = {};

	for (const sample of SAMPLES) {
		// Same field order as v-upload.vue: folder, title, then the file.
		const form = new FormData();
		form.append('folder', folder);
		form.append('title', sample.title);
		form.append('file', new Blob([sample.data], { type: sample.type }), sample.name);
		ids[sample.type] = (await api.request('POST', '/files', form)).id;
	}

	return { png: ids['image/png'], svg: ids['image/svg+xml'], pdf: ids['application/pdf'] };
}

/* ---------------------------------------------------------------- access */

async function createAccess(flowsReadable) {
	const ids = {};

	for (const name of ROLES) {
		const policy = await api.request('POST', '/policies', {
			name,
			icon: 'badge',
			description: `Fixture policy ${name}`,
			admin_access: false,
			app_access: true,
			enforce_tfa: false,
		});

		const role = await api.request('POST', '/roles', {
			name,
			icon: 'person',
			policies: { create: [{ policy: policy.id }] },
		});

		const user = await api.request('POST', '/users', {
			email: USERS[name].email,
			password: USERS[name].password,
			first_name: name === 'bo-editor' ? 'Edith' : 'Victor',
			last_name: name === 'bo-editor' ? 'Editor' : 'Viewer',
			role: role.id,
			status: 'active',
		});

		ids[name] = { policy: policy.id, role: role.id, user: user.id };
	}

	const perm = (policy, collection, action, fields = ['*']) => ({
		policy,
		collection,
		action,
		fields,
		permissions: {},
		validation: {},
	});

	const editor = ids['bo-editor'].policy;
	const viewer = ids['bo-viewer'].policy;
	const readWrite = [
		'bo_std',
		'bo_rel',
		'bo_junction_m2m_list',
		'bo_junction_m2m_table',
		'bo_junction_m2a',
		'bo_junction_files',
	];
	readWrite.push('bo_m2a_a', 'bo_tree', 'bo_translations', 'bo_translations_translations');
	const readOnly = ['bo_groups', 'bo_m2a_b', 'bo_languages', 'directus_files'];
	const all = [...readWrite, ...readOnly, 'bo_rel_target'];

	await api.request('POST', '/permissions', [
		...readWrite.flatMap((c) => ['create', 'read', 'update'].map((action) => perm(editor, c, action))),
		...readOnly.map((c) => perm(editor, c, 'read')),
		// Read-only and without `status`: templates that use it render empty for the editor (Edge Cases).
		perm(editor, 'bo_rel_target', 'read', ['id', 'name', 'sort', 'o2m_list_parent', 'o2m_table_parent']),
		...(flowsReadable
			? [
					perm(editor, 'directus_flows', 'read', [
						'id',
						'name',
						'icon',
						'color',
						'status',
						'trigger',
						'options',
						'accountability',
						'operation',
					]),
				]
			: []),
		...all.map((c) => perm(viewer, c, 'read')),
	]);

	return ids;
}

/* ---------------------------------------------------------------- items */

async function createItems({ files, users }) {
	const post = (collection, body) => api.request('POST', `/items/${collection}`, body);

	await post('bo_languages', [
		{ code: 'en-US', name: 'English', direction: 'ltr' },
		{ code: 'vi-VN', name: 'Tiếng Việt', direction: 'ltr' },
		{ code: 'ar-SA', name: 'العربية', direction: 'rtl' },
	]);

	await post('bo_rel_target', [
		{ name: 'Target one', status: 'published', sort: 1 },
		{ name: 'Target two', status: 'draft', sort: 2 },
		{ name: 'Target three', status: 'published', sort: 3 },
		{ name: 'Target four', status: 'archived', sort: 4 },
		{ name: 'Target five', status: 'published', sort: 5 },
	]);

	await post('bo_m2a_a', [{ name: 'A one' }, { name: 'A two' }]);
	// One by one: a batch create returns uuid rows in database order.
	const b1 = await post('bo_m2a_b', { title: 'B one' });
	await post('bo_m2a_b', { title: 'B two' });

	await post('bo_std', [
		{
			input_string: 'alpha',
			input_masked: 'masked value',
			input_slug: 'my-slug',
			input_default: 'plain',
			input_integer: 55,
			input_float: 2.5,
			input_biginteger: '9007199254740993',
			input_decimal: '12.34',
			input_uuid: FIXED_UUIDS[0],
			input_text: 'Long text',
			input_required: 'Valid',
			input_note_md: 'note',
			input_hidden: 'hidden value',
			input_readonly: 'read only value',
			input_conditional: 'conditional',
			input_multiline: 'Line one\nLine two',
			input_hash: 'secret-value',
			system_raw: '{{ $CURRENT_USER }}',
			autocomplete: 'Target one',
			autocomplete_external: 'external',
			boolean: true,
			boolean_default: false,
			date: '2024-03-15',
			time: '14:30:45',
			date_time: '2024-03-15T14:30:00',
			timestamp: '2024-03-15T07:30:00.000Z',
			timestamp_relative: '2024-03-15T07:30:00.000Z',
			slider: 7,
			slider_float: 0.4,
			tags: ['alpha', 'custom-tag'],
			tags_csv: ['ONE', 'TWO'],
			code_json: { key: 'value', list: [1, 2] },
			code_js: 'const a = 1;\nconsole.log(a);',
			code_string_json: '{"valid": true}',
			select_dropdown: 'alpha',
			select_dropdown_int: 2,
			select_multiple_dropdown: ['beta', 'alpha'],
			select_multiple_dropdown_csv: ['alpha', 'gamma'],
			select_radio: 'beta',
			select_radio_int: 1,
			select_checkbox: ['alpha', 'other-value'],
			select_checkbox_csv: ['beta'],
			select_tree: ['fruit', 'kale'],
			select_tree_csv: ['leaf'],
			select_icon: 'star',
			select_color: '#6644FF80',
			select_color_default: GREEN,
			list: [
				{ title: 'Row A', count: 2 },
				{ title: 'Row B', count: 1 },
			],
			map_json: { type: 'Point', coordinates: [105.85, 21.03] },
			map_text: 'POLYGON((105 21,106 21,106 22,105 21))',
			map_csv: ['105.85', '21.03'],
			rich_html: `<p>Hello <strong>world</strong></p><p><img src="/assets/${files.png}.png?access_token=bo-image-token" alt="Sample"></p>`,
			rich_md: `# Title\n\nSome **bold** text and ==highlight==.\n\n![Sample](/assets/${files.png}.png)`,
			block_editor: {
				time: 1710489600000,
				version: '2.31.2',
				blocks: [
					{ id: 'bo-block-1', type: 'header', data: { text: 'Heading', level: 2 } },
					{ id: 'bo-block-2', type: 'paragraph', data: { text: 'Hello <b>world</b>' } },
					{
						id: 'bo-block-3',
						type: 'image',
						data: {
							file: {
								width: 1,
								height: 1,
								fileId: files.png,
								fileURL: `/assets/${files.png}`,
								url: `/assets/${files.png}.png`,
							},
							caption: 'Sample',
							withBorder: false,
							stretched: false,
							withBackground: false,
						},
					},
				],
			},
			collection_name: 'bo_rel',
			mime: 'image/png',
			filesize: 123456,
			...(geometry ? { map_point: { type: 'Point', coordinates: [105.85, 21.03] } } : {}),
			...(geometry
				? {
						map_polygon: {
							type: 'Polygon',
							coordinates: [
								[
									[105, 21],
									[106, 21],
									[106, 22],
									[105, 21],
								],
							],
						},
						map_geometry: {
							type: 'LineString',
							coordinates: [
								[105, 21],
								[106, 22],
							],
						},
					}
				: {}),
		},
		// Empty item: every interface starts from null.
		{ input_required: 'Empty' },
		// Malformed values (Edge Cases, CHK006): list not an array, map with the wrong geometry type, invalid JSON text.
		{
			input_string: 'beta',
			input_required: 'Malformed',
			input_integer: 5,
			boolean: false,
			list: { not: 'an array' },
			map_json: {
				type: 'LineString',
				coordinates: [
					[0, 0],
					[1, 1],
				],
			},
			code_string_json: '{ invalid json',
			select_dropdown: 'not-a-choice',
			tags: ['{{ $CURRENT_USER }}'],
			timestamp: '2024-11-03T06:30:00.000Z',
		},
	]);

	await post('bo_rel', [
		{
			title: 'Target',
			m2o: 1,
			m2o_default: 2,
			owner: users['bo-editor'].user,
			o2m_list: [2, 3],
			o2m_table: [4],
			m2m_list: [
				{ bo_rel_target_id: 1, sort: 1 },
				{ bo_rel_target_id: 1, sort: 2 },
				{ bo_rel_target_id: 5, sort: 3 },
			],
			m2m_table: [{ bo_rel_target_id: 2 }],
			m2a: [
				{ collection: 'bo_m2a_a', item: '1', sort: 1 },
				{ collection: 'bo_m2a_b', item: b1.id, sort: 2 },
			],
			files: [
				{ directus_files_id: files.png, sort: 1 },
				{ directus_files_id: files.pdf, sort: 2 },
			],
			file: files.pdf,
			file_image: files.png,
			collection_item: { key: 1, collection: 'bo_rel_target' },
			collection_items: [
				{ key: 2, collection: 'bo_m2a_a' },
				{ key: 1, collection: 'bo_m2a_a' },
			],
		},
		{ title: 'Empty' },
		{ title: 'Svg', file_image: files.svg, m2o: 3 },
	]);

	await post('bo_tree', {
		name: 'Root',
		children: [
			{ name: 'Child A', sort: 1, children: [{ name: 'Grandchild', sort: 1 }] },
			{ name: 'Child B', sort: 2 },
		],
	});

	await post('bo_translations', [
		{
			slug: 'hello',
			translations: [
				{ bo_languages_code: 'en-US', title: 'Hello', body: 'Hello body' },
				{ bo_languages_code: 'vi-VN', title: 'Xin chào', body: 'Nội dung' },
			],
		},
		{ slug: 'partial', translations: [{ bo_languages_code: 'ar-SA', title: 'مرحبا' }] },
	]);

	await post('bo_groups', [
		{
			title: 'Group item',
			status: 'published',
			target: 1,
			acc_text: 'Accordion text',
			acc_inner: 'Inner',
			detail_text: 'Detail',
			detail_number: 3,
			raw_text: 'Raw',
			tab_one_text: 'Tab one',
			tab_two_a_text: 'Tab two A',
			tab_two_b_text: 'Tab two B',
			group_null_child: 'Never shown',
		},
		{ title: 'Draft item', status: 'draft' },
	]);
}

/* ---------------------------------------------------------------- files and users (015) */

async function createFilesFixtures({ users }) {
	const { default: sharp } = await import('sharp');

	const root = (await api.request('POST', '/folders', { name: FILES_FOLDERS.root })).id;
	const sub = (await api.request('POST', '/folders', { name: FILES_FOLDERS.sub, parent: root })).id;
	const deep = (await api.request('POST', '/folders', { name: FILES_FOLDERS.deep, parent: sub })).id;

	const upload = async (folder, title, name, type, data) => {
		// Same field order as v-upload.vue: folder, title, then the file.
		const form = new FormData();
		form.append('folder', folder);
		form.append('title', title);
		form.append('file', new Blob([data], { type }), name);
		return (await api.request('POST', '/files', form)).id;
	};

	// 400x300 PNG with four colored quadrants, the image of SC-006 (crop and rotate compared pixel by pixel).
	const quadrant = (color) =>
		sharp({ create: { width: 200, height: 150, channels: 3, background: color } })
			.png()
			.toBuffer();
	const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: WHITE } })
		.composite([
			{ input: await quadrant(PURPLE), left: 0, top: 0 },
			{ input: await quadrant(GREEN), left: 200, top: 0 },
			{ input: await quadrant(RED), left: 0, top: 150 },
		])
		.png()
		.toBuffer();
	await upload(root, 'bo-edit', 'bo-edit.png', 'image/png', png);

	// JPEG with the EXIF rows of the file details (camera, exposure, shutter, focal length, ISO).
	const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: GREEN } })
		.jpeg()
		.withMetadata({
			exif: {
				IFD0: { Make: 'Backoffice', Model: 'Fixture Cam' },
				IFD2: { FNumber: '28/10', ExposureTime: '1/125', FocalLength: '50/1', ISOSpeedRatings: '200' },
			},
		})
		.toBuffer();
	await upload(root, 'bo-exif', 'bo-exif.jpg', 'image/jpeg', jpeg);

	// Enough text files for a second page of 25 cards.
	for (let index = 1; index <= 28; index++) {
		const number = String(index).padStart(2, '0');
		await upload(root, `bo-text-${number}`, `bo-text-${number}.txt`, 'text/plain', `Fixture text ${number}\n`);
	}

	await upload(sub, 'bo-sub-text', 'bo-sub-text.txt', 'text/plain', 'Sub folder text\n');
	await upload(deep, 'bo-deep-text', 'bo-deep-text.txt', 'text/plain', 'Deep folder text\n');

	// Old upload of another user: out of "recent files" (5 days) and of the admin's "my files".
	const old = await upload(root, 'bo-old', 'bo-old.txt', 'text/plain', 'Old upload\n');
	const oldDate = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
	await api.request('PATCH', `/files/${old}`, { uploaded_on: oldDate });
	await api.request('PATCH', `/files/${old}`, { uploaded_by: users['bo-editor'].user }).catch(() => {});

	const subRole = await api.request('POST', '/roles', {
		name: SUB_ROLE,
		icon: 'supervisor_account',
		parent: users['bo-editor'].role,
	});

	for (const [key, user] of Object.entries(DIRECTORY_USERS)) {
		await api.request('POST', '/users', {
			email: user.email,
			first_name: user.first_name,
			last_name: user.last_name,
			status: user.status,
			role: key === 'bo-active' ? subRole.id : users['bo-editor'].role,
			...(key === 'bo-token' && { token: 'bo-token-fixture-value' }),
			...(key === 'bo-sso' && { provider: 'oidc', external_identifier: 'bo-sso-subject' }),
			...(key === 'bo-active' && { title: 'Fixture lead', location: 'Ha Noi' }),
		});
	}
}

/* ---------------------------------------------------------------- insights (018) */

const INSIGHTS_ROWS = [
	['published', 'a', '12.50', 3, '2026-10-01T09:00:00'],
	['published', 'a', '7.25', 5, '2026-10-01T15:30:00'],
	['draft', 'b', '20.00', 1, '2026-10-02T10:00:00'],
	['published', 'a', null, 8, '2026-10-02T18:45:00'],
	['archived', 'c', '3.10', 2, '2026-10-03T08:15:00'],
	['draft', 'b', '15.75', 4, '2026-10-03T12:00:00'],
	['published', 'b', '9.99', 6, '2026-10-04T07:20:00'],
	['draft', 'a', '30.00', 7, '2026-10-04T21:10:00'],
	['archived', 'a', '1.05', 9, '2026-10-05T11:11:00'],
	['published', 'c', '18.40', 2, '2026-10-05T16:00:00'],
	['draft', 'b', '4.60', 10, '2026-10-06T06:30:00'],
	['archived', 'a', '22.20', 5, '2026-10-06T23:59:00'],
];

const insightsData = () =>
	collection(
		'bo_insights_data',
		[
			intPk(),
			field('status', 'string', 'input', null, { width: 'half' }),
			field('category', 'string', 'input', null, { width: 'half' }),
			field('amount', 'decimal', 'input', null, { width: 'half' }, { numeric_precision: 10, numeric_scale: 2 }),
			field('qty', 'integer', 'input', null, { width: 'half' }),
			field('happened_at', 'dateTime', 'datetime', null, { width: 'half' }),
			field(
				'owner',
				'uuid',
				'select-dropdown-m2o',
				{ template: '{{ first_name }} {{ last_name }}' },
				{ width: 'half', special: ['m2o'] },
			),
		],
		{ icon: 'insights', sort: 200 },
	);

const INSIGHTS_COLLECTION = 'bo_insights_data';

/** A panel of the bo_insights set: `at` is [x, y, width, height] in grid cells. */
function panel(dashboard, type, name, [x, y, width, height], options) {
	return {
		dashboard,
		type,
		name,
		icon: null,
		color: null,
		note: null,
		show_header: true,
		position_x: x,
		position_y: y,
		width,
		height,
		options,
	};
}

/** Every panel type once, on a collection only the seed writes (data-model §12, release-gate CHK052). */
function allPanels(id) {
	const on = { collection: INSIGHTS_COLLECTION };
	return [
		panel(id, 'metric', 'Items', [1, 1, 6, 2], {
			...on,
			field: 'id',
			function: 'count',
			prefix: '#',
			conditionalFormatting: [{ operator: '>=', value: 3, color: GREEN }],
		}),
		panel(id, 'label', 'Label', [7, 1, 6, 2], { text: 'Backoffice', fontWeight: 700, textAlign: 'center' }),
		panel(id, 'meter', 'Quantity', [13, 1, 6, 6], { ...on, field: 'qty', fn: 'sum', max: 100, size: 'half' }),
		panel(id, 'line-chart', 'Quantity by category', [25, 1, 6, 6], {
			...on,
			xAxis: 'category',
			yAxis: 'qty',
			aggregation: 'sum',
		}),
		panel(id, 'metric-list', 'By status', [1, 3, 12, 6], {
			...on,
			groupByField: 'status',
			aggregateField: 'id',
			aggregateFunction: 'count',
			limit: 5,
			sortDirection: 'desc',
			conditionalFormatting: [{ operator: '>=', value: 4, color: RED }],
		}),
		panel(id, 'list', 'Latest', [13, 7, 12, 6], {
			...on,
			limit: 5,
			sortField: 'id',
			sortDirection: 'desc',
			displayTemplate: '{{ status }} {{ category }}',
			linkToItem: true,
		}),
		panel(id, 'pie-chart', 'Categories', [19, 13, 10, 10], {
			...on,
			column: 'category',
			function: 'count',
			donut: true,
		}),
		panel(id, 'bar-chart', 'Amount by status', [1, 9, 12, 10], {
			...on,
			xAxis: 'status',
			yAxis: 'amount',
			function: 'sum',
			decimals: 2,
			conditionalFill: [{ axis: 'y', operator: '>=', value: 40, color: PURPLE }],
		}),
		panel(id, 'time-series', 'Per day', [1, 19, 12, 6], {
			...on,
			dateField: 'happened_at',
			valueField: 'id',
			function: 'count',
			precision: 'day',
			range: 'auto',
		}),
		panel(id, 'variable', 'Status variable', [13, 19, 12, 6], {
			field: 'all_status',
			type: 'string',
			inter: 'select-dropdown',
			defaultValue: 'published',
			options: { choices: ['published', 'draft', 'archived'].map((value) => ({ text: value, value })) },
		}),
		panel(id, 'relational-variable', 'Owners', [25, 19, 12, 6], {
			field: 'all_author',
			collection: 'directus_users',
			multiple: true,
			limit: 5,
		}),
	];
}

function varsPanels(id) {
	const filter = { _and: [{ status: { _eq: '{{ vars_status }}' } }, { owner: { id: { _in: '{{ vars_author }}' } } }] };
	return [
		panel(id, 'variable', 'Status', [1, 1, 12, 6], {
			field: 'vars_status',
			type: 'string',
			inter: 'select-dropdown',
			defaultValue: 'published',
			options: { choices: ['published', 'draft', 'archived'].map((value) => ({ text: value, value })) },
		}),
		panel(id, 'relational-variable', 'Owners', [13, 1, 12, 6], {
			field: 'vars_author',
			collection: 'directus_users',
			multiple: true,
			limit: 5,
		}),
		panel(id, 'metric', 'Matching items', [1, 7, 6, 2], {
			collection: INSIGHTS_COLLECTION,
			field: 'id',
			function: 'count',
			filter,
		}),
		panel(id, 'list', 'Matching rows', [7, 7, 12, 6], {
			collection: INSIGHTS_COLLECTION,
			limit: 10,
			sortField: 'id',
			sortDirection: 'asc',
			displayTemplate: '{{ status }} {{ qty }}',
			filter,
		}),
	];
}

function systemPanels(id) {
	return [
		panel(id, 'metric', 'Users', [1, 1, 6, 2], { collection: 'directus_users', field: 'id', function: 'count' }),
		panel(id, 'list', 'Files', [7, 1, 12, 6], {
			collection: 'directus_files',
			limit: 5,
			sortField: 'title',
			sortDirection: 'asc',
			displayTemplate: '{{ title }}',
		}),
	];
}

async function createInsightsFixtures({ users }) {
	const admin = (await api.get('/users/me?fields=id')).id;
	const editor = users['bo-editor'].user;

	await api.request('POST', '/collections', insightsData());
	await api.request('POST', '/relations', {
		collection: INSIGHTS_COLLECTION,
		field: 'owner',
		related_collection: 'directus_users',
		meta: { one_field: null, junction_field: null, sort_field: null, one_deselect_action: 'nullify' },
		schema: { on_delete: 'SET NULL' },
	});

	await api.request(
		'POST',
		`/items/${INSIGHTS_COLLECTION}`,
		INSIGHTS_ROWS.map(([status, category, amount, qty, happened_at], index) => ({
			status,
			category,
			amount,
			qty,
			happened_at,
			owner: index % 12 < 7 ? admin : editor,
		})),
	);

	const dashboards = [
		[DASHBOARDS.all, 'dashboard', PURPLE, 'Every panel type', allPanels],
		[DASHBOARDS.vars, 'tune', null, 'Dashboard variables', varsPanels],
		[DASHBOARDS.system, 'admin_panel_settings', null, null, systemPanels],
		[DASHBOARDS.empty, 'space_dashboard', null, null, () => []],
		[DASHBOARDS.unknown, 'help', null, null, (id) => [panel(id, 'bo-unknown', 'Unknown', [1, 1, 6, 6], {})]],
	];

	for (const [name, icon, color, note, panels] of dashboards) {
		const { id } = await api.request('POST', '/dashboards?fields=id', { name, icon, color, note });
		const rows = panels(id);
		if (rows.length > 0) await api.request('POST', '/panels', rows);
	}

	// Admin notifications for dev and the parity UI only; the E2E specs create their own for a temporary user (CHK053).
	await api.request('POST', '/notifications', [
		{
			recipient: admin,
			subject: NOTIFICATIONS.item,
			message: 'An **item** of `bo_content`, see [the item](/admin/content/bo_content/1).',
			collection: 'bo_content',
			item: '1',
		},
		{ recipient: admin, subject: NOTIFICATIONS.collection, message: null, collection: 'bo_content', item: null },
		{
			recipient: admin,
			subject: NOTIFICATIONS.path,
			message: 'A link to a page.',
			collection: null,
			item: '/settings/project',
		},
	]);
}

/* ---------------------------------------------------------------- flows (017) */

/**
 * One operation node of a tree as the flows editor sends it (Directus flow.vue saveChanges): `flow` on every node, the
 * children nested in `resolve` / `reject`, no key for a missing child.
 */
function op(flow, key, type, [x, y], options, children = {}) {
	return { flow, name: null, key, type, position_x: x, position_y: y, options, ...children };
}

/** Creates a flow, then its operations in one PATCH: `operation` is the tree under the trigger, `create` the loners. */
async function createFlow(flow, tree = null, loners = []) {
	const { id } = await api.request('POST', '/flows?fields=id', {
		icon: 'bolt',
		color: null,
		description: null,
		status: 'active',
		accountability: 'all',
		...flow,
	});

	const operations = { create: loners.map((build) => build(id)), update: [], delete: [] };
	await api.request('PATCH', `/flows/${id}`, { operations, ...(tree ? { operation: tree(id) } : {}) });
	return id;
}

/** POST /flows/trigger/:id, retried while the API has not loaded the new flow yet (bus reload, CHK049). */
async function runFlow(id, body) {
	for (let attempt = 1; ; attempt++) {
		try {
			return await api.request('POST', `/flows/trigger/${id}`, body);
		} catch (error) {
			if (attempt >= 10) throw error;
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
}

async function createFlowsFixtures() {
	const log = (flow, key, at, message, children) => op(flow, key, 'log', at, { message }, children);

	const child = await createFlow({ name: FLOWS.child, trigger: 'operation', options: { return: '$last' } }, (f) =>
		log(f, 'child_log', [19, 1], 'Child flow'),
	);

	// Only the resolve chain and the reject of `condition` run; the operations with side effects hang under the reject of
	// `log`, which never rejects (CHK006).
	const all = await createFlow(
		{
			name: FLOWS.all,
			icon: 'account_tree',
			description: 'Every built-in operation',
			trigger: 'manual',
			options: {
				collections: ['bo_content'],
				location: 'both',
				requireSelection: true,
				requireConfirmation: true,
				confirmationDescription: 'Run every operation?',
				fields: [
					{
						field: 'reason',
						type: 'string',
						name: 'Reason',
						meta: { interface: 'input', width: 'full', required: true },
					},
				],
			},
		},
		(f) =>
			op(
				f,
				'condition',
				'condition',
				[19, 1],
				{ filter: { $trigger: { body: { reason: { _neq: 'fail' } } } } },
				{
					resolve: log(f, 'log', [37, 1], 'Reason: {{ $trigger.body.reason }}', {
						resolve: op(
							f,
							'transform',
							'transform',
							[55, 1],
							{ json: { ok: true } },
							{
								resolve: op(
									f,
									'sleep',
									'sleep',
									[73, 1],
									{ milliseconds: 10 },
									{
										resolve: op(
											f,
											'json_web_token',
											'json-web-token',
											[91, 1],
											{ operation: 'sign', payload: { a: 1 }, secret: 'bo-secret', options: { expiresIn: '1h' } },
											{
												resolve: op(
													f,
													'item_read',
													'item-read',
													[109, 1],
													{ collection: 'bo_content', key: ['1'], permissions: '$full', emitEvents: false },
													{
														resolve: op(
															f,
															'exec',
															'exec',
															[127, 1],
															{ code: 'module.exports = async function(data) {\n\treturn { done: true };\n}' },
															{
																resolve: op(f, 'trigger', 'trigger', [145, 1], {
																	flow: child,
																	iterationMode: 'serial',
																	payload: { from: 'bo_all_ops' },
																}),
															},
														),
													},
												),
											},
										),
									},
								),
							},
						),
						reject: op(
							f,
							'item_create',
							'item-create',
							[55, 17],
							{ collection: 'bo_content', permissions: '$trigger', emitEvents: false, payload: { title: 'never' } },
							{
								resolve: op(
									f,
									'item_update',
									'item-update',
									[73, 17],
									{
										collection: 'bo_content',
										permissions: '$trigger',
										emitEvents: false,
										key: ['1'],
										payload: { title: 'never' },
									},
									{
										resolve: op(
											f,
											'item_delete',
											'item-delete',
											[91, 17],
											{ collection: 'bo_content', permissions: '$trigger', emitEvents: false, key: ['999999'] },
											{
												resolve: op(
													f,
													'request',
													'request',
													[109, 17],
													{ method: 'GET', url: 'http://127.0.0.1/' },
													{
														resolve: op(
															f,
															'mail',
															'mail',
															[127, 17],
															{ to: ['bo@example.com'], subject: 'Never sent', type: 'markdown', body: 'Hello' },
															{
																resolve: op(f, 'notification', 'notification', [145, 17], {
																	recipient: ['00000000-0000-0000-0000-000000000000'],
																	permissions: '$trigger',
																	subject: 'Never',
																	message: 'Never',
																}),
															},
														),
													},
												),
											},
										),
									},
								),
							},
						),
					}),
					reject: op(f, 'throw_error', 'throw-error', [37, 17], {
						code: 'FORBIDDEN',
						status: '403',
						message: 'Reason is fail',
					}),
				},
			),
	);

	await createFlow(
		{
			name: FLOWS.webhook,
			icon: 'link',
			trigger: 'webhook',
			options: { method: 'GET', async: false, cacheEnabled: true },
		},
		(f) =>
			op(
				f,
				'transform',
				'transform',
				[19, 1],
				{ json: { hook: true } },
				{ resolve: log(f, 'log', [37, 1], 'Webhook') },
			),
	);

	await createFlow(
		{
			name: FLOWS.schedule,
			icon: 'schedule',
			status: 'inactive',
			trigger: 'schedule',
			options: { cron: '0 0 * * * *' },
		},
		(f) => log(f, 'log', [19, 1], 'Schedule'),
	);

	await createFlow(
		{
			name: FLOWS.event,
			icon: 'anchor',
			accountability: null,
			trigger: 'event',
			options: { type: 'action', scope: ['items.create'], collections: ['bo_content'] },
		},
		(f) => log(f, 'log', [19, 1], 'Created'),
	);

	// A loner operation and one of a type no app registers (Edge Cases: unknown type).
	await createFlow(
		{ name: FLOWS.orphan, trigger: 'manual', options: { collections: ['bo_std'], location: 'item' } },
		null,
		[(f) => log(f, 'loner', [19, 1], 'Not linked'), (f) => op(f, 'unknown', 'bo-unknown', [37, 1], { anything: true })],
	);

	// Three runs for the Logs section: two resolve, one reject (throw-error).
	for (const reason of ['first', 'second', 'fail']) {
		await runFlow(all, { collection: 'bo_content', keys: ['1'], reason }).catch((error) => {
			if (reason !== 'fail') throw error;
		});
	}
}

async function createSettingsFixtures({ users }) {
	const role = await api.request('POST', '/roles', {
		name: SETTINGS.role,
		icon: 'tune',
		description: 'Settings fixture role',
		parent: users['bo-editor'].role,
	});
	const policy = await api.request('POST', '/policies', {
		name: SETTINGS.policy,
		icon: 'policy',
		description: 'Settings fixture policy',
		app_access: true,
		admin_access: false,
	});

	await api.request('POST', '/permissions', [
		{
			policy: policy.id,
			collection: 'bo_std',
			action: 'read',
			fields: ['*'],
			permissions: {},
			validation: null,
			presets: null,
		},
		{
			policy: policy.id,
			collection: 'bo_std',
			action: 'create',
			fields: ['input_string', 'select_dropdown'],
			permissions: null,
			validation: { _and: [{ input_string: { _nnull: true } }] },
			presets: { select_dropdown: 'a' },
		},
		{
			policy: policy.id,
			collection: 'bo_std',
			action: 'update',
			fields: ['input_string'],
			permissions: { _and: [{ input_string: { _nnull: true } }] },
			validation: null,
			presets: null,
		},
	]);
	await api.request('POST', '/access', { role: role.id, policy: policy.id });

	await api.request('POST', '/translations', [
		{ key: SETTINGS.translationKey, language: 'en-US', value: 'Hello' },
		{ key: SETTINGS.translationKey, language: 'vi-VN', value: 'Xin chào' },
	]);
}

/* ---------------------------------------------------------------- run */

await cleanup();

if (args.clean) {
	process.stdout.write(
		`Cleaned ${api.url}: bo_* collections, folders ${[FOLDER, ...Object.values(FILES_FOLDERS)].join(', ')}, flows ${[FLOW, ...CONTENT_FLOWS].join(', ')}, roles ${[...ROLES, SUB_ROLE, SETTINGS.role].join(', ')}\n`,
	);
	process.exit(0);
}

const folder = (await api.request('POST', '/folders', { name: FOLDER })).id;
const files = await uploadSamples(folder);

const flow = (
	await api.request('POST', '/flows', {
		name: FLOW,
		icon: 'bolt',
		color: PURPLE,
		description: 'Manual flow of the fixture set',
		status: 'active',
		trigger: 'manual',
		accountability: 'all',
		options: {
			collections: ['bo_groups'],
			location: 'item',
			requireConfirmation: true,
			confirmationDescription: 'Run the fixture flow?',
			fields: [
				{ field: 'note', type: 'string', name: 'Note', meta: { interface: 'input', width: 'full', required: true } },
			],
		},
	})
).id;

await api.request('POST', '/collections', stdCollection({ folder }));
await api.request('POST', '/collections', groupsCollection({ flow }));
for (const payload of relCollections({ folder })) await api.request('POST', '/collections', payload);
for (const payload of contentCollections()) await api.request('POST', '/collections', payload);

const refused = [];
let geometry = true;

for (const payload of geometryFields) {
	try {
		await api.request('POST', '/fields/bo_std', {
			...payload,
			meta: { ...payload.meta, sort: 1000 + geometryFields.indexOf(payload) },
		});
	} catch (error) {
		geometry = false;
		refused.push(`bo_std.${payload.field} (${payload.type}): ${error.message}`);
	}
}

if (!geometry) {
	// All or none, so the item payload stays one shape.
	for (const payload of geometryFields) await api.request('DELETE', `/fields/bo_std/${payload.field}`).catch(() => {});
}

if (geometry)
	await api.request('POST', '/fields/bo_content', { ...contentLocation, meta: { ...contentLocation.meta, sort: 100 } });

for (const relation of [...relations(), ...contentRelations()]) await api.request('POST', '/relations', relation);

const users = await createAccess(true);
await createItems({ files, users });
await createContentFixtures({ users, files, geometry });
await createFilesFixtures({ users });
await createSettingsFixtures({ users });
await createFlowsFixtures();
await createInsightsFixtures({ users });

process.stdout.write(
	`Seeded ${api.url}: folder ${FOLDER}, flow ${FLOW}, roles ${ROLES.join(', ')}, geometry ${geometry}\n`,
);
for (const line of refused) process.stdout.write(`Refused: ${line}\n`);
