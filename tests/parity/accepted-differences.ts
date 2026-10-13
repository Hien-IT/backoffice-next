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
		id: 'D-09.7',
		feature: '001',
		removeAt: '009',
		kind: 'http',
		endpoints: route('/flows', '/operations'),
		location: { any: true },
		reason: 'Built by feature 009.',
	},
	{
		id: 'D-09.8',
		feature: '001',
		removeAt: '010',
		kind: 'http',
		endpoints: route(
			'/settings',
			'/presets',
			'/notifications',
			'/shares',
			'/translations',
			'/dashboards',
			'/panels',
			'/extensions',
			'/utils',
		),
		location: { any: true },
		reason: 'Built by feature 010.',
	},
	{
		id: 'D-09.9',
		feature: '001',
		removeAt: '011',
		kind: 'http',
		endpoints: route('/graphql'),
		location: { any: true },
		reason: 'Built by feature 011.',
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
		id: 'D-14',
		feature: '001',
		removeAt: '010',
		kind: 'http',
		endpoints: ['* /server/setup'],
		location: { any: true },
		reason: 'Setup writes users and settings (004, 010).',
	},
	{
		id: 'D-15',
		feature: '001',
		removeAt: '011',
		kind: 'http',
		endpoints: ['* /server/specs/graphql', '* /server/specs/graphql/*'],
		location: { any: true },
		reason: 'GraphQL comes with feature 011.',
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
	{ id: 'D-18', feature: '001', kind: 'doc', reason: 'Additional startup and credential log lines.' },
	{ id: 'D-19', feature: '001', kind: 'doc', reason: 'One process per container, no bootstrap or PM2.' },
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
		removeAt: '010',
		kind: 'doc',
		// Feature 007 narrowed it: directus_files and directus_folders have their services (files/nested-files.test.ts);
		// feature 008: directus_comments, directus_notifications and directus_versions (utils/get-service.ts).
		reason: 'Nested writes into system collections without their own service go through ItemsService.',
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
		removeAt: '010',
		kind: 'doc',
		reason: 'No mention email: NotificationsService writes a warning line instead of the mail (Principle X).',
	},
];
