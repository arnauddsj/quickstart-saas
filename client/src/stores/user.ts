import { reactive } from 'vue'
import { defineStore } from 'pinia'
import { trpc } from '@/services/server'
import Cookies from 'js-cookie'

interface UserState {
  email: string | null
  isLoggedIn: boolean
}

export const useUserStore = defineStore('user', () => {
  const user = reactive<UserState>({
    email: null,
    isLoggedIn: false
  })

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
        // No user data returned
        user.email = null
        user.isLoggedIn = false
        return null
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      user.email = null
      user.isLoggedIn = false
      return null
    }
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

  return { user, setUser, fetchUser, logout }
})