import { reactive, computed } from 'vue'
import { defineStore } from 'pinia'
import { trpc } from '@/services/server'
import Cookies from 'js-cookie'
import { TRPCClientError } from '@trpc/client'

interface UserState {
  email: string | null
  isLoggedIn: boolean
}

export const useUserStore = defineStore('user', () => {
  const user = reactive<UserState>({
    email: null,
    isLoggedIn: false
  })

  const isLoggedIn = computed(() => user.isLoggedIn)

  function setUser(email: string) {
    user.email = email
    user.isLoggedIn = true
  }

  async function fetchUser() {
    try {
      const result = await trpc.auth.getUser.query()
      if (result && result.email) {
        setUser(result.email)
        return result
      } else {
        clearUser()
        return null
      }
    } catch (error) {
      if (error instanceof TRPCClientError && error.message === 'Not authenticated') {
        clearUser()
        return null
      }
      console.error('Failed to fetch user:', error)
      clearUser()
      return null
    }
  }

  function clearUser() {
    user.email = null
    user.isLoggedIn = false
  }

  async function logout() {
    try {
      await trpc.auth.logout.mutate()
      user.email = null
      user.isLoggedIn = false
      Cookies.remove(import.meta.env.VITE_COOKIE_NAME, { path: '/' })
    } catch (error) {
      console.error('Logout failed:', error)
      user.email = null
      user.isLoggedIn = false
      Cookies.remove(import.meta.env.VITE_COOKIE_NAME, { path: '/' })
    }
  }

  return { user, setUser, fetchUser, logout, isLoggedIn }
})