// Parity fixture (specs/020 data-model §9): an interface extension using v-input, v-select, v-menu, v-tooltip,
// useApi and useStores.
import InterfaceComponent from './interface.vue';

export default {
	id: 'parity-interface-color',
	name: 'Parity Color',
	icon: 'palette',
	description: 'Pick a color name (parity fixture)',
	component: InterfaceComponent,
	types: ['string'],
	options: [
		{
			field: 'placeholder',
			name: 'Placeholder',
			type: 'string',
			meta: { width: 'full', interface: 'input' },
		},
	],
};
