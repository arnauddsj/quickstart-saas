// docs/error-reporting.md
import type { Breadcrumb, ErrorEvent } from '@sentry/node'

const KEPT_HEADERS = ['user-agent', 'x-request-id', 'x-action-id']
const SECRET_KEY = /token|secret|password|authorization|cookie|key/i

export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      SECRET_KEY.test(k) ? '[redacted]' : redact(v, depth + 1),
    ]),
  )
}

export function scrubEvent<T extends ErrorEvent>(event: T): T {
  if (event.request) {
    const { headers, url } = event.request
    event.request = {
      method: event.request.method,
      url: url ? stripQuery(url) : undefined,
      headers: headers
        ? Object.fromEntries(
            Object.entries(headers).filter(([k]) => KEPT_HEADERS.includes(k.toLowerCase())),
          )
        : undefined,
    }
  }
  if (event.user) event.user = event.user.id === undefined ? {} : { id: event.user.id }
  if (event.contexts) event.contexts = redact(event.contexts) as T['contexts']
  if (event.extra) event.extra = redact(event.extra) as T['extra']
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb)
  return event
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  const data = crumb.data ? (redact(crumb.data) as Record<string, unknown>) : undefined
  if (data) {
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') data[key] = stripQuery(data[key])
    }
  }
  return { ...crumb, data }
}
