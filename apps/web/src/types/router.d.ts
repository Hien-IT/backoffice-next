import 'vue-router';

declare module 'vue-router' {
	interface RouteMeta {
		/** Route reachable without a session (Directus router meta). */
		public?: boolean;
		/** false: onAfterEach does not write last_page (Directus router meta). */
		track?: boolean;
		/** Module id of a module route (layout title and icon). */
		module?: string;
	}
}
