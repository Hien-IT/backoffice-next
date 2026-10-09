import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { createAppI18n } from './i18n/index.ts';
import { createAppRouter } from './router/index.ts';
import { loadRuntimeConfig } from './runtime-config.ts';

const { apiUrl } = await loadRuntimeConfig();

createApp(App, { apiUrl })
	.use(createPinia())
	.use(createAppRouter())
	.use(createAppI18n())
	.mount('#app');
