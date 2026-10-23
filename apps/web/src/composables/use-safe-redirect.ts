// Ported from directus/app/src/composables/use-safe-redirect.ts
// Backoffice: POST /utils/resolve-redirect through the SDK. getPublicURL and extractPath of utils/get-root-path.ts are
// inlined: like DR they read the page URL, whose root (before /admin/) is where the app is served. An absolute
// URL on the app root becomes an app path; anything else (the API's PUBLIC_URL on another origin, an allow-listed
// URL) stays absolute, and the caller leaves the app for it, as DR does.
import { ref } from 'vue';
import { requestEndpoint, sdk } from '../api/sdk.ts';

function extractRoot(path: string) {
	const parts = path.split('/');
	const adminIndex = parts.indexOf('admin');
	return parts.slice(0, adminIndex).join('/') + '/';
}

function extractPath(path: string) {
	const parts = path.split('/');
	const adminIndex = parts.indexOf('admin');
	return '/' + parts.slice(adminIndex + 1).join('/');
}

function getPublicURL(): string {
	return extractRoot(window.location.href);
}

export function useSafeRedirect() {
	const redirect = ref<string | null>(null);

	async function resolveRedirect(value: string | undefined | null, provider?: string) {
		if (!value) return;

		try {
			const data = await sdk.request(
				requestEndpoint<string | null>('/utils/resolve-redirect', {
					method: 'POST',
					body: { redirect: value, ...(provider !== undefined && { provider }) },
				}),
			);

			redirect.value = toRelativePath(data);
		} catch {
			redirect.value = null;
		}
	}

	function toRelativePath(resolved: string | null): string | null {
		if (!resolved) return null;

		// Only attempt conversion for absolute URLs
		if (/^https?:\/\//.test(resolved) === false) return resolved;

		try {
			const resolvedUrl = new URL(resolved);
			const publicBase = new URL(getPublicURL());

			if (resolvedUrl.protocol === publicBase.protocol && resolvedUrl.host === publicBase.host) {
				return extractPath(resolvedUrl.toString());
			}
		} catch {
			// Not a valid URL, return as-is
		}

		return resolved;
	}

	return { redirect, resolveRedirect };
}
