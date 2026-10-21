// Ported from directus/app/src/directives/markdown.ts
import type { Directive, DirectiveBinding } from 'vue';
import { md } from '../../utils/markdown.ts';

const Markdown: Directive = {
	beforeMount: markdown,
	updated: markdown,
};

function markdown(el: Element, binding: DirectiveBinding) {
	if (typeof binding.value === 'object' && 'value' in binding.value) {
		el.innerHTML = md(binding.value.value, binding.value);
	} else {
		el.innerHTML = md(binding.value ?? '');
	}
}

export default Markdown;
