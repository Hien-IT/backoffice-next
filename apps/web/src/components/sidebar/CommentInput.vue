<!-- Ported from directus/app/src/views/private/components/comment-input.vue -->
<script setup lang="ts">
// Backoffice: recipe "Comments and shares" (Q-11): a BoTextarea instead of v-template-input, so a mention shows as
// `@<uuid>` while typing (the name is shown once posted) and the `previews` prop is not needed; no emoji picker and no
// mention button (typing `@` opens the suggestions). The suggestions are a listbox under the field driven by
// Up/Down/Enter/Esc with aria-activedescendant; an older `/users` answer is dropped instead of cancelling it with axios.
// Ctrl/Cmd + Enter posts from the field (keydown, like useShortcut 'meta+enter'). A saved edit emits `cancel` so the
// comment leaves edit mode.
import type { Comment } from '@directus/types';
import { throttle } from 'lodash-es';
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { notify, showUnexpectedError } from '../../composables/use-notices.ts';
import type { AppUser } from '../../types/user.ts';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import { userName } from '../../utils/user-name.ts';
import BoButton from '../BoButton.vue';
import BoIcon from '../BoIcon.vue';
import BoTextarea from '../BoTextarea.vue';
import BoTooltip from '../BoTooltip.vue';

type UserPreview = Pick<AppUser, 'id' | 'email' | 'first_name' | 'last_name'> & {
	avatar: { id: string; modified_on: string | null } | null;
};

const props = withDefaults(
	defineProps<{
		refresh: () => Promise<void>;
		collection: string;
		primaryKey: string | number;
		existingComment?: Comment | null;
	}>(),
	{
		existingComment: null,
	},
);

const emit = defineEmits<{ cancel: [] }>();

const { t } = useI18n();
const root = useTemplateRef('root');
const listId = useId();

const newCommentContent = ref<string | null>(props.existingComment?.comment ?? null);

watch(
	() => props.existingComment,
	() => {
		if (props.existingComment?.comment) newCommentContent.value = props.existingComment.comment;
	},
	{ immediate: true },
);

const saving = ref(false);
const showMentionDropDown = ref(false);
const searchResult = ref<UserPreview[]>([]);
const selectedKeyboardIndex = ref(0);

const listOpen = computed(() => showMentionDropDown.value && searchResult.value.length > 0);
const isEmpty = computed(() => !newCommentContent.value || newCommentContent.value.trim() === '');

/** Index of the `@` that opened the suggestions. */
let triggerPosition = 0;
let lastSearch = 0;

const textarea = () => root.value?.querySelector('textarea') ?? null;

const loadUsers = throttle(async (name: string) => {
	const search = ++lastSearch;

	const regex = /\s@[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}/gi;

	let filter: Record<string, any> = {
		_or: [
			{ first_name: { _starts_with: name } },
			{ last_name: { _starts_with: name } },
			{ email: { _starts_with: name } },
		],
	};

	if (name.match(regex)) filter = { id: { _in: name } };

	try {
		const users = await sdk.request<UserPreview[]>(
			requestEndpoint('/users', {
				params: {
					...(name ? { filter } : {}),
					fields: ['first_name', 'last_name', 'email', 'id', 'avatar.id', 'avatar.modified_on'],
				},
			}),
		);

		if (search === lastSearch) searchResult.value = users;
	} catch {
		// Directus returns the error: no suggestions.
	}
}, 200);

function onInput() {
	const element = textarea();
	if (!element) return;

	const caret = element.selectionStart;
	const match = /(?:^|\s)@([^\s@]*)$/.exec(element.value.slice(0, caret));

	if (!match) {
		showMentionDropDown.value = false;
		return;
	}

	triggerPosition = caret - match[1]!.length - 1;
	showMentionDropDown.value = true;
	selectedKeyboardIndex.value = 0;
	loadUsers(match[1]!);
}

function insertUser(user: UserPreview) {
	const text = newCommentContent.value ?? '';
	let end = triggerPosition;

	while (end < text.length && !/\s/.test(text.charAt(end))) end++;

	// Directus: the mention always starts with a space, which the display regex (`\s@<uuid>`) needs.
	const before = text.slice(0, triggerPosition).replace(/ $/, '') + ' @' + user.id;
	newCommentContent.value = before + text.slice(end);
	showMentionDropDown.value = false;

	nextTick(() => {
		textarea()?.focus();
		textarea()?.setSelectionRange(before.length, before.length);
	});
}

function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
		event.preventDefault();
		postComment();
		return;
	}

	if (!listOpen.value) return;

	if (event.key === 'ArrowDown') {
		event.preventDefault();
		if (selectedKeyboardIndex.value < searchResult.value.length - 1) selectedKeyboardIndex.value++;
	} else if (event.key === 'ArrowUp') {
		event.preventDefault();
		if (selectedKeyboardIndex.value > 0) selectedKeyboardIndex.value--;
	} else if (event.key === 'Enter') {
		event.preventDefault();
		insertUser(searchResult.value[selectedKeyboardIndex.value]!);
	} else if (event.key === 'Escape') {
		event.preventDefault();
		event.stopPropagation();
		showMentionDropDown.value = false;
	}
}

function cancel() {
	if (props.existingComment) {
		emit('cancel');
	} else {
		newCommentContent.value = '';
	}
}

function avatarSource(avatar: UserPreview['avatar']) {
	if (!avatar) return '';

	return getAssetUrl(avatar.id, { imageKey: 'system-small-cover', cacheBuster: avatar.modified_on ?? false });
}

async function postComment() {
	if (isEmpty.value || saving.value) return;
	saving.value = true;

	try {
		if (props.existingComment) {
			await sdk.request(
				requestEndpoint(`/comments/${props.existingComment.id}`, {
					method: 'PATCH',
					body: { comment: newCommentContent.value },
				}),
			);
		} else {
			await sdk.request(
				requestEndpoint('/comments', {
					method: 'POST',
					body: { collection: props.collection, item: props.primaryKey, comment: newCommentContent.value },
				}),
			);
		}

		props.refresh();

		newCommentContent.value = '';

		notify({ title: props.existingComment ? t('post_comment_updated') : t('post_comment_success'), type: 'success' });

		if (props.existingComment) emit('cancel');
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<div ref="root" class="relative">
		<BoTextarea
			v-model="newCommentContent"
			:rows="3"
			class="min-h-20"
			:placeholder="$t('leave_comment')"
			:aria-label="$t('leave_comment')"
			aria-autocomplete="list"
			:aria-controls="listOpen ? listId : undefined"
			:aria-activedescendant="listOpen ? `${listId}-${selectedKeyboardIndex}` : undefined"
			@input="onInput"
			@keydown="onKeydown"
			@blur="showMentionDropDown = false"
		/>

		<ul
			v-if="listOpen"
			:id="listId"
			role="listbox"
			:aria-label="$t('users')"
			class="absolute inset-x-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
		>
			<li
				v-for="(user, index) in searchResult"
				:id="`${listId}-${index}`"
				:key="user.id"
				role="option"
				:aria-selected="index === selectedKeyboardIndex"
				class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-theme-sm"
				:class="
					index === selectedKeyboardIndex
						? 'bg-gray-100 text-gray-800 dark:bg-white/5 dark:text-white/90'
						: 'text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5'
				"
				@mousedown.prevent="insertUser(user)"
			>
				<span
					class="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
				>
					<img v-if="user.avatar" :src="avatarSource(user.avatar)" alt="" class="size-full object-cover" />
					<BoIcon v-else name="person" size="sm" />
				</span>
				<span class="min-w-0 flex-1 truncate">{{ userName(user) }}</span>
				<span v-if="user.email" class="min-w-0 truncate text-theme-xs text-gray-500 dark:text-gray-400">
					{{ user.email }}
				</span>
			</li>
		</ul>

		<div class="mt-2 flex items-center justify-end gap-2">
			<BoButton v-if="existingComment || !isEmpty" variant="secondary" @click="cancel">{{ $t('cancel') }}</BoButton>
			<BoTooltip :text="$t('comment_submit_shortcut')">
				<BoButton icon="send" :aria-label="$t('submit')" :disabled="isEmpty" :loading="saving" @click="postComment" />
			</BoTooltip>
		</div>
	</div>
</template>
