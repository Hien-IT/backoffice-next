// Run-time configuration (FR-003, Principle VII): one build for every environment. The container writes
// config.json next to index.html at start (docker/40-config.sh); the dev server serves public/config.json.
export interface RuntimeConfig {
	/** Base URL of the API, `/` when the API is served from the same origin. */
	apiUrl: string;
}

export const DEFAULT_CONFIG: RuntimeConfig = { apiUrl: '/' };

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
	try {
		const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
		if (!response.ok) return DEFAULT_CONFIG;

		const config: unknown = await response.json();

		if (typeof config === 'object' && config !== null && typeof (config as RuntimeConfig).apiUrl === 'string') {
			return { apiUrl: (config as RuntimeConfig).apiUrl };
		}
	} catch {
		// Missing or unreadable config.json: same-origin API.
	}

	return DEFAULT_CONFIG;
}
