// Backoffice (spec 033, English docs amendment 2026-11-18): the English counterpart of variables.ts, the hand-written half
// of the Configuration part. Same groups, tables and rows in the same order; only the text is English. variables.test.ts
// checks that both files have the same rows. The other system on the same database is never named (FR-047): write "the
// system that shares the database".
import type { ConfigRow, ConfigTable } from '../types.ts';

const SHARED = 'Must match the system that shares the database, if any.';

/** A variable with a plain name. */
const v = (name: string, description: string, note?: string): ConfigRow => ({
	name,
	pattern: name,
	description,
	...(note ? { note } : {}),
});

/** A family of variables: `name` is what the reader types, `pattern` the entry of the generated file. */
const p = (name: string, pattern: string, description: string, note?: string): ConfigRow => ({
	name,
	pattern,
	description,
	...(note ? { note } : {}),
});

export const configTablesEn: Record<string, ConfigTable[]> = {
	general: [
		{
			title: 'General',
			rows: [
				v('CONFIG_PATH', 'Path to the configuration file (`.env`, `.json`, `.yaml` or `.js`). Path string.'),
				v('HOST', 'IP address or host name the API listens on.'),
				v('PORT', 'Port the API listens on. Integer.'),
				v(
					'PUBLIC_URL',
					'URL users reach the API at. Used for SSO sign-in redirects, cookies and passkeys. URL or path.',
					'Passkeys are on only when the value is an absolute URL with a domain name (not an IP address).',
				),
				v('ROOT_REDIRECT', 'Where the root path `/` redirects to. Relative path, URL, or `false` for no redirect.'),
				v('OPENAPI_ENABLED', 'Serves the OpenAPI description at `/server/specs/oas`. Boolean.'),
				v('ROBOTS_TXT', 'Content served at `/robots.txt`. Multi-line string. When unset, `/robots.txt` answers 404.'),
				v('TEMP_PATH', 'Folder for the API temporary files, such as files being uploaded. Path string.'),
				v('MAX_PAYLOAD_SIZE', 'Maximum size of a request body. Size string such as `1mb`, `512kb`.'),
				v('QUERYSTRING_MAX_PARSE_DEPTH', 'Maximum depth when parsing nested query parameters. Integer.'),
				v('QUERYSTRING_ARRAY_LIMIT', 'Maximum number of elements in one query string array. Integer.'),
				v(
					'PACKAGE_FILE_LOCATION',
					'Folder of the `package.json` the API reads to find extensions installed as npm packages. Path string.',
				),
			],
		},
		{
			title: 'HTTP Server',
			rows: [
				p(
					'SERVER_*',
					'SERVER_.+',
					'Options of the HTTP server. Common ones: `SERVER_KEEP_ALIVE_TIMEOUT` and `SERVER_HEADERS_TIMEOUT` (milliseconds), `SERVER_SHUTDOWN_TIMEOUT` (milliseconds to wait for running requests on shutdown).',
					'Set `SERVER_KEEP_ALIVE_TIMEOUT` higher than the timeout of the load balancer in front.',
				),
			],
		},
		{
			title: 'First Admin Account',
			note: 'Read only when the database is initialized (the `bootstrap` command) or on the first setup call. Without `ADMIN_EMAIL` or `ADMIN_PASSWORD` no admin user is created.',
			rows: [
				v('ADMIN_EMAIL', 'Email of the admin user created on initialization. Email address.'),
				v('ADMIN_PASSWORD', 'Password of that admin user. String.'),
				v('ADMIN_TOKEN', 'Static token given to that admin user. String.'),
				v(
					'PROJECT_OWNER',
					'Email of the project owner, written to the project settings when the migrations first run. Email address.',
				),
				v('ACCEPT_TERMS', 'Records acceptance of the terms of use when the database is initialized. Boolean.'),
			],
		},
	],

	database: [
		{
			title: 'Connection',
			rows: [
				p(
					'DB_*',
					'DB_.+',
					'Database connection. `DB_CLIENT` picks the kind (`pg`, `mysql`, `sqlite3`, `mssql`, `oracledb`, `cockroachdb`); `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` for a server; `DB_FILENAME` for SQLite; `DB_CONNECTION_STRING` instead of the separate variables; `DB_POOL__MIN`, `DB_POOL__MAX` for the connection pool; `DB_SSL__*` for TLS. Other `DB_*` variables go straight to the driver.',
					'Next to the system that shares the database, these variables must point to the same database. The `bootstrap`, `install` and `migrate` commands run only on PostgreSQL and SQLite.',
				),
			],
		},
		{
			title: 'Migrations',
			rows: [v('MIGRATIONS_PATH', 'Folder of the project custom migrations. Path string.')],
		},
	],

	'redis-cache': [
		{
			title: 'Redis',
			note: 'Running several instances requires Redis: the message bus, distributed locks, caches and shared counters all live there.',
			rows: [
				v(
					'REDIS',
					'Redis connection string in the form `redis://user:password@host:port/db`. Replaces the separate `REDIS_*` variables.',
				),
				v('REDIS_ENABLED', 'Uses Redis. Boolean; when empty, on as soon as `REDIS` or `REDIS_HOST` is set.'),
				v('REDIS_HOST', 'Host name or IP address of Redis.'),
				v('REDIS_PORT', 'Port of Redis. Integer.'),
				v('REDIS_USERNAME', 'Redis user name. String.'),
				v('REDIS_PASSWORD', 'Redis password. String.'),
				v('REDIS_DB', 'Redis database number. Integer.'),
				v(
					'REDIS_BUS_NAMESPACE',
					'Namespace of the message channel between instances. String; `directus:bus` when empty.',
					SHARED,
				),
				v('REDIS_LOCK_NAMESPACE', 'Namespace of the distributed locks. String; the API default when empty.', SHARED),
				v(
					'REDIS_PERMISSIONS_NAMESPACE',
					'Namespace of the permissions cache. String; `permissions` when empty.',
					SHARED,
				),
			],
		},
		{
			title: 'Response Cache',
			rows: [
				v('CACHE_ENABLED', 'Caches the responses of read requests. Boolean.'),
				v('CACHE_TTL', 'How long a response stays in the cache. Duration string such as `5m`, `1h`.'),
				v('CACHE_NAMESPACE', 'Key prefix of the cache. String.', SHARED),
				v('CACHE_STORE', 'Where the cache lives: `memory` or `redis`. Use `redis` with several instances.'),
				v('CACHE_AUTO_PURGE', 'Clears the response cache on every write. Boolean.'),
				v(
					'CACHE_AUTO_PURGE_IGNORE_LIST',
					'Collections whose writes do not clear the cache. Comma-separated list of names.',
				),
				v(
					'CACHE_STATUS_HEADER',
					'Name of the header telling whether the response came from the cache (`HIT`) or not (`MISS`). String; not sent when empty.',
				),
				v(
					'CACHE_VALUE_MAX_SIZE',
					'Maximum size of a response put in the cache. Size string such as `10mb`, or `false` for no limit.',
				),
				v('CACHE_SKIP_ALLOWED', 'Lets clients bypass the cache with the `Cache-Control: no-store` header. Boolean.'),
				v('CACHE_CONTROL_S_MAXAGE', 'The `s-maxage` value in the `Cache-Control` header of responses. Seconds.'),
				v(
					'CACHE_HEALTHCHECK_THRESHOLD',
					'Threshold above which the health check reports the cache as slow. Milliseconds; 150 when empty.',
				),
			],
		},
		{
			title: 'Schema and System Cache',
			rows: [
				v('CACHE_SCHEMA', 'Keeps the database schema in memory instead of reading it again on each request. Boolean.'),
				v(
					'CACHE_SCHEMA_MAX_ITERATIONS',
					'Maximum number of tries while waiting for another instance to build the schema. Integer.',
				),
				v('CACHE_SCHEMA_SYNC_TIMEOUT', 'Maximum time to wait for that. Milliseconds.'),
				v(
					'CACHE_SCHEMA_FREEZE_ENABLED',
					'Freezes the in-memory schema object instead of copying it for each request. Boolean.',
					'Faster, but extensions that change the schema object directly will fail.',
				),
				v(
					'CACHE_SYSTEM_TTL',
					'How long the system cache (schema, permissions) lives. Duration string; never expires when empty.',
				),
				v('CACHE_DEPLOYMENT_TTL', 'How long the deployment data cache lives. Duration string; 5 seconds when empty.'),
			],
		},
		{
			title: 'Sync Between Instances',
			rows: [
				v('SYNCHRONIZATION_STORE', 'Where sync data lives: `memory` or `redis`. Use `redis` with several instances.'),
				v('SYNCHRONIZATION_NAMESPACE', 'Key prefix of the sync data. String.', SHARED),
			],
		},
	],

	security: [
		{
			title: 'Keys and Headers',
			rows: [
				v(
					'SECRET',
					'Secret used to sign tokens. Long random string.',
					`Must be the same on every instance. ${SHARED} When unset, each start gets a new value and every session becomes invalid.`,
				),
				v(
					'IP_TRUST_PROXY',
					'Trusts the reverse proxy headers when finding the client IP address. Boolean, or an Express `trust proxy` value.',
				),
				v('IP_CUSTOM_HEADER', 'Name of the header holding the client IP address. String, or `false` to not use one.'),
				p(
					'CONTENT_SECURITY_POLICY_*',
					'CONTENT_SECURITY_POLICY_.+',
					'Customizes the `Content-Security-Policy` header, for example `CONTENT_SECURITY_POLICY_DIRECTIVES__FRAME_ANCESTORS`.',
				),
				v('CROSS_ORIGIN_OPENER_POLICY_ENABLED', 'Sends the `Cross-Origin-Opener-Policy` header. Boolean.'),
				v('CROSS_ORIGIN_OPENER_POLICY', 'Value of that header. String.'),
				p(
					'HSTS_*',
					'HSTS_.+',
					'The `Strict-Transport-Security` header: `HSTS_ENABLED` turns it on, the other `HSTS_*` variables are header options.',
				),
				p(
					'HASH_*',
					'HASH_.+',
					'Options of the argon2 password hashing: `HASH_MEMORY_COST`, `HASH_LENGTH`, `HASH_TIME_COST`, `HASH_PARALLELISM`, `HASH_TYPE`, `HASH_ASSOCIATED_DATA`.',
					SHARED,
				),
			],
		},
		{
			title: 'CORS',
			rows: [
				v('CORS_ENABLED', 'Sends CORS headers. Needed when the web app and the API are on different origins. Boolean.'),
				v(
					'CORS_ORIGIN',
					'Allowed origins. `true` (taken from the request `Origin` header), `false`, or a comma-separated list of origins.',
				),
				v('CORS_METHODS', 'Allowed methods. Comma-separated list.'),
				v('CORS_ALLOWED_HEADERS', 'Allowed request headers. Comma-separated list.'),
				v('CORS_EXPOSED_HEADERS', 'Response headers the browser may read. Comma-separated list.'),
				v('CORS_CREDENTIALS', 'Allows cookies in cross-origin requests. Boolean.'),
				v('CORS_MAX_AGE', 'How long the browser may remember a preflight result. Seconds.'),
			],
		},
		{
			title: 'Rate and Load Limits',
			rows: [
				p(
					'RATE_LIMITER_*',
					'RATE_LIMITER_(?!EMAIL_).+',
					'Limits requests per IP address: `RATE_LIMITER_ENABLED`, `RATE_LIMITER_POINTS` (requests), `RATE_LIMITER_DURATION` (seconds), `RATE_LIMITER_STORE` (`memory` or `redis`). `RATE_LIMITER_GLOBAL_*` limits the total number of requests; `RATE_LIMITER_REGISTRATION_*` limits registrations.',
					'Use `redis` with several instances so the counters are shared.',
				),
				v('PRESSURE_LIMITER_ENABLED', 'Rejects requests with status 503 when the server is overloaded. Boolean.'),
				v('PRESSURE_LIMITER_SAMPLE_INTERVAL', 'Time between two load measurements. Milliseconds.'),
				v('PRESSURE_LIMITER_MAX_EVENT_LOOP_UTILIZATION', 'Maximum event loop utilization. Number from 0 to 1.'),
				v('PRESSURE_LIMITER_MAX_EVENT_LOOP_DELAY', 'Maximum event loop delay. Milliseconds.'),
				v('PRESSURE_LIMITER_MAX_MEMORY_RSS', 'Maximum RSS memory. Bytes, or `false` to not check.'),
				v('PRESSURE_LIMITER_MAX_MEMORY_HEAP_USED', 'Maximum used heap memory. Bytes, or `false` to not check.'),
				v(
					'PRESSURE_LIMITER_RETRY_AFTER',
					'Value of the `Retry-After` header sent with status 503. Seconds, or `false` to not send it.',
				),
			],
		},
		{
			title: 'Query and User Limits',
			rows: [
				v('MAX_BATCH_MUTATION', 'Maximum number of items in one batch create, update or delete. Integer.'),
				v('MAX_RELATIONAL_DEPTH', 'Maximum relational depth of a query. Integer.'),
				v('QUERY_LIMIT_DEFAULT', 'Number of items returned when a request gives no `limit`. Integer.'),
				v('QUERY_LIMIT_MAX', 'Highest allowed `limit` value. Integer; no limit when empty.'),
				v('RELATIONAL_BATCH_SIZE', 'Rows per batch when reading relational data. Integer.'),
				v('MAX_JSON_QUERY_DEPTH', 'Maximum path depth in the `json()` query function. Integer.'),
				v('USERS_ADMIN_ACCESS_LIMIT', 'Maximum number of active users with admin access. Integer.'),
				v('USERS_APP_ACCESS_LIMIT', 'Maximum number of active users with app access (not admin). Integer.'),
				v('USERS_API_ACCESS_LIMIT', 'Maximum number of active users with API access only. Integer.'),
			],
		},
	],

	auth: [
		{
			title: 'Tokens and Cookies',
			rows: [
				v('ACCESS_TOKEN_TTL', 'Lifetime of an access token. Duration string such as `15m`.'),
				v('REFRESH_TOKEN_TTL', 'Lifetime of a refresh token. Duration string such as `7d`.'),
				v('REFRESH_TOKEN_COOKIE_NAME', 'Name of the cookie holding the refresh token. String.', SHARED),
				v('REFRESH_TOKEN_COOKIE_DOMAIN', 'Domain of that cookie. String; the API domain when empty.'),
				v('REFRESH_TOKEN_COOKIE_SECURE', 'Sends that cookie over HTTPS only. Boolean.'),
				v('REFRESH_TOKEN_COOKIE_SAME_SITE', 'The `SameSite` attribute of that cookie: `lax`, `strict` or `none`.'),
				v('SESSION_COOKIE_NAME', 'Name of the web app session cookie. String.', SHARED),
				v('SESSION_COOKIE_TTL', 'Lifetime of a session. Duration string such as `1d`.'),
				v('SESSION_COOKIE_DOMAIN', 'Domain of the session cookie. String; the API domain when empty.'),
				v('SESSION_COOKIE_SECURE', 'Sends the session cookie over HTTPS only. Boolean.'),
				v(
					'SESSION_COOKIE_SAME_SITE',
					'The `SameSite` attribute of the session cookie: `lax`, `strict` or `none`.',
					'When the web app and the API are on different sites, use `none` with `SESSION_COOKIE_SECURE` on.',
				),
				v(
					'SESSION_REFRESH_GRACE_PERIOD',
					'How long the old session stays valid after a refresh, so requests sent at the same time are not rejected. Duration string such as `10s`.',
				),
				v('LOGIN_STALL_TIME', 'Minimum duration of a sign-in, so response times reveal nothing. Milliseconds.'),
				v('REGISTER_STALL_TIME', 'Minimum duration of a registration. Milliseconds.'),
			],
		},
		{
			title: 'Invite, Password Reset and Registration Links',
			note: 'Backoffice sends no email: links are written to the log so an administrator can pass them to the user.',
			rows: [
				v('PASSWORD_RESET_URL_ALLOW_LIST', 'URLs allowed as the password reset page. Comma-separated list of URLs.'),
				v('USER_INVITE_TOKEN_TTL', 'Lifetime of an invite link. Duration string such as `7d`.'),
				v('USER_INVITE_URL_ALLOW_LIST', 'URLs allowed as the invite acceptance page. Comma-separated list of URLs.'),
				v(
					'USER_REGISTER_URL_ALLOW_LIST',
					'URLs allowed as the registration confirmation page. Comma-separated list of URLs.',
				),
				v('EMAIL_VERIFICATION_TOKEN_TTL', 'Lifetime of an email verification link. Duration string such as `7d`.'),
			],
		},
		{
			title: 'Sign-in Providers',
			note: 'In variable names, `<PROVIDER>` is the provider name in upper case, taken from `AUTH_PROVIDERS`.',
			rows: [
				v(
					'AUTH_PROVIDERS',
					'Names of the external sign-in providers. Comma-separated list, for example `google,ldap`.',
				),
				v('AUTH_DISABLE_DEFAULT', 'Turns off sign-in with email and password. Boolean.'),
				v(
					'AUTH_ALLOWED_PUBLIC_URLS',
					'Other public URLs of the API allowed as return addresses for SSO sign-in, besides `PUBLIC_URL`. Comma-separated list of URLs.',
				),
				p('AUTH_<PROVIDER>_DRIVER', 'AUTH_.+_DRIVER', 'Kind of provider: `oauth2`, `openid` or `ldap`.'),
				p('AUTH_<PROVIDER>_LABEL', 'AUTH_.+_LABEL', 'Name shown on the sign-in button. String.'),
				p('AUTH_<PROVIDER>_ICON', 'AUTH_.+_ICON', 'Icon shown on the sign-in button. Icon name.'),
				p(
					'AUTH_<PROVIDER>_ALLOW_PUBLIC_REGISTRATION',
					'AUTH_.+_ALLOW_PUBLIC_REGISTRATION',
					'Creates a user when someone signs in through this provider for the first time. Boolean.',
				),
				p('AUTH_<PROVIDER>_DEFAULT_ROLE_ID', 'AUTH_.+_DEFAULT_ROLE_ID', 'Role given to created users. Role ID.'),
				p(
					'AUTH_<PROVIDER>_SYNC_USER_INFO',
					'AUTH_.+_SYNC_USER_INFO',
					'Updates the user name and email from the provider on each sign-in. Boolean.',
				),
				p(
					'AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST',
					'AUTH_.+_REDIRECT_ALLOW_LIST',
					'URLs allowed as redirect targets after sign-in. Comma-separated list of URLs.',
				),
				p(
					'AUTH_<PROVIDER>_COOKIE_SECURE',
					'AUTH_.+_COOKIE_SECURE',
					'Sends the temporary cookie of the SSO sign-in flow over HTTPS only. Boolean.',
				),
			],
		},
		{
			title: 'OAuth 2.0 and OpenID Connect',
			rows: [
				p('AUTH_<PROVIDER>_CLIENT_ID', 'AUTH_.+_CLIENT_ID', 'Client ID issued by the provider. String.'),
				p('AUTH_<PROVIDER>_CLIENT_SECRET', 'AUTH_.+_CLIENT_SECRET', 'Client secret issued by the provider. String.'),
				p('AUTH_<PROVIDER>_SCOPE', 'AUTH_.+_SCOPE', 'Scopes requested on sign-in. Space-separated list.'),
				p(
					'AUTH_<PROVIDER>_AUTHORIZE_URL',
					'AUTH_.+_AUTHORIZE_URL',
					'URL of the provider authorization page (OAuth 2.0). URL.',
				),
				p(
					'AUTH_<PROVIDER>_ACCESS_URL',
					'AUTH_.+_ACCESS_URL',
					'URL that exchanges the code for a token (OAuth 2.0). URL.',
				),
				p('AUTH_<PROVIDER>_PROFILE_URL', 'AUTH_.+_PROFILE_URL', 'URL that returns the user profile (OAuth 2.0). URL.'),
				p(
					'AUTH_<PROVIDER>_ISSUER_URL',
					'AUTH_.+_ISSUER_URL',
					'URL of the provider discovery document (OpenID Connect). URL.',
				),
				p(
					'AUTH_<PROVIDER>_ISSUER_DISCOVERY_MUST_SUCCEED',
					'AUTH_.+_ISSUER_DISCOVERY_MUST_SUCCEED',
					'The API does not start when the discovery document cannot be read. Boolean.',
				),
				p(
					'AUTH_<PROVIDER>_IDENTIFIER_KEY',
					'AUTH_.+_IDENTIFIER_KEY',
					'Profile field used as the unique user identifier. Field name.',
				),
				p('AUTH_<PROVIDER>_EMAIL_KEY', 'AUTH_.+_EMAIL_KEY', 'Profile field holding the email. Field name.'),
				p(
					'AUTH_<PROVIDER>_FIRST_NAME_KEY',
					'AUTH_.+_FIRST_NAME_KEY',
					'Profile field holding the first name. Field name.',
				),
				p('AUTH_<PROVIDER>_LAST_NAME_KEY', 'AUTH_.+_LAST_NAME_KEY', 'Profile field holding the last name. Field name.'),
				p('AUTH_<PROVIDER>_PARAMS', 'AUTH_.+_PARAMS', 'Extra parameters added to the authorization URL. JSON object.'),
				p(
					'AUTH_<PROVIDER>_REQUIRE_VERIFIED_EMAIL',
					'AUTH_.+_AUTH_REQUIRE_VERIFIED_EMAIL',
					'Accepts only users whose email the provider reports as verified (OpenID Connect). Boolean.',
				),
				p(
					'AUTH_<PROVIDER>_CLIENT_HTTP_*',
					'AUTH_.+_CLIENT_HTTP_.+',
					'Options of the HTTP connection to the provider, for example the timeout.',
				),
			],
		},
		{
			title: 'LDAP',
			rows: [
				p(
					'AUTH_<PROVIDER>_CLIENT_URL',
					'AUTH_.+_CLIENT_URL',
					'URL of the LDAP server, for example `ldaps://ldap.example.com`. URL.',
				),
				p('AUTH_<PROVIDER>_BIND_DN', 'AUTH_.+_BIND_DN', 'DN of the account the API uses to look up users. DN string.'),
				p('AUTH_<PROVIDER>_BIND_PASSWORD', 'AUTH_.+_BIND_PASSWORD', 'Password of that account. String.'),
				p('AUTH_<PROVIDER>_USER_DN', 'AUTH_.+_USER_DN', 'Directory branch holding the users. DN string.'),
				p(
					'AUTH_<PROVIDER>_USER_ATTRIBUTE',
					'AUTH_.+_USER_ATTRIBUTE',
					'Attribute used as the user name. Attribute name.',
				),
				p('AUTH_<PROVIDER>_USER_SCOPE', 'AUTH_.+_USER_SCOPE', 'User search scope: `base`, `one` or `sub`.'),
				p('AUTH_<PROVIDER>_MAIL_ATTRIBUTE', 'AUTH_.+_MAIL_ATTRIBUTE', 'Attribute holding the email. Attribute name.'),
				p(
					'AUTH_<PROVIDER>_FIRST_NAME_ATTRIBUTE',
					'AUTH_.+_FIRST_NAME_ATTRIBUTE',
					'Attribute holding the first name. Attribute name.',
				),
				p(
					'AUTH_<PROVIDER>_LAST_NAME_ATTRIBUTE',
					'AUTH_.+_LAST_NAME_ATTRIBUTE',
					'Attribute holding the last name. Attribute name.',
				),
				p(
					'AUTH_<PROVIDER>_GROUP_DN',
					'AUTH_.+_GROUP_DN',
					'Directory branch holding the groups, used to give roles by group. DN string.',
				),
				p(
					'AUTH_<PROVIDER>_GROUP_ATTRIBUTE',
					'AUTH_.+_GROUP_ATTRIBUTE',
					'Group attribute holding the members. Attribute name.',
				),
				p('AUTH_<PROVIDER>_GROUP_SCOPE', 'AUTH_.+_GROUP_SCOPE', 'Group search scope: `base`, `one` or `sub`.'),
			],
		},
	],

	files: [
		{
			title: 'Storage Locations',
			note: 'In variable names, `<LOCATION>` is the location name in upper case, taken from `STORAGE_LOCATIONS`. Backoffice supports two drivers: `local` and `s3`.',
			rows: [
				v(
					'STORAGE_LOCATIONS',
					'Names of the file storage locations. Comma-separated list; the first one is the default.',
					SHARED,
				),
				p('STORAGE_<LOCATION>_DRIVER', 'STORAGE_.+_DRIVER', 'Driver of the location: `local` or `s3`.'),
				p(
					'STORAGE_<LOCATION>_ROOT',
					'STORAGE_.+_ROOT',
					'Root folder of the files (`local`), or key prefix in the bucket (`s3`). Path string.',
				),
				p('STORAGE_<LOCATION>_KEY', 'STORAGE_.+_KEY', 'S3 access key. String.'),
				p('STORAGE_<LOCATION>_SECRET', 'STORAGE_.+_SECRET', 'S3 secret key. String.'),
				p('STORAGE_<LOCATION>_BUCKET', 'STORAGE_.+_BUCKET', 'S3 bucket name. String.'),
				p('STORAGE_<LOCATION>_REGION', 'STORAGE_.+_REGION', 'S3 region. String.'),
				p('STORAGE_<LOCATION>_ENDPOINT', 'STORAGE_.+_ENDPOINT', 'Endpoint of an S3-compatible service. URL.'),
				p('STORAGE_<LOCATION>_ACL', 'STORAGE_.+_ACL', 'ACL given to files written to S3. String such as `private`.'),
				p(
					'STORAGE_<LOCATION>_SERVER_SIDE_ENCRYPTION',
					'STORAGE_.+_SERVER_SIDE_ENCRYPTION',
					'S3 server-side encryption type. String such as `AES256` or `aws:kms`.',
				),
				p(
					'STORAGE_<LOCATION>_SERVER_SIDE_ENCRYPTION_KMS_KEY_ID',
					'STORAGE_.+_SERVER_SIDE_ENCRYPTION_KMS_KEY_ID',
					'KMS key used for that encryption. Key ID.',
				),
				p(
					'STORAGE_<LOCATION>_HEALTHCHECK_THRESHOLD',
					'STORAGE_.+_HEALTHCHECK_THRESHOLD',
					'Threshold above which the health check reports the location as slow. Milliseconds.',
				),
			],
		},
		{
			title: 'Uploads',
			rows: [
				v(
					'FILES_MAX_UPLOAD_SIZE',
					'Maximum size of an uploaded file. Size string such as `100mb`; no limit when empty.',
				),
				v('FILES_MAX_UPLOAD_CONCURRENCY', 'Number of files processed at the same time in one upload request. Integer.'),
				v(
					'FILES_MIME_TYPE_ALLOW_LIST',
					'File types allowed for upload. Comma-separated list of MIME patterns, for example `image/*,application/pdf`.',
				),
				v(
					'FILES_CONTENT_TYPE_ALLOW_LIST',
					'Accepted so it raises no warning, but the API does not read it. Use `FILES_MIME_TYPE_ALLOW_LIST`.',
				),
				v(
					'FILES_DELETE_ORIGINAL_ON_MOVE',
					'Deletes the file at the old location when a file moves to another location. Boolean.',
				),
				v(
					'FILE_METADATA_ALLOW_LIST',
					'Image metadata fields (EXIF, IPTC) kept on upload. Comma-separated list, or `*` for all.',
				),
			],
		},
		{
			title: 'Resumable Uploads (TUS)',
			rows: [
				v('TUS_ENABLED', 'Turns on resumable uploads for large files: an interrupted upload can continue. Boolean.'),
				v('TUS_CHUNK_SIZE', 'Size of each part of an upload. Bytes.'),
				v(
					'TUS_UPLOAD_EXPIRATION',
					'How long an unfinished upload is kept before it is cleaned up. Duration string such as `10m`.',
				),
				v('TUS_CLEANUP_SCHEDULE', 'Schedule for cleaning up expired unfinished uploads. Cron expression.'),
			],
		},
		{
			title: 'Images and Assets',
			rows: [
				v('ASSETS_CACHE_TTL', 'How long the browser may keep an asset. Duration string such as `30d`.'),
				v('ASSETS_CACHE_REVALIDATE', 'Asks the browser to check with the server before using a kept copy. Boolean.'),
				v('ASSETS_TRANSFORM_MAX_CONCURRENT', 'Number of images transformed at the same time. Integer.'),
				v(
					'ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION',
					'Maximum width or height of a source image that may be transformed. Pixels.',
				),
				v('ASSETS_TRANSFORM_MAX_OPERATIONS', 'Maximum number of transformations in one request. Integer.'),
				v('ASSETS_TRANSFORM_TIMEOUT', 'Maximum duration of one transformation. Duration string such as `7500ms`.'),
				v(
					'ASSETS_CONTENT_SECURITY_POLICY',
					'A separate `Content-Security-Policy` header for `/assets` responses. String.',
				),
				v(
					'ASSETS_INVALID_IMAGE_SENSITIVITY_LEVEL',
					'Image file error level from which a transformation is refused: `none`, `truncated`, `error` or `warning`.',
				),
			],
		},
		{
			title: 'Import from URL',
			rows: [
				v(
					'IMPORT_IP_DENY_LIST',
					'IP addresses the API must not call when importing a file from a URL and during environment sync. Comma-separated list.',
					'`0.0.0.0` blocks every address of the server itself. Add internal network ranges if admins must not reach them.',
				),
			],
		},
	],

	'flows-extensions': [
		{
			title: 'Flows',
			rows: [
				v(
					'FLOWS_ENV_ALLOW_LIST',
					'Environment variables flows can read through `$env`. Comma-separated list of names, or `false` to allow none.',
				),
				v('FLOWS_RUN_SCRIPT_MAX_MEMORY', 'Maximum memory of the Run Script operation. Megabytes.'),
				v('FLOWS_RUN_SCRIPT_TIMEOUT', 'Maximum run time of the Run Script operation. Milliseconds.'),
				p(
					'RATE_LIMITER_EMAIL_FLOWS_*',
					'RATE_LIMITER_EMAIL_FLOWS_.+',
					'Rate limit of the Send Email operation: `RATE_LIMITER_EMAIL_FLOWS_ENABLED`, `_POINTS`, `_DURATION`.',
					'Backoffice sends no email: the operation runs every step and writes a log line instead of sending.',
				),
			],
		},
		{
			title: 'Extensions',
			rows: [
				v('EXTENSIONS_PATH', 'Local folder of the extensions. Path string.'),
				v(
					'EXTENSIONS_LOCATION',
					'Name of the storage location (in `STORAGE_LOCATIONS`) holding the extensions shared by every instance. String.',
					'Needed with several instances: extensions installed from the marketplace or uploaded are synced from there.',
				),
				v('EXTENSIONS_MUST_LOAD', 'The API stops starting when an extension fails to load. Boolean.'),
				v('EXTENSIONS_AUTO_RELOAD', 'Reloads an extension when its files change. For development only. Boolean.'),
				v(
					'EXTENSIONS_CACHE_TTL',
					'How long the browser may keep the app extension bundle. Duration string; not kept when empty.',
				),
				v('EXTENSIONS_SANDBOX_MEMORY', 'Maximum memory of an extension running in the sandbox. Megabytes.'),
				v('EXTENSIONS_SANDBOX_TIMEOUT', 'Maximum run time of one call in the sandbox. Milliseconds.'),
				v('EXTENSIONS_LIMIT', 'Maximum number of installed extensions. Integer; no limit when empty.'),
				v('EXTENSIONS_ROLLDOWN', 'Uses Rolldown instead of Rollup to bundle app extensions. Boolean.'),
			],
		},
		{
			title: 'Marketplace',
			rows: [
				v(
					'MARKETPLACE_REGISTRY',
					'URL of the registry the Marketplace page uses. URL; the default registry when empty.',
				),
				v(
					'MARKETPLACE_TRUST',
					'Which extensions may be installed from the marketplace or uploaded: `sandbox` (sandboxed extensions only) or `all`.',
				),
			],
		},
	],

	data: [
		{
			title: 'Import and Export',
			rows: [
				v('IMPORT_TIMEOUT', 'Maximum duration of one import. Duration string such as `1h`.'),
				v(
					'IMPORT_MAX_CONCURRENCY',
					'Number of imports allowed to run at the same time across the whole system. Integer.',
				),
				v('IMPORT_EXPORT_NAMESPACE', 'Redis namespace of the import and export counters. String.', SHARED),
				v('MAX_IMPORT_ERRORS', 'Maximum number of errors recorded before an import stops. Integer.'),
				v('EXPORT_BATCH_SIZE', 'Items per batch when exporting to a file. Integer.'),
			],
		},
		{
			title: 'Data Retention',
			note: 'A scheduled job deletes old activity, revisions and flow logs. With several instances, only one instance runs each pass.',
			rows: [
				v('RETENTION_ENABLED', 'Turns on the job that cleans up old data. Boolean.'),
				v('RETENTION_SCHEDULE', 'Schedule of the job. Cron expression.'),
				v('RETENTION_BATCH', 'Rows deleted per batch. Integer.'),
				v(
					'ACTIVITY_RETENTION',
					'How long activity is kept. Duration string such as `90d`, or `false` to keep it forever.',
				),
				v(
					'REVISIONS_RETENTION',
					'How long revisions are kept. Duration string such as `90d`, or `false` to keep them forever.',
				),
				v(
					'FLOW_LOGS_RETENTION',
					'How long flow logs are kept. Duration string such as `90d`, or `false` to keep them forever.',
				),
			],
		},
	],

	'graphql-realtime': [
		{
			title: 'GraphQL',
			rows: [
				v('GRAPHQL_INTROSPECTION', 'Allows introspection queries. Boolean.'),
				v('GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT', 'Number of GraphQL schemas built at the same time. Integer.'),
				v('GRAPHQL_QUERY_TOKEN_LIMIT', 'Maximum number of tokens in one GraphQL query. Integer.'),
				v('GRAPHQL_SCHEMA_CACHE_CAPACITY', 'Number of per-user schemas kept in memory. Integer; 100 when empty.'),
			],
		},
		{
			title: 'Realtime',
			note: 'Backoffice opens no WebSocket connection. These variables only turn on publishing data change events to the shared bus, so the system that shares the database can push them to its clients.',
			rows: [
				v('WEBSOCKETS_ENABLED', 'Publishes realtime events to the bus. Boolean.'),
				v('WEBSOCKETS_REST_ENABLED', 'Publishes events for the REST channel. Boolean.'),
				v(
					'WEBSOCKETS_GRAPHQL_ENABLED',
					'Publishes events for the GraphQL channel; the value is also reported at `/server/info`. Boolean.',
				),
			],
		},
	],

	'logging-metrics': [
		{
			title: 'Logs',
			rows: [
				v(
					'LOG_LEVEL',
					'Lowest log level written: `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`. `info` when empty.',
				),
				v('LOG_STYLE', 'Log format: `pretty` (for people) or `raw` (JSON, for log collectors). `pretty` when empty.'),
				v(
					'LOG_HTTP_IGNORE_PATHS',
					'Paths whose requests are not logged, for example `/server/ping`. Comma-separated list.',
				),
				p('LOGGER_*', 'LOGGER_.+', 'More logger options, for example `LOGGER_LEVELS` to rename log levels.'),
			],
		},
		{
			title: 'Metrics',
			rows: [
				v('METRICS_ENABLED', 'Turns on the `/metrics` endpoint in Prometheus format. Boolean.'),
				v('METRICS_SCHEDULE', 'Schedule for collecting metrics. Cron expression.'),
				v(
					'METRICS_TOKENS',
					'Tokens allowed to read `/metrics`, sent in the `Authorization: Metrics <token>` header. Comma-separated list; only admins can read when empty.',
				),
				v('METRICS_SERVICES', 'Services measured: `database`, `cache`, `redis`, `storage`. Comma-separated list.'),
				v('METRICS_HEALTH_CHECK_PREFIX', 'Prefix of the keys and files the measurements write temporarily. String.'),
				v(
					'METRICS_NAME_PREFIX',
					'Prefix of the metric names. String.',
					'Keep the default so shared monitoring dashboards work for every system on the same database.',
				),
			],
		},
	],
};
