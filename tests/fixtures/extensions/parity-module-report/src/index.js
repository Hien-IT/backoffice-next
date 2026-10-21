// Parity fixture (specs/020 data-model §9): a module extension rendered in private-view.
import ModuleComponent from './module.vue';

export default {
	id: 'parity-module-report',
	name: 'Parity Report',
	icon: 'summarize',
	routes: [{ path: '', component: ModuleComponent }],
	preRegisterCheck(user) {
		return user.admin_access === true;
	},
};
