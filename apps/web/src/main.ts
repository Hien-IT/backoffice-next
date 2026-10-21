// Vue first, then unhead (directus/app/src/main.ts: unhead breaks when imported first).
import { createApp } from 'vue';

import { createHead } from '@unhead/vue';
import { createPinia } from 'pinia';
import { createSdk } from './api/sdk.ts';
import App from './App.vue';
import { hasAppExtensions, loadExtensions, registerExtensions } from './extensions.ts';
import { startIdleTracking } from './idle.ts';
import { i18n } from './lang/index.ts';
import { router } from './router/index.ts';
import { loadRuntimeConfig } from './runtime-config.ts';
import './styles/index.css';

// One build for every environment (FR-001): apiUrl comes from config.json. Stores read the `sdk` binding only when
// they send a request, so creating it before mount is enough.
const { apiUrl } = await loadRuntimeConfig();
createSdk(apiUrl);

const app = createApp(App);

app.use(i18n);
app.use(createPinia());
app.use(createHead());

// Spec 020 (research R4, directus/app/src/main.ts): the app extensions of the API, then the global components,
// directives and injects they expect (loaded only when the bundle has app extensions), then the registries; the
// router comes last so the first navigation sees the extension modules.
await loadExtensions();

if (hasAppExtensions()) {
	const [{ registerShims }, { useSystem }] = await Promise.all([
		import('./directus-shim/register.ts'),
		import('./directus-shim/use-system.ts'),
	]);

	registerShims(app);
	useSystem(app);
}

await registerExtensions(app);

app.use(router);

startIdleTracking();

app.mount('#app');
