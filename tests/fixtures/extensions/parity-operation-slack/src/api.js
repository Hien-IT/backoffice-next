// Parity fixture (specs/020 data-model §9): the API side of a hybrid operation.
export default {
	id: 'parity-operation-slack',
	handler: ({ text }, { data }) => ({ sent: text ?? null, trigger: data?.$trigger?.body ?? null }),
};
