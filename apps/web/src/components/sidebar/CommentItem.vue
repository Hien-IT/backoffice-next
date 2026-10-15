<!-- Ported from directus/app/src/views/private/components/comment-item.vue -->
<script setup lang="ts">
// Backoffice: recipe "Comments and shares" (Q-11): the text is `whitespace-pre-wrap` plain text, not markdown (v-md):
// `display` is the comment through DOMPurify with no tag plus the `<mark>` of the mentions (FR-110b). The unused
// saveEdits of Directus is left out: CommentInput saves the edit.
import type { Comment, User } from '@directus/types';
import { ref } from 'vue';
import CommentInput from './CommentInput.vue';
import CommentItemHeader from './CommentItemHeader.vue';

defineProps<{
	comment: Comment & {
		display: string;
		user_created: Pick<User, 'id' | 'email' | 'first_name' | 'last_name' | 'avatar'>;
	};
	refresh: () => Promise<void>;
	collection: string;
	primaryKey: string | number;
}>();

const editing = ref(false);
</script>

<template>
	<article class="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
		<CommentItemHeader :refresh :comment @edit="editing = true" />

		<CommentInput
			v-if="editing"
			:existing-comment="comment"
			:primary-key="primaryKey"
			:collection
			:refresh
			@cancel="editing = false"
		/>

		<!-- DOMPurify with no tag; only the mention <mark>s with escaped names are added (FR-110b). -->
		<!-- eslint-disable vue/no-v-html -->
		<p
			v-else
			class="max-h-64 overflow-y-auto text-theme-sm break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300"
			v-html="comment.display"
		/>
		<!-- eslint-enable vue/no-v-html -->
	</article>
</template>
