<!-- Ported from directus/app/src/modules/files/components/file-info-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: recipe "File page and file details" (Q-15): a `dl` in the SidebarDetail section; dates in the short
// form with the long form in a BoTooltip; the owner and editor requests that fail leave their row out (Directus does
// not catch them either, CHK013); only the five EXIF rows of Directus (no other metadata such as GPS, CHK085); the
// "open in new window" link text already says it opens a new window (layout-patterns §7).
import type { File } from '@directus/types';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoButton from '../../../components/BoButton.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoTooltip from '../../../components/BoTooltip.vue';
import UserPopover from '../../../components/render/UserPopover.vue';
import SidebarDetail from '../../../components/sidebar/SidebarDetail.vue';
import { useClipboard } from '../../../composables/use-clipboard.ts';
import { formatFilesize } from '../../../utils/format-filesize.ts';
import { getAssetUrl } from '../../../utils/get-asset-url.ts';
import { localizedFormat } from '../../../utils/localized-format.ts';
import { readableMimeType } from '../../../utils/readable-mime-type.ts';
import { userName } from '../../../utils/user-name.ts';

const props = defineProps<{
	file: File | null;
	isNew: boolean;
}>();

const { t, n, d } = useI18n();
const { userCreated, userModified } = useUser();
const { folder, folderLink } = useFolder();

const size = computed(() => {
	if (props.isNew) return;
	if (!props.file?.filesize) return;

	return formatFilesize(Number(props.file.filesize));
});

const fileLink = computed(() => {
	if (!props.file?.id) return;

	return getAssetUrl(props.file.id);
});

const dates = (value: string | Date | null | undefined) => {
	if (!value) return;

	return {
		short: localizedFormat(new Date(value), String(t('date-fns_date_short'))),
		long: d(new Date(value), 'long'),
	};
};

const creationDate = computed(() => dates(props.file?.created_on));
const uploadDate = computed(() => dates(props.file?.uploaded_on));
const modificationDate = computed(() => dates(props.file?.modified_on));

const imageMetadata = computed(() => {
	const metadata = props.file?.metadata as
		| { ifd0?: Record<string, any>; exif?: Record<string, any> }
		| null
		| undefined;

	if (!metadata) return;

	const { ifd0, exif } = metadata;

	return {
		Make: ifd0?.['Make'],
		Model: ifd0?.['Model'],
		FNumber: exif?.['FNumber'],
		ExposureTime: exif?.['ExposureTime'],
		FocalLength: exif?.['FocalLength'],
		ISO: exif?.['ISO'] ?? exif?.['ISOSpeedRatings'],
	};
});

const hasImageMetadata = computed(
	() => !!imageMetadata.value && Object.values(imageMetadata.value).some((value) => value !== undefined),
);

function useUser() {
	type User = {
		id: string;
		name: string;
		link: string;
	};

	const userCreated = ref<User>();
	const userModified = ref<User>();

	watch(() => props.file, fetchUser, { immediate: true });

	return { userCreated, userModified };

	async function readUser(id: string): Promise<User | undefined> {
		try {
			const user = await sdk.request(
				requestEndpoint<Record<string, any>>(`/users/${id}`, {
					method: 'GET',
					params: { fields: ['id', 'email', 'first_name', 'last_name', 'role'] },
				}),
			);

			return { id, name: userName(user), link: `/users/${user['id']}` };
		} catch {
			return undefined;
		}
	}

	async function fetchUser() {
		// Backoffice: keep the file of this call; `props.file` can be null after the await (the page was left).
		const file = props.file;
		if (!file) return;
		if (!file.uploaded_by) return;

		userCreated.value = await readUser(file.uploaded_by as string);

		if (file.modified_by) {
			userModified.value = await readUser(file.modified_by as string);
		}
	}
}

function useFolder() {
	type Folder = {
		id: string;
		name: string;
	};

	const folder = ref<Folder | null>(null);

	const folderLink = computed(() => {
		if (folder.value === null) {
			return `/files`;
		}

		return `/files/folders/${folder.value.id}`;
	});

	watch(() => props.file, fetchFolder, { immediate: true });

	return { folder, folderLink };

	async function fetchFolder() {
		if (!props.file) return;

		if (!props.file.folder) {
			folder.value = null;
			return;
		}

		try {
			const { name } = await sdk.request(
				requestEndpoint<{ name: string }>(`/folders/${props.file.folder}`, {
					method: 'GET',
					params: { fields: ['id', 'name'] },
				}),
			);

			folder.value = { id: props.file.folder as string, name };
		} catch {
			folder.value = null;
		}
	}
}

const { copyToClipboard } = useClipboard();

async function copyFileId() {
	if (!props.file?.id) return;

	await copyToClipboard(props.file.id, {
		success: t('copy_id_success'),
		fail: t('copy_id_fail'),
	});
}

const ROW = 'grid grid-cols-[7rem_1fr] gap-x-3';
const DT = 'text-gray-500 dark:text-gray-400';
const DD = 'm-0 break-words text-gray-800 dark:text-white/90';
const LINK = 'text-brand-500 underline-offset-2 hover:underline dark:text-brand-400';
</script>

<template>
	<SidebarDetail id="file-info" icon="info" :title="$t('file_details')">
		<dl v-if="file" class="m-0 flex flex-col gap-2 text-theme-sm">
			<div v-if="file.type" :class="ROW">
				<dt :class="DT">{{ $t('type') }}</dt>
				<dd :class="DD">{{ readableMimeType(file.type) || file.type }}</dd>
			</div>

			<div v-if="file.width && file.height" :class="ROW">
				<dt :class="DT">{{ $t('dimensions') }}</dt>
				<dd :class="DD">{{ n(file.width) }} × {{ n(file.height) }}</dd>
			</div>

			<div v-if="file.duration" :class="ROW">
				<dt :class="DT">{{ $t('duration') }}</dt>
				<dd :class="DD">{{ n(file.duration) }}</dd>
			</div>

			<div v-if="file.filesize" :class="ROW">
				<dt :class="DT">{{ $t('size') }}</dt>
				<dd :class="DD">{{ size }}</dd>
			</div>

			<div v-if="file.charset" :class="ROW">
				<dt :class="DT">{{ $t('charset') }}</dt>
				<dd :class="DD">{{ file.charset }}</dd>
			</div>

			<div v-if="file.embed" :class="ROW">
				<dt :class="DT">{{ $t('embed') }}</dt>
				<dd :class="DD">{{ file.embed }}</dd>
			</div>

			<div v-if="creationDate" :class="ROW">
				<dt :class="DT">{{ $t('created') }}</dt>
				<dd :class="DD">
					<BoTooltip :text="creationDate.long"><span tabindex="0">{{ creationDate.short }}</span></BoTooltip>
				</dd>
			</div>

			<div v-if="userCreated" :class="ROW">
				<dt :class="DT">{{ $t('owner') }}</dt>
				<dd :class="DD">
					<UserPopover :user="userCreated.id">
						<RouterLink :to="userCreated.link" :class="LINK">{{ userCreated.name }}</RouterLink>
					</UserPopover>
				</dd>
			</div>

			<div v-if="uploadDate" :class="ROW">
				<dt :class="DT">{{ $t('uploaded') }}</dt>
				<dd :class="DD">
					<BoTooltip :text="uploadDate.long"><span tabindex="0">{{ uploadDate.short }}</span></BoTooltip>
				</dd>
			</div>

			<div v-if="modificationDate" :class="ROW">
				<dt :class="DT">{{ $t('modified') }}</dt>
				<dd :class="DD">
					<BoTooltip :text="modificationDate.long"><span tabindex="0">{{ modificationDate.short }}</span></BoTooltip>
				</dd>
			</div>

			<div v-if="userModified" :class="ROW">
				<dt :class="DT">{{ $t('edited_by') }}</dt>
				<dd :class="DD">
					<UserPopover :user="userModified.id">
						<RouterLink :to="userModified.link" :class="LINK">{{ userModified.name }}</RouterLink>
					</UserPopover>
				</dd>
			</div>

			<div v-if="fileLink" :class="ROW">
				<dt :class="DT">{{ $t('file') }}</dt>
				<dd :class="DD">
					<a :href="fileLink" target="_blank" rel="noopener noreferrer" :class="LINK">
						{{ $t('open_in_new_window') }}
						<BoIcon name="open_in_new" size="sm" aria-hidden="true" />
					</a>
				</dd>
			</div>

			<div :class="ROW">
				<dt :class="DT">{{ $t('folder') }}</dt>
				<dd :class="DD">
					<RouterLink :to="folderLink" :class="LINK">
						{{ $t('open_folder', { folder: folder ? folder.name : $t('file_library') }) }}
					</RouterLink>
				</dd>
			</div>

			<div v-if="file?.id" :class="ROW" class="items-center">
				<dt :class="DT">{{ $t('copy_id') }}</dt>
				<dd :class="DD">
					<BoButton variant="ghost" icon="content_copy" :aria-label="$t('copy_id')" @click="copyFileId" />
				</dd>
			</div>

			<template v-if="hasImageMetadata && imageMetadata">
				<div class="my-1 h-px bg-gray-200 dark:bg-gray-800" role="separator" />

				<div v-if="imageMetadata.Make && imageMetadata.Model" :class="ROW">
					<dt :class="DT">{{ $t('camera') }}</dt>
					<dd :class="DD">{{ imageMetadata.Make }} {{ imageMetadata.Model }}</dd>
				</div>

				<div v-if="imageMetadata.FNumber" :class="ROW">
					<dt :class="DT">{{ $t('exposure') }}</dt>
					<dd :class="DD">ƒ/{{ imageMetadata.FNumber }}</dd>
				</div>

				<div v-if="imageMetadata.ExposureTime" :class="ROW">
					<dt :class="DT">{{ $t('shutter') }}</dt>
					<dd :class="DD">1/{{ Math.round(1 / +imageMetadata.ExposureTime) }} {{ $t('second') }}</dd>
				</div>

				<div v-if="imageMetadata.FocalLength" :class="ROW">
					<dt :class="DT">{{ $t('focal_length') }}</dt>
					<dd :class="DD">{{ imageMetadata.FocalLength }}mm</dd>
				</div>

				<div v-if="imageMetadata.ISO" :class="ROW">
					<dt :class="DT">{{ $t('iso') }}</dt>
					<dd :class="DD">{{ imageMetadata.ISO }}</dd>
				</div>
			</template>
		</dl>
	</SidebarDetail>
</template>
