<!-- Ported from directus/app/src/views/private/components/comments-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: recipe "Comments and shares" (Q-11) and the date headings of Q-10; axios -> sdk (FR-001). The section opens
// through `sidebarStore.activeAccordionItem` (SidebarDetail, Q-9) instead of useGroupable. The display string is the
// comment through DOMPurify with no tag, then each ` @<uuid>` becomes a `<mark>` with the HTML-escaped user name
// (FR-110b; DR inserts the name unescaped and drops the space before the mention); an unknown user shows
// `private_user`. A failed load shows an error notice (DR shadows `error` in the catch, so it never shows).
import type { Comment, PrimaryKey, User } from '@directus/types';
import { abbreviateNumber } from '@directus/utils';
import { isThisYear, isToday, isYesterday } from 'date-fns';
import dompurify from 'dompurify';
import { escape, groupBy, orderBy } from 'lodash-es';
import { computed, onMounted, type Ref, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import type { AppUser } from '../../types/user.ts';
import { localizedFormat } from '../../utils/localized-format.ts';
import { userName } from '../../utils/user-name.ts';
import BoNotice from '../BoNotice.vue';
import BoProgressLinear from '../BoProgressLinear.vue';
import CommentInput from './CommentInput.vue';
import CommentItem from './CommentItem.vue';
import SidebarDetail from './SidebarDetail.vue';

type CommentsByDateDisplay = {
	date: Date;
	dateFormatted: string;
	comments: (Comment & {
		display: string;
		user_created: Pick<User, 'id' | 'email' | 'first_name' | 'last_name' | 'avatar'>;
	})[];
};

const props = defineProps<{
	collection: string;
	primaryKey: PrimaryKey;
}>();

const { t } = useI18n();

const { collection, primaryKey } = toRefs(props);

const sidebarStore = useSidebarStore();

const { comments, getComments, loading, error, refresh, commentsCount, getCommentsCount, loadingCount } = useComments(
	collection,
	primaryKey,
);

onMounted(() => {
	getCommentsCount();

	if (sidebarStore.activeAccordionItem === 'comments') {
		getComments();
	}
});

function onToggle(open: boolean) {
	if (open && comments.value === null) getComments();
}

const badge = computed(() =>
	!loadingCount.value && commentsCount.value > 0 ? abbreviateNumber(commentsCount.value) : false,
);

function useComments(collection: Ref<string>, primaryKey: Ref<PrimaryKey>) {
	const regex = /\s@[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}/gm;
	const comments = ref<CommentsByDateDisplay[] | null>(null);
	const commentsCount = ref(0);
	const error = ref<unknown>(null);
	const loading = ref(false);
	const loadingCount = ref(false);

	watch([collection, primaryKey], () => refresh());

	return { comments, getComments, error, loading, refresh, commentsCount, getCommentsCount, loadingCount };

	async function getComments() {
		error.value = null;
		loading.value = true;

		try {
			const response = await sdk.request<Comment[]>(
				requestEndpoint('/comments', {
					params: {
						'filter[collection][_eq]': collection.value,
						'filter[item][_eq]': primaryKey.value,
						sort: '-date_created',
						fields: [
							'id',
							'comment',
							'date_created',
							'user_created.id',
							'user_created.email',
							'user_created.first_name',
							'user_created.last_name',
							'user_created.avatar.id',
							'user_created.avatar.modified_on',
						],
					},
				}),
			);

			const userPreviews = await loadUserPreviews(response, regex);

			const commentsWithTaggedUsers = response.map((comment) => {
				const display = dompurify.sanitize(comment.comment, { ALLOWED_TAGS: [] }).replace(regex, (match) => {
					const name = userPreviews[match.substring(2)] ?? t('private_user');
					return `${match[0]}<mark class="rounded bg-brand-50 px-1 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">${escape(name)}</mark>`;
				});

				return { ...comment, display } as CommentsByDateDisplay['comments'][number];
			});

			const commentsByDate = groupBy(commentsWithTaggedUsers, (activity) => {
				// activity's timestamp date is in iso-8601
				const date = new Date(new Date(activity.date_created).toDateString());
				return date;
			});

			const commentsGrouped: CommentsByDateDisplay[] = [];

			for (const [key, value] of Object.entries(commentsByDate)) {
				const date = new Date(key);
				const today = isToday(date);
				const yesterday = isYesterday(date);
				const thisYear = isThisYear(date);

				let dateFormatted: string;

				if (today) dateFormatted = t('today');
				else if (yesterday) dateFormatted = t('yesterday');
				else if (thisYear) dateFormatted = localizedFormat(date, String(t('date-fns_date_short_no_year')));
				else dateFormatted = localizedFormat(date, String(t('date-fns_date_short')));

				commentsGrouped.push({ date, dateFormatted: String(dateFormatted), comments: value });
			}

			comments.value = orderBy(commentsGrouped, ['date'], ['desc']);
		} catch (err) {
			error.value = err;
		} finally {
			loading.value = false;
		}
	}

	async function getCommentsCount() {
		loadingCount.value = true;

		try {
			const response = await sdk.request<{ count: { id: number | string } }[]>(
				requestEndpoint('/comments', {
					params: {
						filter: {
							_and: [{ collection: { _eq: collection.value } }, { item: { _eq: primaryKey.value } }],
						},
						aggregate: { count: 'id' },
					},
				}),
			);

			commentsCount.value = Number(response[0]?.count.id);
		} catch (err) {
			error.value = err;
		} finally {
			loadingCount.value = false;
		}
	}

	async function refresh() {
		await getCommentsCount();
		await getComments();
	}
}

async function loadUserPreviews(comments: Comment[], regex: RegExp): Promise<Record<string, string>> {
	const uniqIds = [...new Set(comments.flatMap((comment) => comment.comment.match(regex) ?? []))];

	if (uniqIds.length === 0) return {};

	const users = await sdk.request<Partial<AppUser>[]>(
		requestEndpoint('/users', {
			params: {
				filter: { id: { _in: uniqIds.map((id) => id.substring(2)) } },
				fields: ['first_name', 'last_name', 'email', 'id'],
			},
		}),
	);

	return Object.fromEntries(users.map((user) => [user.id, userName(user)]));
}
</script>

<template>
	<SidebarDetail id="comments" :title="$t('comments')" icon="chat_bubble_outline" :badge @toggle="onToggle">
		<div class="flex flex-col gap-3">
			<CommentInput :refresh :collection :primary-key="primaryKey" />

			<BoProgressLinear v-if="loading" indeterminate :aria-label="$t('loading')" />

			<BoNotice v-else-if="error" type="danger">{{ $t('unexpected_error') }}</BoNotice>

			<p v-else-if="!comments || comments.length === 0" class="py-2 italic">{{ $t('no_comments') }}</p>

			<section v-for="group in comments" v-else :key="group.date.toString()" class="flex flex-col gap-2">
				<h3
					class="sticky top-0 z-1 bg-white py-1 text-theme-xs font-medium text-gray-500 uppercase dark:bg-gray-900 dark:text-gray-400"
				>
					{{ group.dateFormatted }}
				</h3>

				<CommentItem
					v-for="item in group.comments"
					:key="item.id"
					:refresh
					:comment="item"
					:primary-key="primaryKey"
					:collection
				/>
			</section>
		</div>
	</SidebarDetail>
</template>
