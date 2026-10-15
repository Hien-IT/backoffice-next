// Ported from directus/app/src/composables/use-revision.ts
// Backoffice: axios -> sdk (FR-001), `fields` joined with commas; unexpectedError -> showUnexpectedError.
import { format, parseISO } from 'date-fns';
import { type Ref, ref, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import type { Revision } from '../types/revisions.ts';
import { localizedFormat } from '../utils/localized-format.ts';
import { localizedFormatDistance } from '../utils/localized-format-distance.ts';
import { showUnexpectedError } from './use-notices.ts';

export function useRevision(primaryKey: Ref<number | undefined>) {
	const { t } = useI18n();

	const revision = ref<(Revision & { timestampFormatted: string; timeRelative: string }) | null>(null);
	const loading = ref(false);

	watch([primaryKey], () => {
		if (unref(primaryKey) !== unref(revision)?.id) {
			revision.value = null;
		}

		if (typeof unref(primaryKey) === 'undefined') return;
		refresh();
	});

	return {
		revision,
		getRevision,
		loading,
		refresh,
	};

	async function getRevision() {
		if (typeof unref(primaryKey) === 'undefined') return;

		loading.value = true;

		try {
			const data = await sdk.request<Revision>(
				requestEndpoint(`/revisions/${unref(primaryKey)}`, {
					params: {
						fields: [
							'id',
							'data',
							'delta',
							'collection',
							'item',
							'activity.action',
							'activity.timestamp',
							'activity.user.id',
							'activity.user.email',
							'activity.user.first_name',
							'activity.user.last_name',
							'activity.ip',
							'activity.user_agent',
							'activity.origin',
						].join(','),
					},
				}),
			);

			revision.value = {
				...data,
				timestampFormatted: `${localizedFormat(
					new Date(data.activity?.timestamp),
					String(t('date-fns_date_short')),
				)} (${localizedFormat(new Date(data.activity?.timestamp), String(t('date-fns_time')))})`,
				timeRelative: `${format(
					new Date(data.activity?.timestamp),
					String(t('date-fns_time')),
				)} (${localizedFormatDistance(parseISO(data.activity?.timestamp), new Date(), {
					addSuffix: true,
				})})`,
			};
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			loading.value = false;
		}
	}

	async function refresh() {
		await getRevision();
	}
}
