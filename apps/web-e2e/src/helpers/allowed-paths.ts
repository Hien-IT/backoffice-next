// The closed list of API calls of the web app (FR-002), copied from specs/012-backoffice-web-shell/contracts/api-calls.md
// (32 routes), specs/013-interfaces-displays/contracts/api-calls.md (#33-#49) and
// specs/014-content-module/contracts/api-calls.md (#50-#96). Matched on method and path (query ignored, path relative to
// apiUrl). Keep them in step with KNOWN_REQUESTS of apps/web/src/test-utils/fetch.ts.
export interface AllowedCall {
	/** Row number in contracts/api-calls.md. */
	id: number;
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'SEARCH';
	path: RegExp;
}

const ID = '[^/]+';

export const ALLOWED_CALLS: AllowedCall[] = [
	{ id: 1, method: 'GET', path: /^\/server\/info$/ },
	{ id: 2, method: 'GET', path: /^\/auth$/ },
	{ id: 3, method: 'POST', path: /^\/auth\/login$/ },
	{ id: 4, method: 'POST', path: new RegExp(`^/auth/login/${ID}$`) },
	// SSO navigation; the identity provider then sends the browser to the callback of the same provider.
	{ id: 5, method: 'GET', path: new RegExp(`^/auth/login/${ID}(/callback)?$`) },
	{ id: 6, method: 'POST', path: /^\/auth\/refresh$/ },
	{ id: 7, method: 'POST', path: /^\/auth\/logout$/ },
	{ id: 8, method: 'POST', path: /^\/auth\/password\/request$/ },
	{ id: 9, method: 'POST', path: /^\/auth\/password\/reset$/ },
	{ id: 10, method: 'POST', path: /^\/users\/invite\/accept$/ },
	{ id: 11, method: 'POST', path: /^\/server\/setup$/ },
	// 12 (`fields=*,role.id`) and 13 (`fields=id`) differ by query only.
	{ id: 12, method: 'GET', path: /^\/users\/me$/ },
	{ id: 14, method: 'PATCH', path: /^\/users\/me$/ },
	{ id: 15, method: 'POST', path: /^\/users\/me\/tfa\/generate$/ },
	{ id: 16, method: 'POST', path: /^\/users\/me\/tfa\/enable$/ },
	{ id: 17, method: 'GET', path: /^\/policies\/me\/globals$/ },
	{ id: 18, method: 'GET', path: /^\/roles\/me$/ },
	{ id: 19, method: 'GET', path: /^\/permissions\/me$/ },
	{ id: 20, method: 'GET', path: /^\/settings$/ },
	{ id: 21, method: 'GET', path: /^\/collections$/ },
	{ id: 22, method: 'GET', path: /^\/fields$/ },
	{ id: 23, method: 'GET', path: /^\/relations$/ },
	{ id: 24, method: 'GET', path: /^\/presets$/ },
	{ id: 25, method: 'GET', path: /^\/translations$/ },
	{ id: 26, method: 'GET', path: /^\/notifications$/ },
	{ id: 27, method: 'GET', path: new RegExp(`^/assets/${ID}$`) },
	{ id: 28, method: 'GET', path: new RegExp(`^/shares/info/${ID}$`) },
	{ id: 29, method: 'POST', path: /^\/shares\/auth$/ },
	{ id: 30, method: 'POST', path: /^\/files$/ },
	{ id: 31, method: 'POST', path: /^\/utils\/resolve-redirect$/ },
	{ id: 32, method: 'PATCH', path: /^\/users\/me\/track\/page$/ },
	// Feature 013: the flows store hydrates for users who can read directus_flows, see
	// specs/013-interfaces-displays/contracts/api-calls.md #33.
	{ id: 33, method: 'GET', path: /^\/flows$/ },
	// 013 lists and items through useItems / useRelation* on getEndpoint(collection), the 014 layouts (#50, #51, #63 export)
	// and the item page (#52) on the same routes.
	{ id: 34, method: 'GET', path: new RegExp(`^/items/${ID}$`) },
	{ id: 40, method: 'GET', path: /^\/(files|users|folders)$/ },
	{ id: 38, method: 'GET', path: new RegExp(`^/items/${ID}/${ID}$`) },
	{ id: 49, method: 'GET', path: new RegExp(`^/(users|files)/${ID}$`) },
	{ id: 47, method: 'POST', path: /^\/files\/import$/ },
	{ id: 48, method: 'POST', path: new RegExp(`^/flows/trigger/${ID}$`) },
	// Feature 014.
	{ id: 53, method: 'GET', path: new RegExp(`^/permissions/me/${ID}(/${ID})?$`) },
	{ id: 55, method: 'GET', path: /^\/(revisions|versions|comments|shares)$/ },
	// 56 (revision, version) and the share row read before editing it (DrawerItem on directus_shares).
	{ id: 56, method: 'GET', path: new RegExp(`^/(revisions|versions|shares)/${ID}$`) },
	{ id: 58, method: 'GET', path: new RegExp(`^/versions/${ID}/compare$`) },
	{ id: 70, method: 'POST', path: new RegExp(`^/(items/${ID}|presets|versions|comments|shares)$`) },
	{
		id: 71,
		method: 'PATCH',
		path: new RegExp(`^/(items/${ID}(/${ID})?|presets/${ID}|versions/${ID}|comments/${ID}|shares/${ID})$`),
	},
	{
		id: 73,
		method: 'DELETE',
		path: new RegExp(`^/(items/${ID}(/${ID})?|presets|versions/${ID}|comments/${ID}|shares/${ID})$`),
	},
	{ id: 75, method: 'POST', path: new RegExp(`^/utils/(sort|export|import)/${ID}$`) },
	{ id: 82, method: 'POST', path: new RegExp(`^/versions/${ID}/(save|promote)$`) },
	{ id: 90, method: 'POST', path: /^\/shares\/invite$/ },
	{ id: 93, method: 'POST', path: /^\/graphql(\/system)?$/ },
	{ id: 94, method: 'SEARCH', path: new RegExp(`^/items/${ID}$`) },
];

export function isAllowedCall(method: string, path: string): boolean {
	return ALLOWED_CALLS.some((call) => call.method === method && call.path.test(path));
}
