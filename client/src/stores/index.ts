import { createPinia } from 'pinia'

// Create the Pinia instance
const pinia = createPinia()

// Export the Pinia instance and store imports
export { pinia }
export * from './userStore' 