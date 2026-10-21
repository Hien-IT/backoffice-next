// Ported from directus/app/src/stores/extensions.ts
// Backoffice: api (axios) -> sdk (012 FR-001); the "reload required" notice goes through notify (in-place notice, D-66);
// APP_OR_HYBRID_EXTENSION_TYPES of @directus/constants is the list below (the web app does not depend on it).
import type { ApiOutput } from '@directus/types';
import { isIn } from '@directus/utils';
import { isEqual } from 'lodash-es';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { notify } from '../composables/use-notices.ts';
import { i18n } from '../lang/index.ts';

const APP_OR_HYBRID_EXTENSION_TYPES = [
	'interface',
	'display',
	'layout',
	'module',
	'panel',
	'theme',
	'operation',
] as const;

const getEnabledBrowserExtensions = (extensions: ApiOutput[]) => {
	const enabledIds: string[] = [];

	for (const extension of extensions) {
		if (!extension.schema || !extension.schema.type) continue;

		if (isIn(extension.schema.type, APP_OR_HYBRID_EXTENSION_TYPES) && extension.meta.enabled) {
			enabledIds.push(extension.id);
		}

		if (extension.schema.type === 'bundle') {
			const nested = extensions.filter((child) => child.bundle === extension.id);
			const enabled = getEnabledBrowserExtensions(nested);

			enabledIds.push(...enabled);

			if ('partial' in extension.schema && extension.schema.partial === false && enabled.length > 0) {
				enabledIds.push(extension.id);
			}
		}
	}

	return enabledIds;
};

export const useExtensionsStore = defineStore('extensions', () => {
	const { t } = i18n.global;

	const loading = ref(false);
	const error = ref<unknown>(null);
	const extensions = ref<ApiOutput[]>([]);
	const reloadNotificationVisible = ref(false);

	const refresh = async (forceRefresh = true) => {
		loading.value = true;

		const currentlyEnabledBrowserExtensions = getEnabledBrowserExtensions(extensions.value);

		try {
			extensions.value = await sdk.request(requestEndpoint<ApiOutput[]>('/extensions', { method: 'GET' }));

			const newEnabledBrowserExtensions = getEnabledBrowserExtensions(extensions.value);

			if (
				forceRefresh &&
				isEqual(currentlyEnabledBrowserExtensions, newEnabledBrowserExtensions) === false &&
				!reloadNotificationVisible.value
			) {
				notify({
					id: 'reload-required',
					title: t('reload_required'),
					text: t('extension_reload_required_copy'),
					type: 'warning',
					dialog: false,
					persist: true,
					alwaysShowText: true,
					dismissIcon: 'refresh',
					dismissText: t('extension_reload_now'),
					dismissAction: () => {
						window.location.reload();
					},
				});

				reloadNotificationVisible.value = true;
			}
		} catch (err) {
			error.value = err;
		} finally {
			loading.value = false;
		}
	};

	const toggleState = async (id: string) => {
		const extension = extensions.value.find((ext) => ext.id === id);

		if (!extension) throw new Error(`Extension with ID ${id} does not exist`);

		const current = extension.meta.enabled;
		const endpoint = `/extensions/${id}`;

		await sdk.request(requestEndpoint(endpoint, { method: 'PATCH', body: { meta: { enabled: !current } } }));

		await refresh();
	};

	const install = async (extensionId: string, versionId: string) => {
		await sdk.request(
			requestEndpoint('/extensions/registry/install', {
				method: 'POST',
				body: { extension: extensionId, version: versionId },
			}),
		);

		await refresh();
	};

	const uninstall = async (extensionId: string) => {
		await sdk.request(requestEndpoint(`/extensions/registry/uninstall/${extensionId}`, { method: 'DELETE' }));
		await refresh();
	};

	const reinstall = async (extensionId: string) => {
		await sdk.request(
			requestEndpoint(`/extensions/registry/reinstall`, { method: 'POST', body: { extension: extensionId } }),
		);
		await refresh();
	};

	const remove = async (extensionId: string) => {
		await sdk.request(requestEndpoint(`/extensions/${extensionId}`, { method: 'DELETE' }));
		await refresh();
	};

	const extensionIds = computed(() => extensions.value.map((ext) => ext.id));

	refresh(false);

	return { extensions, extensionIds, loading, error, refresh, toggleState, install, uninstall, reinstall, remove };
});
