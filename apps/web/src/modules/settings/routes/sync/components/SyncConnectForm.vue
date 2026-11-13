<script setup lang="ts">
// Backoffice (spec 032, contracts/web.md "Form kết nối", FR-002, FR-008, FR-034): URL and static admin token of the
// source, the groups to compare. The token field is a password field the browser is asked not to keep; nothing here is
// stored (the parent owns the refs and clears them).
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../../../components/BoButton.vue';
import BoCheckbox from '../../../../../components/BoCheckbox.vue';
import BoInput from '../../../../../components/BoInput.vue';
import { GROUP_KEYS, type GroupKey } from '../types.ts';

const url = defineModel<string>('url', { required: true });
const token = defineModel<string>('token', { required: true });
const groups = defineModel<GroupKey[]>('groups', { required: true });

defineProps<{ busy: boolean }>();
const emit = defineEmits<{ compare: [] }>();

const { t } = useI18n();

const urlInvalid = computed(() => url.value.trim() !== '' && !/^https?:\/\/\S+$/i.test(url.value.trim()));
const valid = computed(
	() => !urlInvalid.value && url.value.trim() !== '' && token.value !== '' && groups.value.length > 0,
);

function setGroup(group: GroupKey, on: boolean | null) {
	const next = new Set(groups.value);
	if (on) next.add(group);
	else next.delete(group);
	groups.value = GROUP_KEYS.filter((g) => next.has(g));
}
</script>

<template>
	<form class="flex flex-col gap-5" :aria-busy="busy || undefined" @submit.prevent="valid && emit('compare')">
		<div class="grid gap-4 md:grid-cols-2">
			<BoInput
				v-model="url"
				type="url"
				inputmode="url"
				autocomplete="off"
				:label="t('sync_source_url')"
				placeholder="https://stg.example.com"
				:invalid="urlInvalid"
				v-bind="urlInvalid ? { error: t('sync_error_url') } : {}"
				:disabled="busy"
			/>
			<BoInput v-model="token" type="password" autocomplete="off" :label="t('sync_source_token')" :disabled="busy" />
		</div>

		<fieldset class="m-0 min-w-0 border-0 p-0">
			<legend class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('sync_groups') }}</legend>
			<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
				<BoCheckbox
					v-for="group in GROUP_KEYS"
					:key="group"
					:model-value="groups.includes(group)"
					:label="t(`sync_group_${group}`)"
					:disabled="busy"
					@update:model-value="setGroup(group, $event)"
				/>
			</div>
		</fieldset>

		<div>
			<BoButton type="submit" icon="compare_arrows" :loading="busy" :disabled="!valid">
				{{ t('sync_compare') }}
			</BoButton>
		</div>
	</form>
</template>
