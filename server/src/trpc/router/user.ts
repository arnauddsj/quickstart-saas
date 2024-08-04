import { publicProcedure, router } from "../index"

export default router({
  fetchUser: publicProcedure
    .query(() => {
      console.log('fetchUser procedure called')
      // Simulate user data retrieval with a token
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        token: 'simulated-jwt-token-12345'
      }
      console.log('Returning user data:', userData)
      return userData
    }),
})