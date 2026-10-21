// Backoffice (specs/020 research R6, R-58): directus_extensions has no unique (source, folder), so Backoffice instances
// starting together could insert the same row. The rows of new extensions are created inside this Redis lock.
import { setTimeout as sleep } from 'node:timers/promises';
import { useLock } from '../../lock/index.js';
import { useLogger } from '../../logger/index.js';

export const SETTINGS_LOCK_KEY = 'extensions-settings';

export const SETTINGS_LOCK_TIMEOUT = 30_000;

const RETRY_INTERVAL = 250;

/** Runs `fn` while holding the lock; after `timeout` ms the lock is taken as stale, cleared, and `fn` runs anyway. */
export async function withSettingsLock<T>(fn: () => Promise<T>, timeout = SETTINGS_LOCK_TIMEOUT): Promise<T> {
	const lock = useLock();
	const deadline = Date.now() + timeout;
	let held = false;

	while (!held) {
		if ((await lock.increment(SETTINGS_LOCK_KEY)) === 1) {
			held = true;
			break;
		}

		await lock.increment(SETTINGS_LOCK_KEY, -1);

		if (Date.now() >= deadline) {
			useLogger().warn('Extensions settings lock timed out, creating the extension rows without it');
			await lock.delete(SETTINGS_LOCK_KEY);
			break;
		}

		await sleep(RETRY_INTERVAL);
	}

	try {
		return await fn();
	} finally {
		if (held) await lock.delete(SETTINGS_LOCK_KEY);
	}
}
