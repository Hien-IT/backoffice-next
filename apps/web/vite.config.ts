import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Served under /admin/ like the Directus app. In dev, /server/* goes to the API (PUBLIC_URL like Directus, default the local API).
export default defineConfig({
	base: '/admin/',
	plugins: [vue()],
	server: {
		proxy: { '/server': process.env['PUBLIC_URL'] ?? 'http://127.0.0.1:8055' },
	},
});
