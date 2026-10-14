<!-- Ported from directus/app/src/displays/user/user.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import UserPopover from '../../components/render/UserPopover.vue';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import { userName } from '../../utils/user-name.ts';

type User = {
	id: string;
	email?: string | null;
	first_name?: string | null;
	last_name?: string | null;
	avatar?: { id: string; modified_on?: string | null } | null;
};

const props = withDefaults(
	defineProps<{
		value: User | null;
		display?: 'avatar' | 'name' | 'both';
		circle?: boolean;
	}>(),
	{
		display: 'both',
	},
);

const src = computed(() => {
	if (props.value === null || !props.value.avatar?.id) return null;

	return getAssetUrl(props.value.avatar.id, {
		imageKey: 'system-small-cover',
		cacheBuster: props.value.avatar.modified_on ?? false,
	});
});
</script>

<template>
	<UserPopover v-if="value" :user="value.id">
		<div class="user inline-flex h-full items-center gap-2 align-middle" :class="display">
			<img
				v-if="(display === 'avatar' || display === 'both') && src"
				:src="src"
				loading="lazy"
				role="presentation"
				:alt="value && userName(value)"
				class="inline-block h-full w-auto"
				:class="circle ? 'circle rounded-full' : 'rounded'"
			/>
			<!-- Backoffice: the Avatar recipe fallback icon stands in for avatar-placeholder.svg. -->
			<BoIcon
				v-else-if="(display === 'avatar' || display === 'both') && src === null"
				name="account_circle"
				class="placeholder text-gray-500 dark:text-gray-400"
				v-bind="display === 'avatar' ? { label: userName(value) } : {}"
			/>
			<span v-if="display === 'name' || display === 'both'" class="truncate">{{ userName(value) }}</span>
		</div>
	</UserPopover>
</template>
