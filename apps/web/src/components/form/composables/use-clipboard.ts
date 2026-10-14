// Ported from directus/app/src/composables/use-clipboard.ts
// Backoffice: the app has no snackbar notifications yet (feature 018), so `notify` is not called; the copy and paste
// still work and the functions keep their return values. `message` is kept for callers ported later.
import { computed } from 'vue';

type Message = {
	success?: string;
	fail?: string;
};

export function useClipboard() {
	const isCopySupported = computed(() => {
		return !!navigator?.clipboard?.writeText;
	});

	const isPasteSupported = computed(() => {
		return !!navigator?.clipboard?.readText;
	});

	return { isCopySupported, isPasteSupported, copyToClipboard, pasteFromClipboard };

	async function copyToClipboard(value: any, _message?: Message): Promise<boolean> {
		try {
			const valueString = typeof value === 'string' ? value : JSON.stringify(value);
			await navigator.clipboard.writeText(valueString);

			return true;
		} catch {
			return false;
		}
	}

	async function pasteFromClipboard(_message?: Message): Promise<string | null> {
		try {
			const pasteValue = await navigator?.clipboard?.readText();

			return pasteValue;
		} catch {
			return null;
		}
	}
}
