import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../server/src/trpc/router';

// Create tRPC client
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/trpc',
      // Enable credentials to make sure cookies are sent with requests
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include', // This is important for cookies to be sent
        });
      },
    }),
  ],
});

// Helper function to check authentication status
export async function checkAuth(): Promise<boolean> {
  try {
    await trpc.auth.getUser.query();
    return true;
  } catch (error) {
    return false;
  }
} 