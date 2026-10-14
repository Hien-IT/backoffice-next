import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// The API routes the app calls (specs/012-backoffice-web-shell/contracts/api-calls.md).
const API_PATHS =
	'^/(auth|server|users|policies|roles|permissions|settings|collections|fields|relations|presets|translations|notifications|assets|shares|files|utils)([/?]|$)';

// Served under /admin/ like the Directus app. In dev, API paths go to PUBLIC_URL (like Directus, default the local
// API) on the same origin, so the session cookie works without CORS. Route components are imported lazily, which
// splits public, private and module code into their own chunks (research R12).
export default defineConfig({
	base: '/admin/',
	plugins: [vue(), tailwindcss()],
	// Pre-bundled up front so the browser test project does not reload mid-run when it first meets them (feature 013).
	optimizeDeps: {
		include: [
			'vuedraggable',
			'vue-virtual-scroller',
			'color',
			'@fortawesome/fontawesome-svg-core',
			'@fortawesome/free-brands-svg-icons',
			'codemirror',
			'jsonlint-mod',
			'maplibre-gl',
		],
	},
	server: {
		proxy: { [API_PATHS]: { target: process.env['PUBLIC_URL'] ?? 'http://127.0.0.1:8055', changeOrigin: false } },
	},
});
