import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Resources to close when the server shuts down (Redis clients of the cache and rate limiters, metrics job).
 * Directus only destroys knex; Backoffice also closes these before exiting (Principle VII). They must never
 * block or fail the Directus shutdown sequence, so each task is bounded and its errors are ignored.
 */
const tasks: (() => unknown)[] = [];

export const SHUTDOWN_TASK_TIMEOUT = 1000;

export function onServerShutdown(task: () => unknown): void {
	tasks.push(task);
}

export async function runShutdownTasks(): Promise<void> {
	for (const task of tasks.splice(0)) {
		await Promise.race([
			Promise.resolve()
				.then(task)
				.catch(() => undefined),
			sleep(SHUTDOWN_TASK_TIMEOUT),
		]);
	}
}
