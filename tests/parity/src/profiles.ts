import type { ParityOptions } from './parity.js';
import type { Profile } from './config.js';

const key = (profile: Profile) => profile.toUpperCase().replace(/-/g, '_');

/** URLs of a profile pair set by global-setup (DIRECTUS_URL_<PROFILE>, BACKOFFICE_URL_<PROFILE>), if it runs. */
export function profileUrls(profile: Profile): Pick<ParityOptions, 'directusUrl' | 'backofficeUrl'> | undefined {
	const directusUrl = process.env[`DIRECTUS_URL_${key(profile)}`];
	const backofficeUrl = process.env[`BACKOFFICE_URL_${key(profile)}`];
	return directusUrl && backofficeUrl ? { directusUrl, backofficeUrl } : undefined;
}

export const profileEnvKeys = (profile: Profile) =>
	[`DIRECTUS_URL_${key(profile)}`, `BACKOFFICE_URL_${key(profile)}`] as const;
