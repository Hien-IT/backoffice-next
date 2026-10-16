// Ported from directus/app/src/interfaces/_system/system-folder/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemFolder from './SystemFolder.vue';

export default defineInterface({
	id: 'system-folder',
	name: '$t:interfaces.system-folder.folder',
	description: '$t:interfaces.system-folder.description',
	icon: 'folder',
	component: InterfaceSystemFolder,
	types: ['uuid'],
	options: [],
	system: true,
	recommendedDisplays: ['raw'],
});
