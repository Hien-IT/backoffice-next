// Parity fixture (specs/020 data-model §9): the app side of the sandboxed operation.
export default {
	id: 'parity-operation-sandbox',
	name: 'Parity Sandbox',
	icon: 'shield',
	description: 'Echoes its text option (parity fixture)',
	overview: ({ text }) => [{ label: 'Text', text: text ?? '' }],
	options: [{ field: 'text', name: 'Text', type: 'string', meta: { width: 'full', interface: 'input' } }],
};
