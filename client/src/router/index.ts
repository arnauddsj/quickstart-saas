import { createRouter, createWebHistory } from "vue-router"
import { useUserStore } from "../stores/user.ts"

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      name: "home",
      path: "/",
      component: () => import("./Home.vue"),
      meta: { requiresAuth: true },
    },
    {
      name: 'auth',
      path: '/auth',
      component: () => import('@/router/auth/Auth.vue'),
      meta: { layout: 'auth' }
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  await userStore.fetchUser()

  if (to.meta.requiresAuth && !userStore.user.isLoggedIn) {
    next({ name: 'auth' })
  } else if (to.name === 'auth' && userStore.user.isLoggedIn) {
    next({ name: 'home' })
  } else {
    next()
  }
})

export default router