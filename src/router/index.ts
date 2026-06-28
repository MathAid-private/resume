// Vue Imports
import { createRouter, createWebHistory } from "vue-router"

import routes from "./routes"

// Create Vue Router instance
const router = createRouter({
    routes,
    history: createWebHistory(import.meta.env.BASE_URL),
    scrollBehavior() {
        // Scroll to top on route change
        return { top: 0 }
    },
})

export default router
