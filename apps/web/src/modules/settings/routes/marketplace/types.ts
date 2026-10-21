// Ported from directus/packages/extensions-registry/src/modules/list/schemas/registry-list-response.ts; Ported from directus/packages/extensions-registry/src/modules/describe/schemas/registry-describe-response.ts; Ported from directus/packages/extensions-registry/src/modules/account/schemas/registry-account-response.ts
// Backoffice: the web app does not depend on @directus/extensions-registry; the zod schemas become plain types of the
// `data` the registry endpoints answer (spec 020, rows 210 to 212).
import type { ExtensionType } from '@directus/types';

type Publisher = {
	id: string;
	username: string;
	verified: boolean;
	github_name: string | null;
	github_avatar_url: string | null;
};

export type RegistryListItem = {
	id: string;
	name: string;
	description: string | null;
	total_downloads: number;
	verified: boolean;
	type: ExtensionType;
	last_updated: string;
	host_version: string;
	sandbox: boolean;
	license: string | null;
	publisher: { username: string; verified: boolean; github_name: string | null };
};

export type RegistryListResponse = { meta: { filter_count: number }; data: RegistryListItem[] };

export type RegistryExtension = {
	id: string;
	name: string;
	description: string | null;
	total_downloads: number;
	downloads: { date: string; count: number }[] | null;
	verified: boolean;
	readme: string | null;
	type: ExtensionType;
	license: string | null;
	versions: {
		id: string;
		version: string;
		verified: boolean;
		type: ExtensionType;
		host_version: string;
		publish_date: string;
		unpacked_size: number;
		file_count: number;
		url_bugs: string | null;
		url_homepage: string | null;
		url_repository: string | null;
		license: string | null;
		publisher: Publisher;
		bundled: { name: string; type: string }[];
		maintainers: { accounts_id: Publisher }[] | null;
	}[];
};

export type RegistryAccount = {
	id: string;
	username: string;
	verified: boolean;
	github_username: string | null;
	github_avatar_url: string | null;
	github_name: string | null;
	github_company: string | null;
	github_blog: string | null;
	github_location: string | null;
	github_bio: string | null;
};
