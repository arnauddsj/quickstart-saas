import { TRPCClientError } from '@trpc/client'
import { describe, expect, it } from 'vitest'
import { errorMessage, queryClient } from './server'

type Retry = (failureCount: number, error: unknown) => boolean
const retry = queryClient.getDefaultOptions().queries?.retry as Retry

function trpcError(httpStatus: number) {
  return new TRPCClientError('failed', {
    result: { error: { message: 'failed', code: -32000, data: { httpStatus } } },
  } as never)
}

describe('query retry policy', () => {
  it('never retries a rate-limited request', () => {
    expect(retry(0, trpcError(429))).toBe(false)
    expect(retry(0, new Error('Rate limit exceeded, retry in 1 minute'))).toBe(false)
  })

  it('retries other failures twice', () => {
    expect(retry(0, trpcError(500))).toBe(true)
    expect(retry(1, new Error('boom'))).toBe(true)
    expect(retry(2, new Error('boom'))).toBe(false)
  })
})

describe('errorMessage', () => {
  it('reads an Error and falls back for anything else', () => {
    expect(errorMessage(new Error('Plan limit reached'))).toBe('Plan limit reached')
    expect(errorMessage('nope')).toBe('Something went wrong')
    expect(errorMessage(undefined)).toBe('Something went wrong')
  })
})
