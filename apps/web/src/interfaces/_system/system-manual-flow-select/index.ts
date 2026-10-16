// Ported from directus/app/src/interfaces/_system/system-manual-flow-select/index.ts
import { defineInterface } from '../../types.ts';
import SystemManualFlowSelect from './SystemManualFlowSelect.vue';

export default defineInterface({
	id: 'system-manual-flow-select',
	name: '$t:interfaces.flow-select.flow-select',
	icon: 'arrow_drop_down_circle',
	component: SystemManualFlowSelect,
	types: ['string'],
	system: true,
	options: [],
});
