// Ported from directus/app/src/interfaces/_system/system-collections-translations/index.ts
import { defineInterface } from '../../types.ts';
import SystemCollectionsTranslations from './SystemCollectionsTranslations.vue';

export default defineInterface({
	id: 'system-collections-translations',
	name: '$t:enable_translations',
	icon: 'translate',
	component: SystemCollectionsTranslations,
	system: true,
	types: ['alias'],
	options: [],
	hideLabel: true,
});
