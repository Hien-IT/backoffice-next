// Ported from directus/app/src/utils/router-passthrough.ts
import { type FunctionalComponent, h } from 'vue';
import { RouterView } from 'vue-router';

const component: FunctionalComponent = () => h(RouterView);

component.displayName = 'router-passthrough';

export default component;
