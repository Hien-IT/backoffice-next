import { createRouter, createWebHistory, type Router } from 'vue-router';

// Skeleton only: every path shows the shell (App.vue). Business routes start with feature 012.
export function createAppRouter(): Router {
	return createRouter({
		history: createWebHistory(import.meta.env.BASE_URL),
		routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }],
	});
}
