// Vue first, then unhead (directus/app/src/main.ts: unhead breaks when imported first).
import { createApp } from 'vue';

import { createHead } from '@unhead/vue';
import { createPinia } from 'pinia';
import { createSdk } from './api/sdk.ts';
import App from './App.vue';
import { startIdleTracking } from './idle.ts';
import { i18n } from './lang/index.ts';
import { router } from './router/index.ts';
import { loadRuntimeConfig } from './runtime-config.ts';
import './styles/tokens.css';
import './styles/theme.css';
import './styles/base.css';
import './styles/fonts.css';

// One build for every environment (FR-001): apiUrl comes from config.json. Stores read the `sdk` binding only when
// they send a request, so creating it before mount is enough.
const { apiUrl } = await loadRuntimeConfig();
createSdk(apiUrl);

const app = createApp(App);

app.use(i18n);
app.use(createPinia());
app.use(createHead());
app.use(router);

startIdleTracking();

app.mount('#app');
