<!-- Ported from directus/app/src/modules/activity/routes/item.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-063): VDrawer is BoDrawer, api (axios) is the SDK (api-calls row 200), the header action
// button is BoButton. Deviations: an untranslated action shows its raw key (DR leaves the row empty, research R8); a load
// error shows its translated message (translateAPIError as 014) instead of the raw error object; closing keeps the
// page query. The labels and values are a definition list (the DR `@TODO add final design` paragraphs).
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoButton from '../../../components/BoButton.vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoProgressCircular from '../../../components/BoProgressCircular.vue';
import BoDrawer from '../../../components/drawers/BoDrawer.vue';
import UserPopover from '../../../components/render/UserPopover.vue';
import { useDialogRoute } from '../../../composables/use-dialog-route.ts';
import { i18n, translateAPIError } from '../../../lang/index.ts';
import { getItemRoute, isSystemCollection } from '../../../utils/get-item-route.ts';
import { userName } from '../../../utils/user-name.ts';

type ActivityRecord = {
	user: {
		id: string;
		email: string;
		first_name: string;
		last_name: string;
	} | null;
	action: string;
	action_translated: string;
	timestamp: string;
	ip: string;
	user_agent: string;
	origin: string;
	collection: string;
	item: string;
};

const props = defineProps<{
	primaryKey: string;
}>();

const { t, te } = useI18n();

const route = useRoute();
const router = useRouter();

const isOpen = useDialogRoute();

const item = ref<ActivityRecord>();
const loading = ref(false);
const error = ref<any>(null);

const openItemLink = computed(() => {
	if (!item.value || isSystemCollection(item.value.collection) || item.value.action === 'delete') return;

	return getItemRoute(item.value.collection, item.value.item);
});

watch(() => props.primaryKey, loadActivity, { immediate: true });

async function loadActivity() {
	loading.value = true;

	try {
		item.value = await sdk.request<ActivityRecord>(
			requestEndpoint(`/activity/${props.primaryKey}`, {
				params: {
					fields: [
						'user.id',
						'user.email',
						'user.first_name',
						'user.last_name',
						'action',
						'timestamp',
						'ip',
						'user_agent',
						'origin',
						'collection',
						'item',
					],
				},
			}),
		);

		if (item.value) {
			// Backoffice: the raw action key when there is no translation (spec 018 US5-4).
			item.value.action_translated = te(`field_options.directus_activity.${item.value.action}`)
				? t(`field_options.directus_activity.${item.value.action}`)
				: item.value.action;

			item.value.timestamp = new Date(item.value.timestamp).toLocaleString(i18n.global.locale.value);
		}
	} catch (err: any) {
		error.value = err;
	} finally {
		loading.value = false;
	}
}

function close() {
	router.push({ name: 'activity-collection', query: route.query });
}

const LABEL = 'text-sm font-semibold text-gray-800 dark:text-white/90';
const VALUE = 'mb-5 break-words text-sm text-gray-700 last:mb-0 dark:text-gray-400';
</script>

<template>
	<BoDrawer :model-value="isOpen" :title="$t('activity_item')" @update:model-value="close" @cancel="close">
		<div v-if="loading" class="flex justify-center py-6">
			<BoProgressCircular indeterminate />
		</div>

		<BoNotice v-else-if="error" type="danger">
			{{ translateAPIError(error) }}
		</BoNotice>

		<dl v-else-if="item" class="m-0">
			<dt :class="LABEL">{{ $t('user') }}:</dt>
			<dd :class="VALUE">
				<UserPopover v-if="item.user" :user="item.user.id">
					<span>
						{{ userName(item.user) }}
					</span>
				</UserPopover>
			</dd>

			<dt :class="LABEL">{{ $t('action') }}:</dt>
			<dd :class="VALUE">{{ item.action_translated }}</dd>

			<dt :class="LABEL">{{ $t('date') }}:</dt>
			<dd :class="VALUE">{{ item.timestamp }}</dd>

			<dt :class="LABEL">{{ $t('ip_address') }}:</dt>
			<dd :class="VALUE">{{ item.ip }}</dd>

			<dt :class="LABEL">{{ $t('user_agent') }}:</dt>
			<dd :class="VALUE">{{ item.user_agent }}</dd>

			<dt :class="LABEL">{{ $t('origin') }}:</dt>
			<dd :class="VALUE">{{ item.origin }}</dd>

			<dt :class="LABEL">{{ $t('collection') }}:</dt>
			<dd :class="VALUE">{{ item.collection }}</dd>

			<dt :class="LABEL">{{ $t('item') }}:</dt>
			<dd :class="VALUE">{{ item.item }}</dd>
		</dl>

		<template #actions>
			<BoButton v-if="openItemLink" icon="launch" :to="openItemLink" :aria-label="$t('open')" :title="$t('open')" />
		</template>
	</BoDrawer>
</template>
