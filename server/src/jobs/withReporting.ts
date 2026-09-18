// docs/background-jobs.md
import type { WorkHandler } from 'pg-boss'
import { reportError } from '../services/reportError.js'

export function withReporting<T>(queue: string, handler: WorkHandler<T>): WorkHandler<T> {
  return async (jobs) => {
    try {
      return await handler(jobs)
    } catch (err) {
      reportError({
        severity: 'ERROR',
        type: `job.${queue}`,
        message: 'Job failed',
        error: err,
        context: { jobIds: jobs.map((j) => j.id) },
      })
      throw err
    }
  }
}
