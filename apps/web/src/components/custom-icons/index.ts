// Ported from directus/app/src/components/v-icon/custom-icons.ts
// Backoffice: keyed by the icon name (Directus builds `CustomIcon<PascalName>` from it).
import type { Component } from 'vue';
import CustomIconBookmarkSave from './CustomIconBookmarkSave.vue';
import CustomIconBox from './CustomIconBox.vue';
import CustomIconCommitNode from './CustomIconCommitNode.vue';
import CustomIconDirectus from './CustomIconDirectus.vue';
import CustomIconFlipHorizontal from './CustomIconFlipHorizontal.vue';
import CustomIconFlipVertical from './CustomIconFlipVertical.vue';
import CustomIconFolderLock from './CustomIconFolderLock.vue';
import CustomIconFolderMove from './CustomIconFolderMove.vue';
import CustomIconGrid1 from './CustomIconGrid1.vue';
import CustomIconGrid2 from './CustomIconGrid2.vue';
import CustomIconGrid3 from './CustomIconGrid3.vue';
import CustomIconGrid4 from './CustomIconGrid4.vue';
import CustomIconGrid5 from './CustomIconGrid5.vue';
import CustomIconGrid6 from './CustomIconGrid6.vue';
import CustomIconLogout from './CustomIconLogout.vue';
import CustomIconNetlify from './CustomIconNetlify.vue';
import CustomIconSignalWifi1Bar from './CustomIconSignalWifi1Bar.vue';
import CustomIconSignalWifi2Bar from './CustomIconSignalWifi2Bar.vue';
import CustomIconSignalWifi3Bar from './CustomIconSignalWifi3Bar.vue';
import CustomIconVercel from './CustomIconVercel.vue';

export const customIcons: Record<string, Component> = {
	bookmark_save: CustomIconBookmarkSave,
	box: CustomIconBox,
	commit_node: CustomIconCommitNode,
	directus: CustomIconDirectus,
	flip_horizontal: CustomIconFlipHorizontal,
	flip_vertical: CustomIconFlipVertical,
	folder_lock: CustomIconFolderLock,
	folder_move: CustomIconFolderMove,
	grid_1: CustomIconGrid1,
	grid_2: CustomIconGrid2,
	grid_3: CustomIconGrid3,
	grid_4: CustomIconGrid4,
	grid_5: CustomIconGrid5,
	grid_6: CustomIconGrid6,
	logout: CustomIconLogout,
	netlify: CustomIconNetlify,
	signal_wifi_1_bar: CustomIconSignalWifi1Bar,
	signal_wifi_2_bar: CustomIconSignalWifi2Bar,
	signal_wifi_3_bar: CustomIconSignalWifi3Bar,
	vercel: CustomIconVercel,
};
