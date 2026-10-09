import { defineStore } from 'pinia';
import { ref } from 'vue';

export type PingStatus = 'idle' | 'loading' | 'success' | 'error';

export const useServerStore = defineStore('server', () => {
	const status = ref<PingStatus>('idle');
	/** Body of GET /server/ping ("pong"), or the error message. */
	const result = ref<string | null>(null);

	async function ping(apiUrl: string): Promise<void> {
		status.value = 'loading';
		result.value = null;

		try {
			const response = await fetch(new URL('server/ping', new URL(apiUrl.replace(/\/?$/, '/'), location.href)));
			result.value = await response.text();
			status.value = response.ok ? 'success' : 'error';
		} catch (err) {
			result.value = err instanceof Error ? err.message : String(err);
			status.value = 'error';
		}
	}

	return { status, result, ping };
});
