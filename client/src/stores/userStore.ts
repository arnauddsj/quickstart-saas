import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { trpc } from '../api/trpcClient'

// Define types for our user data
export interface User {
  id: string
  email: string
  name?: string
  role: string
  // Add any other user properties your app requires
}

// Define the user store
export const useUserStore = defineStore('user', () => {
  // State
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  // Computed
  const isAuthenticated = computed(() => !!user.value)
  const userName = computed(() => user.value?.name || user.value?.email || 'User')
  
  // Actions
  async function fetchUser() {
    loading.value = true
    error.value = null
    
    try {
      user.value = await trpc.auth.getUser.query()
      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch user data'
      user.value = null
      return false
    } finally {
      loading.value = false
    }
  }
  
  async function logout() {
    loading.value = true
    error.value = null
    
    try {
      await trpc.auth.logout.mutate()
      user.value = null
      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to logout'
      return false
    } finally {
      loading.value = false
    }
  }
  
  // Function to check auth status - useful for router guards
  async function checkAuth() {
    if (user.value) return true
    return await fetchUser()
  }
  
  // Reset the store state
  function reset() {
    user.value = null
    loading.value = false
    error.value = null
  }
  
  return {
    // State
    user,
    loading,
    error,
    
    // Computed
    isAuthenticated,
    userName,
    
    // Actions
    fetchUser,
    logout,
    checkAuth,
    reset
  }
}) 