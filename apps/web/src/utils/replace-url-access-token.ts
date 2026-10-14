// Ported from directus/app/src/interfaces/input-rich-text-html/useImage.ts
// Backoffice: the inner function of useImage as a util (used by useImage and useMedia); getPublicURL -> getApiUrl.
import { getApiUrl } from '../api/sdk.ts';

export function replaceUrlAccessToken(url: string, token: string | null | undefined): string {
	// Only process assets URL
	if (!url.includes(getApiUrl() + 'assets/')) {
		return url;
	}

	try {
		const parsedUrl = new URL(url);
		const params = new URLSearchParams(parsedUrl.search);

		if (!token) {
			params.delete('access_token');
		} else {
			params.set('access_token', token);
		}

		return Array.from(params).length > 0
			? `${parsedUrl.origin}${parsedUrl.pathname}?${params.toString()}`
			: `${parsedUrl.origin}${parsedUrl.pathname}`;
	} catch {
		return url;
	}
}
