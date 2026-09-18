// docs/type-contract.md
import { createTRPCClient, httpBatchLink, TRPCClientError } from '@trpc/client'
import type { TRPCClient } from '@trpc/client'
import { QueryClient, useMutation, useQuery } from '@tanstack/vue-query'
import type { MutationOptions, QueryKey } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { AppRouter } from 'server/router'

export const trpc: TRPCClient<AppRouter> = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_API_ENDPOINT ?? '/trpc',
      fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
    }),
  ],
})

function isRateLimited(error: unknown): boolean {
  if (error instanceof TRPCClientError) {
    const status = error.data?.httpStatus
    if (status === 429) return true
  }
  return error instanceof Error && /rate limit/i.test(error.message)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => !isRateLimited(error) && failureCount < 2,
    },
  },
})

type TRPCQueryOptions = {
  enabled?: MaybeRefOrGetter<boolean | undefined>
  staleTime?: number
  gcTime?: number
  refetchInterval?: number | false
  retry?: boolean | number
}

export function useTRPCQuery<T>(
  queryFn: () => Promise<T>,
  key: MaybeRefOrGetter<QueryKey>,
  options?: TRPCQueryOptions,
) {
  return useQuery<T, Error, T, QueryKey>({ ...options, queryKey: key, queryFn })
}

export function useTRPCMutation<TIn, TOut>(
  mutationFn: (input: TIn) => Promise<TOut>,
  options?: Omit<MutationOptions<TOut, Error, TIn>, 'mutationFn'>,
) {
  return useMutation<TOut, Error, TIn>({ ...options, mutationFn })
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}
