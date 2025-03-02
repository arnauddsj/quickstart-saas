import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/userStore'

// Lazy-loaded route components
const Dashboard = () => import('../views/Dashboard.vue')
const Login = () => import('../views/Login.vue')
const EmailVerification = () => import('../views/EmailVerification.vue')
const Admin = () => import('../views/Admin.vue')
const NotFound = () => import('../views/NotFound.vue')

// Auth guard function
async function requireAuth(to, from, next) {
  // Skip auth check for non-protected routes
  if (!to.meta.requiresAuth) {
    return next()
  }

  // Get the user store
  const userStore = useUserStore()
  
  // Check if the user is authenticated
  const isAuthenticated = await userStore.checkAuth()
  
  if (!isAuthenticated && to.name !== 'login' && to.name !== 'auth') {
    next({ name: 'login' })
  } else {
    next()
  }
}

// Admin guard function
async function requireAdmin(to, from, next) {
  // Get the user store
  const userStore = useUserStore()
  
  // Check if the user exists and has admin role
  const isAuthenticated = await userStore.checkAuth()
  
  if (!isAuthenticated) {
    // Not authenticated, redirect to login
    next({ name: 'login' })
  } else if (userStore.user?.role !== 'admin') {
    // Authenticated but not admin, redirect to dashboard
    next({ name: 'dashboard' })
  } else {
    // Is admin, proceed
    next()
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: Login
    },
    {
      path: '/auth',
      name: 'auth',
      component: EmailVerification
    },
    {
      path: '/admin',
      name: 'admin',
      component: Admin,
      meta: { requiresAuth: true, requiresAdmin: true },
      beforeEnter: requireAdmin
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFound
    }
  ]
})

// Global navigation guard - need to convert to async/await format
router.beforeEach(async (to, from, next) => {
  await requireAuth(to, from, next)
})

export default router 