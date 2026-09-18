// docs/error-reporting.md
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const COLORS = { ERROR: 0xe74c3c, CRITICAL: 0x8e44ad } as const

export async function postToDiscord(input: {
  severity: keyof typeof COLORS
  type: string
  message: string
  context?: Record<string, unknown>
}) {
  if (!env.DISCORD_WEBHOOK_URL) return
  try {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `[${input.severity}] ${input.type}`,
            description: input.message.slice(0, 1900),
            color: COLORS[input.severity],
            fields: input.context
              ? Object.entries(input.context)
                  .slice(0, 10)
                  .map(([name, value]) => ({
                    name,
                    value: String(value).slice(0, 200),
                    inline: true,
                  }))
              : [],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    })
    if (!res.ok) logger.warn({ status: res.status }, 'discord webhook rejected')
  } catch (err) {
    logger.warn({ err }, 'discord webhook failed')
  }
}
