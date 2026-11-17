// Backoffice (spec 033, contracts/web.md §3): copy to the clipboard with the result announced in a polite live region
// (the caller renders `announced`); a clipboard error is a notice.
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { notify } from '../../composables/use-notices.ts';

export function useCopy() {
	const { t } = useI18n();
	const announced = ref('');

	async function copy(text: string): Promise<boolean> {
		// Emptied first, so the same message is announced again on a second copy.
		announced.value = '';

		try {
			await navigator.clipboard.writeText(text);
			announced.value = t('docs_copied');
			return true;
		} catch {
			notify({ title: t('docs_copy_failed'), type: 'error' });
			return false;
		}
	}

	return { announced, copy };
}
