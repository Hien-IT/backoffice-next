// Ported from directus/app/src/directives/register.ts
import type { App } from 'vue';
import ClickOutside from './click-outside.ts';
import ContextMenu from './context-menu.ts';
import Focus from './focus.ts';
import InputAutoWidth from './input-auto-width.ts';
import Markdown from './markdown.ts';
import PreventFocusout from './prevent-focusout.ts';
import Tooltip from './tooltip.ts';
import './tooltip.css';

export function registerDirectives(app: App): void {
	app.directive('click-outside', ClickOutside);
	app.directive('context-menu', ContextMenu);
	app.directive('focus', Focus);
	app.directive('prevent-focusout', PreventFocusout);
	app.directive('input-auto-width', InputAutoWidth);
	app.directive('md', Markdown);
	app.directive('tooltip', Tooltip);
}
