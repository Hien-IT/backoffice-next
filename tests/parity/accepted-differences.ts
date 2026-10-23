// Accepted differences from Directus 11.17.4 (FR-101). Every `id` must exist in the "Khác biệt so với
// Directus" table of specs/<feature>-*/spec.md; temporary entries carry the feature that removes them.

export type Matcher = string | number | boolean | null | RegExp | { absent: true } | { any: true };

export type AcceptedDifference = {
	id: string;
	/** Spec that introduced the entry, e.g. '001'; ids are unique within that spec only. */
	feature: string;
	/** Feature number that removes a temporary difference ("Gỡ khi" column). */
	removeAt?: string;
	/** 'doc': outside HTTP responses (logs, packages, migrations, startup); the comparer ignores it. */
	kind: 'http' | 'doc';
	/** 'METHOD /path', '* /path' (any method), '*' in a path for any characters, or '*' for every endpoint. */
	endpoints?: string[];
	/** Endpoints left out of `endpoints`, same syntax. */
	excludeEndpoints?: string[];
	/** `any`: every difference of the matching responses (use with `when`); a RegExp pointer matches many paths. */
	location?: { status: true } | { header: string } | { jsonPointer: string | RegExp } | { any: true };
	/** Only for responses where Directus (or Backoffice) answered this status / error code (e.g. D-10: 401 on an invalid token). */
	when?: { directusStatus?: number; directusCode?: string; backofficeCode?: string };
	directus?: Matcher;
	backoffice?: Matcher;
	reason: string;
};

const route = (...paths: string[]) => paths.flatMap((p) => [`* ${p}`, `* ${p}/*`]);

const TFA_GENERATE = ['* /users/me/tfa/generate', '* /users/me/tfa/generate/'];

export const acceptedDifferences: AcceptedDifference[] = [
	{
		id: 'D-01',
		feature: '001',
		kind: 'http',
		endpoints: ['*'],
		location: { header: 'x-powered-by' },
		directus: 'Directus',
		backoffice: 'Backoffice',
		reason: 'Rebranding (Principle IX).',
	},
	{
		id: 'D-02',
		feature: '001',
		kind: 'http',
		endpoints: ['GET /server/specs/oas'],
		// Feature 004: logged-in users see the schemas of system collections, whose field descriptions are rebranded too.
		location: { jsonPointer: /^\/(servers\/\d+|tags\/\d+|paths\/.+|components\/schemas\/.+)\/description$/ },
		directus: /Directus/,
		backoffice: /Backoffice/,
		reason: 'Rebranding of the OpenAPI descriptions (Principle IX).',
	},
	{ id: 'D-03', feature: '001', kind: 'doc', reason: 'Log messages about the app say Backoffice (Principle IX).' },
	{ id: 'D-04', feature: '001', kind: 'doc', reason: 'Internal packages are @backoffice/* (Principle IX).' },
	{ id: 'D-05', feature: '001', kind: 'doc', reason: 'Migration mismatch stops the API (Principle II).' },
	{
		id: 'D-06',
		feature: '001',
		kind: 'doc',
		reason: 'Missing and unknown migrations are checked, custom ones accepted (Principle II).',
	},
	{
		id: 'D-07',
		feature: '001',
		kind: 'http',
		endpoints: ['GET /server/health'],
		location: { jsonPointer: '/checks/email:connection' },
		reason: 'No mail transport (Principle X); visible to admins only, from feature 003/004.',
	},
	{
		id: 'D-08',
		feature: '001',
		kind: 'http',
		endpoints: route('/admin'),
		location: { any: true },
		reason: 'The web app runs in its own container (Principle VII).',
	},
	{
		id: 'D-13',
		feature: '001',
		kind: 'http',
		endpoints: ['GET /server/health'],
		location: { any: true },
		when: { directusStatus: 500 },
		reason:
			'Health does not build the schema; differs only with the database down and no schema in memory (CACHE_SCHEMA=false or an empty cache). Other routes build it like Directus since feature 002.',
	},
	{
		id: 'D-16',
		feature: '001',
		kind: 'doc',
		reason: 'Storage drivers other than local and s3 stop the API (Principle XI).',
	},
	{
		id: 'D-17',
		feature: '001',
		kind: 'http',
		endpoints: route('/mcp', '/ai', '/deployments', '/websocket'),
		location: { any: true },
		reason: 'WebSocket, extensions, AI/MCP and deployments are out of scope (Principle XI).',
	},
	{
		id: 'D-17',
		feature: '001',
		kind: 'http',
		endpoints: ['GET /server/info', 'SEARCH /server/info'],
		location: { jsonPointer: /^\/data\/(mcp_enabled|ai_enabled|websocket)(\/.*)?$/ },
		reason: 'mcp_enabled, ai_enabled and websocket are always false: no AI, MCP or WebSocket (Principle XI).',
	},
	{
		id: 'D-17',
		feature: '001',
		kind: 'http',
		endpoints: ['GET /server/info', 'SEARCH /server/info', 'HEAD /server/info'],
		location: { header: 'etag' },
		// The body check above still compares every other key of a GET /server/info.
		reason: 'The ETag of the logged-in /server/info, whose three flags read false.',
	},
	{ id: 'D-18', feature: '001', kind: 'doc', reason: 'Additional startup and credential log lines.' },
	{
		id: 'D-19',
		feature: '001',
		kind: 'doc',
		reason: 'One Node process per container under tini, no PM2 (spec 021: the image runs bootstrap, then start).',
	},
	{
		id: 'D-21',
		feature: '001',
		kind: 'doc',
		reason:
			'proxy-addr 2.0.8 (security patch): IPv4-mapped IPv6 addresses behind a trusted proxy; no parity request uses one.',
	},
	// Feature 003
	{ id: 'D-23', feature: '003', kind: 'doc', reason: 'No password reset email: a log line without token or link.' },
	{
		id: 'D-24',
		feature: '003',
		kind: 'http',
		endpoints: ['GET /auth', 'GET /auth/', 'HEAD /auth'],
		location: { jsonPointer: /^\/data(\/|$)/ },
		reason: 'saml providers are not listed (Principle XI); providers.test.ts checks the rest of the list.',
	},
	{
		id: 'D-24',
		feature: '003',
		kind: 'http',
		endpoints: ['GET /auth', 'GET /auth/', 'HEAD /auth'],
		location: { header: 'etag' },
		reason: 'The ETag of the shorter provider list.',
	},
	{
		id: 'D-24',
		feature: '003',
		kind: 'http',
		endpoints: route('/auth/login/saml'),
		location: { any: true },
		reason: 'No saml routes (Principle XI).',
	},
	{
		id: 'D-24',
		feature: '003',
		kind: 'http',
		endpoints: ['POST /auth/refresh', 'POST /auth/logout'],
		when: { backofficeCode: 'INVALID_PROVIDER_CONFIG' },
		location: { any: true },
		reason: 'Sessions of saml users: INVALID_PROVIDER_CONFIG like Directus without the provider (FR-078).',
	},
	{
		id: 'D-25',
		feature: '003',
		kind: 'http',
		endpoints: TFA_GENERATE,
		location: { jsonPointer: '/data/otpauth_url' },
		directus: /issuer=Directus$/,
		backoffice: /issuer=Backoffice$/,
		reason: 'TFA issuer label when project_name is empty (Principle IX).',
	},
	// Feature 004
	{ id: 'D-27', feature: '004', kind: 'doc', reason: 'No invitation email: a warn log line naming the recipient.' },
	{ id: 'D-28', feature: '004', kind: 'doc', reason: 'No verification email after registration: a warn log line.' },
	{
		id: 'D-31',
		feature: '004',
		kind: 'doc',
		// Narrowed by features 007 to 010 (files, folders, comments, notifications, versions, flows, operations, shares,
		// translations, dashboards, panels, settings have their services: utils/get-service.ts). Permanent since 010
		// (approved 2026-10-14): only the three deployment collections remain, deployment is out of scope (D-17).
		reason: 'Nested writes into the deployment collections go through ItemsService (no deployment service, D-17).',
	},
	{
		id: 'D-32',
		feature: '006',
		// The parity tests never send this request to Directus: it drops the system table of the shared database
		// (measured on 11.17.4, spec 006 T010). schema-management/crud.test.ts checks the 403 of the new app alone.
		kind: 'doc',
		reason: 'DELETE /collections/<system collection> answers 403 instead of dropping the table (Principle II).',
	},
	{
		id: 'D-33',
		feature: '008',
		kind: 'doc',
		// Permanent since feature 009 (Clarifications 2026-10-13, approved 2026-10-14): no email is sent, like D-34.
		reason: 'No mention email: NotificationsService writes a warning line instead of the mail (Principle X).',
	},
	// Feature 009
	{
		id: 'D-34',
		feature: '009',
		kind: 'doc',
		reason: 'No flow mail: the mail operation writes a warning line after the rate limiter (Principle X).',
	},
	{
		id: 'D-35',
		feature: '009',
		kind: 'doc',
		reason: 'No extensions.* or email.send events: no extension manager and no mail service (Principle XI).',
	},
	// Feature 010
	{
		id: 'D-36',
		feature: '010',
		kind: 'doc',
		reason: 'No share invitation email: SharesService.invite writes a warning line per address (Principle X).',
	},
	{
		id: 'D-38',
		feature: '010',
		kind: 'doc',
		reason: 'No project owner report to COMPLIANCE_URL: a warning line, project_status null as after a sent report.',
	},
	{
		id: 'D-174',
		feature: '019',
		kind: 'http',
		endpoints: ['* /extensions', '* /extensions/*', '* /graphql/system'],
		excludeEndpoints: ['* /extensions/sources/*'],
		location: { jsonPointer: /\/schema\/path$/ },
		// The matchers are checked one by one: each pins the whole shape, the extension folder name being free.
		directus: /^\/directus\/node_modules\/\.directus\/extensions\/[^/]+$/,
		backoffice: /^\/backoffice\/node_modules\/\.directus\/extensions\/[^/]+$/,
		reason:
			'The API image works in /backoffice (D-174): the synced extension folder is under its own working directory, the rest of the path is the same.',
	},
	{
		id: 'D-174',
		feature: '019',
		kind: 'http',
		endpoints: ['GET /extensions', 'GET /extensions/*'],
		excludeEndpoints: ['* /extensions/sources/*'],
		location: { header: 'etag' },
		reason: 'The weak ETag of an /extensions body that differs only by the schema.path prefix of D-174.',
	},
	{
		id: 'D-137',
		feature: '020',
		kind: 'http',
		endpoints: ['GET /extensions/sources/*', 'HEAD /extensions/sources/*'],
		location: { any: true },
		when: { directusStatus: 200 },
		reason:
			'The app chunks keep the shared dependencies as bare specifiers for the import map of the new web app; Directus imports /admin/assets/<dep>.<hash>.entry.js (other bytes, ETag and chunk names).',
	},
	{
		id: 'D-138',
		feature: '020',
		kind: 'doc',
		reason: 'Embed hooks are registered but the new web app does not inject them.',
	},
	{
		id: 'D-141',
		feature: '020',
		kind: 'doc',
		reason:
			'No `directus` package or mail transport for extensions; the deployment and WebSocket services do not exist (the CLI and its cli.before/cli.after events came with spec 021).',
	},
	{
		id: 'D-142',
		feature: '020',
		kind: 'doc',
		reason:
			'App shell stacking (sidebar, header and overlays at z-99999), --header-bar-height outside the scroller, Reka modal dialogs disable pointer events on body; minor visual leftovers of the CSS audit.',
	},
	{
		id: 'D-143',
		feature: '020',
		kind: 'doc',
		reason: 'The Roles and Policies lists have no sticky table header.',
	},
	{
		id: 'D-144',
		feature: '020',
		kind: 'doc',
		reason: 'App extension modules are grouped under one Extensions row of the sidebar (module_bar order and state).',
	},
	// Spec 021
	{
		id: 'D-145',
		feature: '021',
		kind: 'doc',
		reason:
			'bootstrap, database install and database migrate:* run on Postgres and SQLite only; the other vendors are installed and migrated by the Directus 11.17.4 image.',
	},
	{
		id: 'D-146',
		feature: '021',
		kind: 'doc',
		reason: 'init lists PostgreSQL / Redshift and SQLite only and runs no npm install (the drivers are in the image).',
	},
	{
		id: 'D-147',
		feature: '021',
		kind: 'doc',
		reason:
			'CLI branding: program `backoffice`, its version, Backoffice in new log lines, the .env template and the init and schema apply messages.',
	},
	{
		id: 'D-149',
		feature: '021',
		kind: 'doc',
		reason:
			'No update check before each CLI command (the cli.js of the Directus image asks the npm registry and prints an "Update available!" box).',
	},
	{
		id: 'D-164',
		feature: '021',
		kind: 'doc',
		reason:
			'A new project is named Backoffice: bootstrap writes PROJECT_NAME or "Backoffice", init sets "Backoffice" (Directus keeps its column default "Directus").',
	},
];
