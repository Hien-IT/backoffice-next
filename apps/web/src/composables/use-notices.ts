// Ported from directus/app/src/stores/notifications.ts; Ported from directus/app/src/utils/notify.ts; Ported from directus/app/src/utils/unexpected-error.ts
// From the store: add, remove, queue, dialogs.
// Backoffice: in-place notices under the page header instead of the snackbar of feature 018 (D-66, spec 014 FR-054b);
// a module-level queue shared by every screen, like the Directus store. `unexpectedError` of 013 stays a console warning
// that returns the error (the 013 interfaces show it inline); 014 screens call `showUnexpectedError`, which opens the
// error dialog like Directus.
import { nanoid } from 'nanoid';
import { ref } from 'vue';
import { i18n } from '../lang/index.ts';
import { extractErrorCode } from '../utils/extract-error-code.ts';

export type NoticeType = 'info' | 'success' | 'warning' | 'error';

export interface NoticeRaw {
	title: string;
	text?: string;
	type?: NoticeType;
	persist?: boolean;
	dialog?: boolean;
	code?: string;
	error?: unknown;
}

export interface Notice extends NoticeRaw {
	id: string;
	timestamp: number;
}

/** Directus notifications store: a notice that is not `persist` is removed after 3 s. */
export const NOTICE_TIMEOUT = 3000;

const queue = ref<Notice[]>([]);
const dialogs = ref<Notice[]>([]);

export function useNotices() {
	return { queue, dialogs, notify, remove, showUnexpectedError };
}

export function notify(notification: NoticeRaw): string {
	const id = nanoid();
	const timestamp = Date.now();

	if (notification.dialog === true) {
		notification.persist = true;
		dialogs.value = [...dialogs.value, { ...notification, id, timestamp }];
	} else {
		queue.value = [...queue.value, { ...notification, id, timestamp }];
	}

	if (notification.persist !== true) {
		setTimeout(() => remove(id), NOTICE_TIMEOUT);
	}

	return id;
}

export function remove(id: string): void {
	queue.value = queue.value.filter((notice) => notice.id !== id);
	dialogs.value = dialogs.value.filter((notice) => notice.id !== id);
}

export function showUnexpectedError(error: unknown): void {
	const code = extractErrorCode(error);

	// eslint-disable-next-line no-console
	console.warn(error);

	notify({ title: i18n.global.t(`errors.${code}`), type: 'error', code, dialog: true, error });
}

/** Test helper: empties the shared queue. */
export function resetNotices(): void {
	queue.value = [];
	dialogs.value = [];
}
