// Ported from directus/app/src/stores/requests.ts
import { nanoid } from 'nanoid';
import { defineStore } from 'pinia';

export const RUNNING_LIMIT_MS = 60_000;

export const useRequestsStore = defineStore('requestsStore', {
	state: () => ({
		queue: new Set<string>(),
		// Backoffice (D-173): the same requests without the 3.5 s cut, for the loading favicon, which plays as long as a
		// request runs; a cancelled axios request never ends (no config), so it leaves after RUNNING_LIMIT_MS.
		running: new Set<string>(),
	}),
	getters: {
		queueHasItems(): boolean {
			return this.queue.size > 0;
		},
		runningHasItems(): boolean {
			return this.running.size > 0;
		},
	},
	actions: {
		startRequest() {
			const id = nanoid();
			this.queue.add(id);
			this.running.add(id);

			// If requests take more than 3.5 seconds, it's assumed they'll either never
			// happen, or already crashed
			// Backoffice: the state, not the endRequest action: an action makes its pinia the active one, so in tests (one
			// pinia per test) the timer of an earlier test switched the stores of the test running 3.5 s later.
			setTimeout(() => this.queue.delete(id), 3500);
			setTimeout(() => this.running.delete(id), RUNNING_LIMIT_MS);

			return id;
		},
		endRequest(id: string) {
			this.queue.delete(id);
			this.running.delete(id);
		},
	},
});
