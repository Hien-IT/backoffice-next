<!-- Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/components/extension-install.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-43, R-60): full-width BoButtons; at the extensions limit the disabled install button sits in a
// focusable wrapper so the tooltip still opens (a disabled button gets no pointer or focus events). Errors open the
// error dialog (showUnexpectedError, D-66).
import { computed, ref } from 'vue';
import BoButton from '../../../../../components/BoButton.vue';
import BoTooltip from '../../../../../components/BoTooltip.vue';
import { showUnexpectedError } from '../../../../../composables/use-notices.ts';
import { useExtensionsStore } from '../../../../../stores/extensions.ts';
import { useServerStore } from '../../../../../stores/server.ts';

const props = defineProps<{ extensionId: string; versionId: string }>();

const extensionsStore = useExtensionsStore();
const serverStore = useServerStore();

const installed = computed(() => {
	return extensionsStore.extensionIds.includes(props.extensionId);
});

const installing = ref(false);

const install = async () => {
	if (installing.value) return;

	installing.value = true;

	try {
		await extensionsStore.install(props.extensionId, props.versionId);
	} catch (err) {
		showUnexpectedError(err);
	}

	installing.value = false;
};

const limit = computed(() => {
	const limit = serverStore.info.extensions?.limit;
	return limit ?? -1;
});

const atLimit = computed(() => {
	if (limit.value === -1) return false;
	const installedNumber = extensionsStore.extensions.length;
	return installedNumber >= limit.value;
});
</script>

<template>
	<BoButton v-if="installed" icon="settings" full-width align="start" :to="{ name: 'settings-extensions' }">
		{{ $t('manage') }}
	</BoButton>

	<BoTooltip v-else-if="atLimit" :text="$t('reached_maximum_number_of_extensions', { n: limit })">
		<span tabindex="0" class="block rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500">
			<BoButton icon="download" full-width align="start" disabled>{{ $t('install_extension') }}</BoButton>
		</span>
	</BoTooltip>

	<BoButton v-else icon="download" full-width align="start" :loading="installing" @click="install">
		{{ $t('install_extension') }}
	</BoButton>
</template>
