<!-- Ported from directus/app/src/views/private/components/shares-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: recipe "Comments and shares" (Q-11); axios -> sdk (FR-001). The section is hidden when `allowed` is false
// (spec FR-083, US5-3; DR only hides the New Share button) and loads nothing then. The section opens through
// `sidebarStore.activeAccordionItem` (SidebarDetail, Q-9) instead of useGroupable. The link is
// `<origin><base>shared/<id>` with the app base `/admin/` (DR: getRootPath() + 'admin/shared/'). Copy uses
// navigator.clipboard with an in-place notice (D-66): no clipboard (insecure HTTP) is the `share_copy_link_error`
// notice. The send dialog has the read-only link with a copy button (recipe) and posts `/shares/invite` (the API only
// logs, D-36; no success notice, like DR). DrawerItem gets `collection`/`item` in `input` like DR: both
// fields are hidden by the directus_shares field meta, and preset `edits` would make an untouched form ask before
// closing. A failed load shows the error notice (DR shadows `error` in the catch).
import type { PrimaryKey, Share } from '@directus/types';
import { abbreviateNumber } from '@directus/utils';
import { computed, defineAsyncComponent, onMounted, type Ref, ref, toRefs, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { notify, showUnexpectedError } from '../../composables/use-notices.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import BoButton from '../BoButton.vue';
import BoDialog from '../BoDialog.vue';
import BoInput from '../BoInput.vue';
import BoNotice from '../BoNotice.vue';
import BoProgressLinear from '../BoProgressLinear.vue';
import BoTextarea from '../BoTextarea.vue';
import ShareItem from './ShareItem.vue';
import SidebarDetail from './SidebarDetail.vue';

// Backoffice: lazy, DrawerItem imports BoForm and the interface registry (import cycle).
const DrawerItem = defineAsyncComponent(() => import('../drawers/DrawerItem.vue'));

const props = defineProps<{
	collection: string;
	primaryKey: string | number;
	allowed: boolean;
}>();

const { t } = useI18n();

const { collection, primaryKey, allowed } = toRefs(props);

const sidebarStore = useSidebarStore();

const sendFormId = useId();

const {
	shares,
	shareToEdit,
	shareToSend,
	shareToDelete,
	sharesCount,
	loading,
	loadingCount,
	sendPublicLink,
	sendEmails,
	error,
	getShares,
	getSharesCount,
	input,
	send,
	select,
	unselect,
	remove,
	sending,
	deleting,
} = useShares(collection, primaryKey);

onMounted(() => {
	if (!allowed.value) return;

	getSharesCount();

	if (sidebarStore.activeAccordionItem === 'shares') {
		getShares();
	}
});

// Backoffice: `allowed` comes from the item permissions, which answer after the mount.
watch(allowed, (value) => {
	if (value) getSharesCount();
});

function onToggle(open: boolean) {
	if (open && shares.value === null) getShares();
}

const badge = computed(() =>
	!loadingCount.value && sharesCount.value > 0 ? abbreviateNumber(sharesCount.value) : false,
);

function shareLink(id: string) {
	return window.location.origin + import.meta.env.BASE_URL + 'shared/' + id;
}

function useShares(collection: Ref<string>, primaryKey: Ref<PrimaryKey>) {
	const shares = ref<Share[] | null>(null);
	const sharesCount = ref(0);
	const error = ref<unknown>(null);
	const loading = ref(false);
	const loadingCount = ref(false);
	const deleting = ref(false);
	const shareToEdit = ref<string | null>(null);
	const shareToSend = ref<Share | null>(null);
	const shareToDelete = ref<Share | null>(null);
	const sending = ref(false);
	const sendEmails = ref('');

	watch([collection, primaryKey], () => allowed.value && refresh());

	const sendPublicLink = computed(() => {
		if (!shareToSend.value) return undefined;
		return shareLink(shareToSend.value.id);
	});

	const filter = () => ({
		_and: [{ collection: { _eq: collection.value } }, { item: { _eq: primaryKey.value } }],
	});

	return {
		shares,
		shareToEdit,
		shareToSend,
		shareToDelete,
		sharesCount,
		loading,
		loadingCount,
		sendPublicLink,
		sendEmails,
		error,
		getShares,
		getSharesCount,
		input,
		send,
		select,
		unselect,
		remove,
		sending,
		deleting,
	};

	async function input(data: Record<string, any>) {
		if (!data) return;

		data['collection'] = collection.value;
		data['item'] = primaryKey.value;

		try {
			if (shareToEdit.value === '+') {
				await sdk.request(requestEndpoint('/shares', { method: 'POST', body: data }));
			} else {
				await sdk.request(requestEndpoint(`/shares/${shareToEdit.value}`, { method: 'PATCH', body: data }));
			}

			await refresh();
			shareToEdit.value = null;
		} catch (err) {
			showUnexpectedError(err);
		}
	}

	function select(id: string) {
		shareToEdit.value = id;
	}

	function unselect() {
		shareToEdit.value = null;
	}

	async function refresh() {
		await getSharesCount();
		await getShares();
	}

	async function getShares() {
		error.value = null;
		loading.value = true;

		try {
			shares.value = await sdk.request<Share[]>(
				requestEndpoint('/shares', { params: { filter: filter(), sort: 'name' } }),
			);
		} catch (err) {
			error.value = err;
		} finally {
			loading.value = false;
		}
	}

	async function getSharesCount() {
		loadingCount.value = true;

		try {
			const response = await sdk.request<{ count: { id: number | string } }[]>(
				requestEndpoint('/shares', { params: { filter: filter(), aggregate: { count: 'id' } } }),
			);

			sharesCount.value = Number(response[0]?.count.id);
		} catch (err) {
			error.value = err;
		} finally {
			loadingCount.value = false;
		}
	}

	async function remove() {
		if (!shareToDelete.value || deleting.value) return;

		deleting.value = true;

		try {
			await sdk.request(requestEndpoint(`/shares/${shareToDelete.value.id}`, { method: 'DELETE' }));
			await refresh();
			shareToDelete.value = null;
		} catch (err) {
			showUnexpectedError(err);
		} finally {
			deleting.value = false;
		}
	}

	async function send() {
		if (!shareToSend.value || loading.value) return;

		sending.value = true;

		try {
			const emailsParsed = sendEmails.value
				.split(/,|\n/)
				.filter((e) => e)
				.map((email) => email.trim());

			await sdk.request(
				requestEndpoint('/shares/invite', {
					method: 'POST',
					body: { emails: emailsParsed, share: shareToSend.value.id },
				}),
			);

			sendEmails.value = '';
			shareToSend.value = null;
		} catch (err) {
			showUnexpectedError(err);
		} finally {
			sending.value = false;
		}
	}
}

async function copy(id: string) {
	try {
		await navigator.clipboard.writeText(shareLink(id));
		notify({ title: t('share_copy_link_success'), type: 'success' });
	} catch {
		notify({ title: t('share_copy_link_error'), type: 'error' });
	}
}
</script>

<template>
	<SidebarDetail v-if="allowed" id="shares" :title="$t('shares')" icon="share" :badge @toggle="onToggle">
		<div class="flex flex-col gap-3">
			<BoNotice v-if="error" type="danger">{{ $t('unexpected_error') }}</BoNotice>

			<BoProgressLinear v-else-if="loading" indeterminate :aria-label="$t('loading')" />

			<p v-else-if="!shares || shares.length === 0" class="py-2 italic">{{ $t('no_shares') }}</p>

			<ShareItem
				v-for="share in shares"
				:key="share.id"
				:share
				@copy="copy(share.id)"
				@edit="select(share.id)"
				@delete="shareToDelete = share"
				@invite="shareToSend = share"
			/>

			<BoButton full-width icon="add" @click="select('+')">{{ $t('new_share') }}</BoButton>
		</div>

		<DrawerItem
			v-if="shareToEdit"
			collection="directus_shares"
			:primary-key="shareToEdit"
			:active="!!shareToEdit"
			@update:active="unselect"
			@input="input"
		/>

		<BoDialog
			:open="!!shareToDelete"
			:title="$t('delete_share')"
			:description="$t('delete_are_you_sure')"
			@update:open="shareToDelete = null"
		>
			<template #actions>
				<BoButton variant="secondary" @click="shareToDelete = null">{{ $t('cancel') }}</BoButton>
				<BoButton variant="danger" :loading="deleting" @click="remove">{{ $t('delete_label') }}</BoButton>
			</template>
		</BoDialog>

		<BoDialog :open="!!shareToSend" :title="$t('share_send_link')" @update:open="shareToSend = null">
			<form :id="sendFormId" class="flex flex-col gap-4" @submit.prevent="send">
				<div class="flex items-end gap-2">
					<div class="min-w-0 flex-1">
						<BoInput :model-value="sendPublicLink ?? ''" readonly :label="$t('share')" />
					</div>
					<BoButton
						variant="secondary"
						icon="content_copy"
						:aria-label="$t('share_copy_link')"
						@click="shareToSend && copy(shareToSend.id)"
					/>
				</div>
				<BoTextarea
					v-model="sendEmails"
					:label="$t('emails')"
					:rows="4"
					placeholder="admin@example.com, user@example.com..."
				/>
			</form>
			<template #actions>
				<BoButton variant="secondary" @click="shareToSend = null">{{ $t('cancel') }}</BoButton>
				<BoButton type="submit" :form="sendFormId" :loading="sending">{{ $t('share_send_link') }}</BoButton>
			</template>
		</BoDialog>
	</SidebarDetail>
</template>
