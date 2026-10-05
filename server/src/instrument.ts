// docs/error-reporting.md
import * as Sentry from '@sentry/node'
import { env } from './config/env.js'
import { scrubBreadcrumb, scrubEvent } from './services/scrub.js'

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
  release: env.SENTRY_RELEASE,
  sendDefaultPii: false,
  maxBreadcrumbs: 50,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
})
