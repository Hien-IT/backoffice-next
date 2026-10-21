<!-- Ported from directus/app/src/components/v-breadcrumb.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): v-breadcrumb with RouterLink sections in the page header's subdued text colors;
// a disabled section is plain text.
import { RouterLink } from 'vue-router';
import BoIcon from '../../components/BoIcon.vue';

interface Breadcrumb {
	to: string;
	name: string;
	disabled?: boolean;
	icon?: string;
}

withDefaults(
	defineProps<{
		/** An array of objects which information about each section */
		items?: Breadcrumb[];
	}>(),
	{ items: () => [] },
);

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<span class="v-breadcrumb flex items-center text-theme-sm text-gray-500 dark:text-gray-400">
		<template v-for="(item, index) in items" :key="item.name">
			<BoIcon v-if="index > 0" name="chevron_right" size="sm" class="mx-1" />
			<RouterLink
				v-if="!item.disabled"
				:to="item.to"
				class="inline-flex items-center gap-0.5 rounded no-underline hover:text-gray-800 dark:hover:text-white/90"
				:class="FOCUS"
			>
				<BoIcon v-if="item.icon" :name="item.icon" size="sm" />
				{{ item.name }}
			</RouterLink>
			<span v-else class="inline-flex items-center gap-0.5">
				<BoIcon v-if="item.icon" :name="item.icon" size="sm" />
				{{ item.name }}
			</span>
		</template>
	</span>
</template>
