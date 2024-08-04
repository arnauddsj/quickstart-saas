import { reactive } from 'vue'
import { defineStore } from 'pinia'
import { trpc } from '@/services/server'

interface UserState {
  name: string
  email: string
  token: string
  isLoggedIn: boolean
}

export const useUserStore = defineStore('user', () => {
  const user = reactive<UserState>({
    name: '',
    email: '',
    token: '',
    isLoggedIn: false
  })

  async function fetchUser() {
    try {
      const result = await trpc.user.fetchUser.query()
      console.log('User data received:', result)
      const { name, email, token } = result
      Object.assign(user, { name, email, token, isLoggedIn: !!token })
      return token
    } catch (error) {
      console.error('Failed to fetch user:', error)
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }
      return null
    }
  }

  return { user, fetchUser }
})