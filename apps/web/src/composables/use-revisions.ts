// Ported from directus/app/src/composables/use-revisions.ts
// Backoffice: axios -> sdk (FR-001), `fields` joined with commas for the SDK query string; unexpectedError ->
// showUnexpectedError (014 screens); `Action` of @directus/constants (not a dependency of apps/web) as string literals.
import type { Filter } from '@directus/types';
import { format, isThisYear, isToday, isYesterday, parseISO } from 'date-fns';
import { groupBy, orderBy } from 'lodash-es';
import { type Ref, ref, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { useServerStore } from '../stores/server.ts';
import type { Revision, RevisionPartial, RevisionsByDate, RevisionWithTime } from '../types/revisions.ts';
import type { ContentVersionWithType } from '../types/versions.ts';
import { localizedFormat } from '../utils/localized-format.ts';
import { localizedFormatDistance } from '../utils/localized-format-distance.ts';
import { showUnexpectedError } from './use-notices.ts';

type UseRevisionsOptions = {
	action?: string;
	full?: boolean;
};

export function useRevisions(
	collection: Ref<string>,
	primaryKey: Ref<number | string>,
	version: Ref<ContentVersionWithType | null | undefined>,
	options?: UseRevisionsOptions,
) {
	const { t } = useI18n();
	const { info } = useServerStore();

	const revisions = ref<RevisionPartial[] | null>(null);
	const revisionsByDate = ref<RevisionsByDate[] | null>(null);
	const loading = ref(false);
	const loadingCount = ref(false);
	const revisionsCount = ref(0);
	const created = ref<{ id: number }>();
	const pagesCount = ref(0);

	watch([collection, primaryKey, version], () => refresh());

	return {
		created,
		revisions,
		revisionsByDate,
		getRevisions,
		loading,
		refresh,
		loadingCount,
		revisionsCount,
		getRevisionsCount,
		pagesCount,
	};

	function getFilter(): Filter & { _and: Filter[] } {
		const filter: Filter & { _and: Filter[] } = {
			_and: [
				{
					collection: {
						_eq: unref(collection),
					},
				},
				{
					item: {
						_eq: unref(primaryKey),
					},
				},
				{
					version: version?.value
						? {
								_eq: version.value.id,
							}
						: { _null: true },
				},
			],
		};

		if (options?.action) {
			filter._and.push({
				activity: {
					action: {
						_eq: options?.action,
					},
				},
			});
		}

		return filter;
	}

	async function getRevisions(page = 0) {
		if (typeof unref(primaryKey) === 'undefined') return;

		loading.value = true;
		const pageSize = info.queryLimit?.max && info.queryLimit.max !== -1 ? Math.min(10, info.queryLimit.max) : 10;

		try {
			const data = await sdk.request<Revision[] | RevisionPartial[]>(
				requestEndpoint('/revisions', {
					params: {
						filter: getFilter(),
						sort: '-id',
						limit: pageSize,
						page,
						fields: [
							'id',
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
							...(options?.full ? ['data', 'delta'] : []),
						].join(','),
					},
				}),
			);

			if (!created.value) {
				const createdData = await sdk.request<{ id: number }[]>(
					requestEndpoint('/revisions', {
						params: {
							filter: {
								collection: {
									_eq: unref(collection),
								},
								item: {
									_eq: unref(primaryKey),
								},
								version: { _null: true },
								activity: {
									action: {
										_eq: unref(version) ? 'version_save' : 'create',
									},
								},
							},
							sort: '-id',
							limit: 1,
							fields: 'id',
						},
					}),
				);

				created.value = createdData?.[0];
			}

			const revisionsGroupedByDate = groupBy(
				data.filter((revision) => !!revision.activity),
				(revision) => {
					// revision's timestamp date is in iso-8601
					const date = new Date(new Date(revision.activity.timestamp).toDateString());
					return date;
				},
			);

			const revisionsGrouped: RevisionsByDate[] = [];

			for (const [key, value] of Object.entries(revisionsGroupedByDate)) {
				const date = new Date(key);
				const today = isToday(date);
				const yesterday = isYesterday(date);
				const thisYear = isThisYear(date);

				let dateFormatted: string;

				if (today) dateFormatted = t('today');
				else if (yesterday) dateFormatted = t('yesterday');
				else if (thisYear) dateFormatted = localizedFormat(date, String(t('date-fns_date_short_no_year')));
				else dateFormatted = localizedFormat(date, String(t('date-fns_date_short')));

				const revisions: RevisionWithTime[] = [];

				for (const revision of value) {
					const steps = (revision as Revision)?.data?.['steps'];
					const lastStepStatus = steps?.[steps.length - 1]?.status;

					revisions.push({
						...revision,
						timestampFormatted: `${localizedFormat(
							new Date(revision.activity?.timestamp),
							String(t('date-fns_date_short')),
						)} (${localizedFormat(new Date(revision.activity?.timestamp), String(t('date-fns_time')))})`,
						timeRelative: `${format(
							new Date(revision.activity?.timestamp),
							String(t('date-fns_time')),
						)} (${localizedFormatDistance(parseISO(revision.activity?.timestamp), new Date(), {
							addSuffix: true,
						})})`,
						status: lastStepStatus,
					});
				}

				revisionsGrouped.push({
					date: date,
					dateFormatted: String(dateFormatted),
					revisions,
				});
			}

			revisionsByDate.value = orderBy(revisionsGrouped, ['date'], ['desc']);
			revisions.value = orderBy(data, ['activity.timestamp'], ['desc']);
			pagesCount.value = Math.ceil(revisionsCount.value / pageSize);
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			loading.value = false;
		}
	}

	async function getRevisionsCount() {
		if (typeof unref(primaryKey) === 'undefined') return;

		loadingCount.value = true;

		try {
			const data = await sdk.request<{ count: { id: string | number } }[]>(
				requestEndpoint('/revisions', {
					params: {
						filter: getFilter(),
						aggregate: {
							count: 'id',
						},
					},
				}),
			);

			revisionsCount.value = Number(data[0]!.count.id);
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			loadingCount.value = false;
		}
	}

	async function refresh(page = 0) {
		await getRevisionsCount();
		await getRevisions(page);
	}
}
