// Parity fixture (specs/020 data-model §9): the app side of a hybrid operation.
export default {
	id: 'parity-operation-slack',
	name: 'Parity Slack',
	icon: 'forum',
	description: 'Sends a message (parity fixture)',
	overview: ({ text }) => [{ label: 'Text', text: text ?? '' }],
	options: [
		{
			field: 'text',
			name: 'Text',
			type: 'string',
			meta: { width: 'full', interface: 'input' },
		},
	],
};
