import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from "@trpc/client"
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "server/src/trpc/router"

export type RouterInput = inferRouterInputs<AppRouter>
export type RouterOutput = inferRouterOutputs<AppRouter>

export const endpoint = import.meta.env.VITE_API_ENDPOINT ?? "http://localhost:3000/trpc"

export const trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>> = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: endpoint,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        })
      },
    }),
  ],
})

export function extractErrors(error: Error) {
  const res = { message: error.message, fieldErrors: {} as Record<string, string> }
  if (error instanceof TRPCClientError && error.data?.fieldErrors) {
    Object.entries(error.data.fieldErrors).forEach(([key, values]) => {
      res.fieldErrors[key] = (values as string[])[0]
    })
  }
  return res
}