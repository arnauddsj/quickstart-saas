import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from "../stores/user.ts"

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { name: 'home', path: '/', component: () => import('./home.vue'), meta: { layout: 'landing' } },
    // { name: 'login', path: '/login', component: () => import('./auth/login.vue'), meta: { layout: 'auth' } },
    // { name: 'sign-up', path: '/sign-up', component: () => import('./auth/sign-up.vue'), meta: { layout: 'auth' } },
    // { name: 'reset-password', path: '/reset-password', component: () => import('./auth/reset-password.vue'), meta: { layout: 'auth' } },
    // { name: 'change-password', path: '/change-password', component: () => import('./auth/change-password.vue'), meta: { layout: 'auth' } },
  ],
})

const authRoutes = ['login', 'sign-up', 'reset-password', 'change-password']
const publicRoutes = ['legal-information', 'privacy-policy']

router.beforeEach((to) => {
  const store = useUserStore()
  // if (publicRoutes.includes(to.name as string)) {
  //   // Allow access to public routes
  //   return true
  // }

  // if (!store.isAuthenticated && !authRoutes.includes(to.name as string)) {
  //   return { name: 'login' }
  // } else if (store.isAuthenticated && authRoutes.includes(to.name as string)) {
  //   return { name: 'home' }
  // }
})

export default router