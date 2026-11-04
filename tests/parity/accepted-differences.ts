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
	{
		id: 'D-180',
		feature: '022',
		kind: 'doc',
		reason:
			'Backoffice migrations: bootstrap and init run them on every vendor under a shared lock, tracked in backoffice_migrations (never directus_migrations); the bootstrap dump leaves out their bo_* columns and directus_fields rows, the CLI log compare their lines (src/bootstrap/dump.ts, normalize.ts).',
	},
	{
		id: 'D-181',
		feature: '022',
		kind: 'doc',
		reason:
			'backoffice_migrations is a hidden system collection in Backoffice (403 on /items, not in GraphQL) and a table with meta null in Directus; /collections and /fields are compared without backoffice_* collections (normalizeBody in src/normalizers.ts).',
	},
	{
		id: 'D-184',
		feature: '023',
		kind: 'http',
		// Only the collections of src/items/json-path.test.ts, and only where Directus refused the request.
		endpoints: ['GET /items/parity_json_path_*', 'SEARCH /items/parity_json_path_*'],
		location: { any: true },
		when: { directusStatus: 403, directusCode: 'FORBIDDEN' },
		reason:
			'Filters on a path in a json field, json(field, path[, type]): Backoffice filters (Postgres json/jsonb, SQLite; 400 on other vendors), Directus answers 403 because its path check reads "field, path, type" as a field name (spec 023 T002). Also covers sort=json(...) (D-184.2).',
	},
	{
		id: 'D-184.1',
		feature: '023',
		kind: 'doc',
		reason:
			'A bookmark with a json path is saved in the shared directus_presets; the Directus app opening it gets 403.',
	},
	{
		id: 'D-184.2',
		feature: '023',
		kind: 'doc',
		reason:
			'sort=json(field, path[, type]) sorts at Backoffice (403 at Directus); fields=json(field, path, type) returns the typed value at Backoffice (null at Directus); compared per app in src/items/json-path.test.ts.',
	},
	{
		id: 'D-185',
		feature: '023',
		kind: 'http',
		endpoints: ['POST /permissions', 'PATCH /permissions', 'PATCH /permissions/*'],
		location: { any: true },
		when: { backofficeCode: 'INVALID_PAYLOAD' },
		reason:
			'A permission whose row filter or validation uses a json path is refused at Backoffice (400), saved at Directus.',
	},
	{
		id: 'D-186',
		feature: '023',
		kind: 'doc',
		reason:
			'GraphQL items scope: <collection>_filter has <f>_json: json_path_filter_operators for json fields at Backoffice only; introspection, SDL and server_specs_graphql are compared without that type and those input fields (withoutBackofficeIntrospection, withoutBackofficeSdl in src/normalizers.ts), with no ETag compare and types by name when one side has it (src/parity.ts).',
	},
	{
		id: 'D-187',
		feature: '023',
		kind: 'doc',
		reason:
			'The web filter of the Content page and the item drawer lists "JSON path" under json fields (path and type form, rule chip Field › path (Type)); the Directus app and the other Backoffice filters (Files, Users, permissions, flows, insights, validation) do not.',
	},
	{
		id: 'D-188',
		feature: '024',
		kind: 'http',
		// Only the collections of src/items/collection-toggles.test.ts, and only where Backoffice refused the request.
		// GraphQL, /users and the writes are checked per app in that file, so no broad endpoint is accepted here.
		endpoints: [
			'GET /items/parity_toggles_*',
			'SEARCH /items/parity_toggles_*',
			'PATCH /items/parity_toggles_*',
			'DELETE /items/parity_toggles_*',
		],
		location: { any: true },
		when: { backofficeCode: 'FORBIDDEN' },
		reason:
			'A search (search, a body query, deep._search, GraphQL search) on a collection whose bo_show_search is off: Backoffice answers the collection permission error for every caller, Directus searches (spec 024). Also covers ?export= with bo_show_export off (D-188.1).',
	},
	{
		id: 'D-188.1',
		feature: '024',
		kind: 'doc',
		reason:
			'With bo_show_export off, ?export= on /items and POST /utils/export are refused by Backoffice (no file), Directus exports.',
	},
	{
		id: 'D-188.2',
		feature: '024',
		kind: 'doc',
		reason:
			'With bo_show_import off, POST /utils/import is refused by Backoffice before reading the file, Directus imports.',
	},
	{
		id: 'D-188.3',
		feature: '024',
		kind: 'doc',
		reason:
			'The web item drawer and the Search Filter of list-o2m and list-m2m hide the keyword box of a collection whose bo_show_search is off; the Directus app always shows it.',
	},
	{
		id: 'D-188.4',
		feature: '024',
		kind: 'doc',
		reason:
			'While a collection has bo_show_search off, Backoffice does not read the response cache for a GraphQL document containing "search" (MISS, full Cache-Control TTL; the body is the same), so an entry Directus wrote never answers a blocked request.',
	},
	{
		id: 'D-189',
		feature: '025',
		kind: 'http',
		// Only the import and export keys of a collection in /permissions/me and permissions_me (analyze U4, CHK007).
		endpoints: ['GET /permissions/me', 'POST /graphql/system'],
		location: { jsonPointer: /^\/data\/(permissions_me\/)?[^/]+\/(import|export)$/ },
		directus: { absent: true },
		reason:
			'/permissions/me and permissions_me of Backoffice also carry the import and export actions of backoffice_permissions per collection (spec 025); Directus has the five actions only.',
	},
	{
		id: 'D-189.1',
		feature: '025',
		kind: 'http',
		// Only the collections of src/permissions/backoffice-permissions.test.ts and /users there, where Backoffice refused.
		endpoints: [
			'GET /items/parity_bo_perm_*',
			'SEARCH /items/parity_bo_perm_*',
			'GET /users',
			'SEARCH /users',
			'POST /utils/export/parity_bo_perm_*',
			'POST /utils/import/parity_bo_perm_*',
		],
		location: { any: true },
		when: { backofficeCode: 'FORBIDDEN' },
		reason:
			'An export (?export=, SEARCH body query, POST /utils/export) or import the policies of a non-admin caller do not allow: Backoffice answers the collection permission error, Directus exports or imports (spec 025).',
	},
	{
		id: 'D-189.2',
		feature: '025',
		kind: 'doc',
		reason:
			'The response cache of /permissions/me is shared as in Directus: with both apps on one Redis, either may answer with the body the other cached (accepted 2026-10-28).',
	},
	{
		id: 'D-189.3',
		feature: '025',
		kind: 'doc',
		reason:
			'The policy permission matrix of the web app has create, read, update, delete, import, export and no share column; four columns when the API is Directus.',
	},
	{
		id: 'D-189.4',
		feature: '025',
		kind: 'doc',
		reason: 'The web app has no Shares sidebar on the item page and no /shared/:id page; the /shares API is unchanged.',
	},
	{
		id: 'D-189.5',
		feature: '025',
		kind: 'doc',
		reason:
			'backoffice_permissions is a hidden system collection in Backoffice (403 on /items, not in GraphQL) and a table with meta null in Directus; compared without backoffice_* like D-181.',
	},
	{
		id: 'D-189.6',
		feature: '025',
		kind: 'doc',
		reason: '/backoffice/permissions exists at Backoffice only (Directus 404).',
	},
	{
		id: 'D-207',
		feature: '029',
		kind: 'doc',
		reason:
			'Passkey login and management under /backoffice/auth/passkey* and /backoffice/users/*/passkeys* exist at Backoffice only (Directus 404); tested per app in src/auth/passkey.test.ts.',
	},
	{
		id: 'D-207.1',
		feature: '029',
		kind: 'doc',
		reason:
			'backoffice_passkeys is a hidden system collection in Backoffice (403 on /items, not in GraphQL) and a table with meta null in Directus; compared without backoffice_* like D-181, D-189.5.',
	},
	{
		id: 'D-207.2',
		feature: '029',
		kind: 'doc',
		reason:
			'Deleting a user at Backoffice also deletes its backoffice_passkeys rows (no foreign key); the response is the same.',
	},
	{
		id: 'D-207.3',
		feature: '029',
		kind: 'doc',
		reason: 'A passkey login asks no OTP and its token has no enforce_tfa claim; password logins are unchanged.',
	},
	{
		id: 'D-207.4',
		feature: '029',
		kind: 'doc',
		reason:
			'The web app shows a passkey sign-in button and a Passkeys card on the user page when the API is Backoffice.',
	},
	{
		id: 'D-207.5',
		feature: '029',
		kind: 'doc',
		reason:
			'With the cookie of a session a passkey created (directus_sessions.bo_passkey true), GET /policies/me/globals and policies_me_globals answer enforce_tfa false at Backoffice, true at Directus; checked per app because `when` has no request predicate.',
	},
	{
		id: 'D-192',
		feature: '027',
		kind: 'doc',
		reason:
			'Generated special uuid values of user collections are UUID v7 at Backoffice, v4 at Directus; system collections keep v4; batch create responses follow the id order (spec 027).',
	},
	// Spec 028: `$FIELD(b)` on the six comparison operators compares two fields of the same collection at Backoffice;
	// Directus takes the value as a plain string (T002: 400 on a number field, 500 on timestamp/boolean/uuid). Only the
	// collections of src/items/field-compare.test.ts, and only where Directus failed; string fields (200 at both, other
	// rows) are compared per app in that file.
	{
		id: 'D-203',
		feature: '028',
		kind: 'http',
		endpoints: ['GET /items/parity_field_compare_*', 'SEARCH /items/parity_field_compare_*'],
		location: { any: true },
		when: { directusStatus: 400, directusCode: 'INVALID_QUERY' },
		reason:
			'A $FIELD(b) value compares two fields at Backoffice; Directus casts the string to the number field and answers 400 "Invalid numeric value" (spec 028 T002).',
	},
	{
		id: 'D-203',
		feature: '028',
		kind: 'http',
		endpoints: ['GET /items/parity_field_compare_*', 'SEARCH /items/parity_field_compare_*'],
		location: { any: true },
		when: { directusStatus: 500, directusCode: 'INTERNAL_SERVER_ERROR' },
		reason:
			'A $FIELD(b) value on a timestamp, boolean or uuid field: Directus binds the string and the database rejects the cast (500, spec 028 T002).',
	},
	{
		id: 'D-203.1',
		feature: '028',
		kind: 'doc',
		reason:
			'A bookmark with $FIELD(b) is saved in the shared directus_presets (200 at Directus too); the Directus app opening it sends the same filter and gets the D-203 answer.',
	},
	{
		id: 'D-204',
		feature: '028',
		kind: 'doc',
		reason:
			'A permission whose row filter or validation compares two fields with $FIELD(b) is refused at Backoffice (400 INVALID_PAYLOAD), saved at Directus; the D-185 http entry (same endpoints and code) accepts the response difference, /backoffice/permissions is Backoffice only (D-189.6).',
	},
	{
		id: 'D-205',
		feature: '028',
		kind: 'doc',
		reason:
			'GraphQL items scope: <collection>_filter has <f>_field: field_compare_operators (values field_ref { field }) for the columns of a type group at Backoffice only; introspection, SDL and server_specs_graphql are compared without those two types and input fields (withoutBackofficeIntrospection, withoutBackofficeSdl in src/normalizers.ts), with no ETag compare and types by name when one side has them (src/parity.ts).',
	},
	{
		id: 'D-206',
		feature: '028',
		kind: 'doc',
		reason:
			'The web filter of the Content page offers a field of the same type group as the value of the six comparison operators (picker and chip, stored as $FIELD(b)); the Directus app, the item drawer and the other Backoffice filters do not.',
	},
	// Spec 005 (D-209): a field hidden in the data model of a user collection is left out of a wildcard read at
	// Backoffice (`*`, `*.*`, no `fields`, export); Directus returns it. Only the collections of
	// src/items/hidden-fields.test.ts, whose hidden field is `secret`.
	{
		id: 'D-209',
		feature: '005',
		kind: 'http',
		endpoints: ['GET /items/parity_hidden_*', 'SEARCH /items/parity_hidden_*'],
		location: { jsonPointer: /\/secret$/ },
		directus: { any: true },
		backoffice: { absent: true },
		reason:
			'A wildcard leaves out the hidden fields of a user collection at Backoffice (the primary key stays); a field named in `fields` or an alias is returned at both (spec 005 D-209).',
	},
	{
		id: 'D-209',
		feature: '005',
		kind: 'http',
		endpoints: ['GET /items/parity_hidden_*', 'SEARCH /items/parity_hidden_*'],
		location: { header: 'etag' },
		reason: 'The body of a wildcard read differs (D-209), so does its ETag.',
	},
	// Spec 030 (D-210..D-210.4): composite and trigram indexes of user collections, backoffice_indexes.
	{
		id: 'D-210',
		feature: '030',
		kind: 'doc',
		reason:
			'GET/POST/DELETE /backoffice/collections/:collection/indexes exist at Backoffice only (Directus 404); POST answers 202 and an in-process job builds the index (creating → ready | failed).',
	},
	{
		id: 'D-210.1',
		feature: '030',
		kind: 'doc',
		reason:
			'GET /fields keeps is_unique and is_indexed false for the columns of a composite index at both apps (one-column introspection); composite indexes show only in the Indexes card and the D-210 endpoint.',
	},
	{
		id: 'D-210.2',
		feature: '030',
		kind: 'doc',
		reason:
			'backoffice_indexes is a hidden system collection at Backoffice and an unmanaged table at Directus; the backoffice_* normalizers leave it out of /collections, OAS and GraphQL.',
	},
	{
		id: 'D-210.3',
		feature: '030',
		kind: 'doc',
		reason:
			'Deleting a field or a collection at Backoffice drops the Backoffice indexes with that field first (MySQL and SQLite would keep them on the remaining columns) and removes their rows; Directus leaves the rows, which GET lists as missing.',
	},
	// A composite unique violation: Directus answers one RECORD_NOT_UNIQUE whose field is "a, b" (Postgres, SQLite) or a
	// guess from the index name (MySQL); Backoffice answers one error per field of the index. Only the collections of
	// src/schema/indexes.test.ts.
	{
		id: 'D-210.4',
		feature: '030',
		kind: 'http',
		endpoints: ['POST /items/parity_idx_*', 'PATCH /items/parity_idx_*'],
		location: { jsonPointer: /^\/errors(\/.*)?$/ },
		when: { directusStatus: 400 },
		reason:
			'A composite unique violation answers one RECORD_NOT_UNIQUE per field of the index at Backoffice; Directus answers a single error (spec 030 D-210.4).',
	},
	{
		id: 'D-210.4',
		feature: '030',
		kind: 'http',
		endpoints: ['POST /items/parity_idx_*', 'PATCH /items/parity_idx_*'],
		location: { header: 'etag' },
		when: { directusStatus: 400 },
		reason: 'The body of a composite unique violation differs (D-210.4), so does its ETag.',
	},
	// Spec 031 (D-212..D-212.3): install an extension from an uploaded npm-pack tarball, source `upload`.
	{
		id: 'D-212',
		feature: '031',
		kind: 'doc',
		reason:
			'GET/POST /backoffice/extensions/upload exist at Backoffice only (Directus 404): the size limit, and the install of an npm-pack tarball into .upload/<id> of EXTENSIONS_PATH with a directus_extensions row of source upload; tests/parity/src/extensions/upload.test.ts checks each app.',
	},
	{
		id: 'D-212.1',
		feature: '031',
		kind: 'doc',
		reason:
			'Directus on the same database keeps a row of source upload, lists it as Missing (schema null), never loads it and never scans the hidden .upload folder; measured by restarting Directus in src/extensions/upload-restart.test.ts (FR-023).',
	},
	// While an uploaded package is installed, its row has a schema at Backoffice and null at Directus, and the app bundle
	// of Backoffice holds its app part. upload.test.ts removes its packages before the file ends, so the other files compare
	// the same lists.
	{
		id: 'D-212.2',
		feature: '031',
		kind: 'http',
		endpoints: ['GET /extensions', 'GET /extensions/*', 'POST /graphql/system'],
		location: { jsonPointer: /^\/data(\/extensions)?\/\d+\/schema(\/.*)?$/ },
		reason:
			'An extension of source upload is loaded at Backoffice only: its schema at Backoffice, null at Directus (spec 031 D-212.2).',
	},
	{
		id: 'D-212.3',
		feature: '031',
		kind: 'doc',
		reason:
			'DELETE /extensions/registry/uninstall/:pk also uninstalls a row of source upload at Backoffice (files of .upload/<folder> and the rows); Directus answers 400 "not installed via marketplace"; checked per app in upload.test.ts.',
	},
];
